import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { compactSession } from "./compaction.js";
import { SessionRegistry } from "./registry.js";
import { AuditLogStore } from "./audit.js";
import { createBuiltInTools } from "./builtin-tools.js";
import {
  createTaskRuntime,
  readTaskLog,
  refreshTaskRecordState,
  stopTaskProcess,
  type RuntimeTaskHandle,
} from "./tasks.js";
import {
  RuntimePermissionManager,
  type PermissionRequest,
} from "./permissions.js";
import {
  DEFAULT_PERMISSION_POLICY,
  ToolRegistry,
  summarizeToolResult,
} from "./tools.js";
import type {
  KernelApprovalRecord,
  KernelCompletionProvider,
  KernelEventPayloads,
  KernelMessage,
  KernelRunOptions,
  KernelRunResult,
  KernelSession,
  KernelShellTaskOptions,
  KernelTaskRecord,
  KernelToolCall,
  KernelToolResult,
  SessionRegistryOptions,
} from "./types.js";

interface AgentKernelOptions {
  completionProvider?: KernelCompletionProvider;
  sessionRegistry?: SessionRegistry;
  registryOptions?: SessionRegistryOptions;
  autoCompactMessages?: number;
  auditLogStore?: AuditLogStore;
  permissionManager?: RuntimePermissionManager;
  registerBuiltInTools?: boolean;
  approvalResolver?: (request: {
    session: KernelSession;
    toolCall: KernelToolCall;
    permissionRequest: PermissionRequest;
  }) => Promise<{ decision: "approved" | "denied"; reason?: string }>;
}

export class AgentKernel extends EventEmitter {
  readonly sessions: SessionRegistry;
  readonly tools: ToolRegistry;

  private completionProvider?: KernelCompletionProvider;
  private readonly autoCompactMessages: number;
  private readonly auditLogStore: AuditLogStore;
  private readonly permissionManager: RuntimePermissionManager;
  private readonly approvalResolver?: AgentKernelOptions["approvalResolver"];
  private readonly taskRuntime: ReturnType<typeof createTaskRuntime>;

  constructor(options: AgentKernelOptions = {}) {
    super();
    this.sessions = options.sessionRegistry ?? new SessionRegistry(options.registryOptions);
    this.tools = new ToolRegistry();
    this.completionProvider = options.completionProvider;
    this.autoCompactMessages = options.autoCompactMessages ?? 40;
    this.auditLogStore = options.auditLogStore ?? new AuditLogStore(options.registryOptions);
    this.permissionManager = options.permissionManager ?? new RuntimePermissionManager();
    this.approvalResolver = options.approvalResolver;
    this.taskRuntime = createTaskRuntime(options.registryOptions);

    if (options.registerBuiltInTools !== false) {
      for (const tool of createBuiltInTools()) {
        this.tools.register(tool);
      }
    }
  }

  setCompletionProvider(provider: KernelCompletionProvider): void {
    this.completionProvider = provider;
  }

  async createSession(title: string, provider?: string, model?: string): Promise<KernelSession> {
    const session = await this.sessions.create(title, provider, model);
    this.emitTyped("session.created", session);
    return session;
  }

  async getSession(sessionId: string): Promise<KernelSession | null> {
    return this.sessions.load(sessionId);
  }

  async listSessions(): Promise<KernelSession[]> {
    return this.sessions.list();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async run(options: KernelRunOptions): Promise<KernelRunResult> {
    const provider = options.provider;
    const model = options.model;
    let session = options.sessionId
      ? await this.sessions.load(options.sessionId)
      : null;

    if (!session) {
      session = await this.createSession(
        options.title ?? deriveSessionTitle(options.input),
        provider,
        model
      );
    }

    if (provider) {
      session.provider = provider;
    }
    if (model) {
      session.model = model;
    }

    const userMessage = createMessage("user", options.input);
    session.messages.push(userMessage);
    await this.saveAndEmitMessage(session, userMessage);

    if (!this.completionProvider) {
      throw new Error("No completion provider configured for AgentKernel");
    }

    const maxTurns = options.maxTurns ?? 6;
    let turns = 0;
    let toolCalls = 0;
    let responseText = "";

    while (turns < maxTurns) {
      turns += 1;

      const completion = options.stream && this.completionProvider.stream
        ? await this.runStreamingCompletion(session, options)
        : await this.completionProvider.complete({
            session,
            messages: session.messages,
            tools: this.tools.list(),
            systemPrompt: options.systemPrompt,
            abortSignal: options.abortSignal,
          });

      const assistantMessage = createMessage("assistant", completion.content, {
        toolCalls: completion.toolCalls,
        metadata: completion.metadata,
      });
      responseText = completion.content;
      session.messages.push(assistantMessage);
      await this.saveAndEmitMessage(session, assistantMessage);

      if (!completion.toolCalls || completion.toolCalls.length === 0) {
        break;
      }

      for (const call of completion.toolCalls) {
        toolCalls += 1;
        const result = await this.executeToolCall(session, call, options.workspaceRoot, options.abortSignal);
        const toolMessage = createMessage(
          "tool",
          summarizeToolResult(result),
          {
            name: call.name,
            toolCallId: call.id,
          }
        );
        session.messages.push(toolMessage);
        await this.saveAndEmitMessage(session, toolMessage);
      }
    }

    if (session.messages.length > this.autoCompactMessages) {
      compactSession(session, { maxMessages: this.autoCompactMessages });
      await this.sessions.save(session);
      this.emitTyped("session.compacted", session);
    }

    return {
      session,
      response: responseText,
      turns,
      toolCalls,
    };
  }

  async addTask(
    sessionId: string,
    task: Omit<KernelTaskRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<KernelTaskRecord> {
    const session = await this.requireSession(sessionId);
    const now = Date.now();
    const record: KernelTaskRecord = {
      ...task,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    session.tasks.push(record);
    await this.sessions.save(session);
    this.emitTyped("session.updated", session);
    return record;
  }

  async startShellTask(
    sessionId: string,
    command: string,
    options: KernelShellTaskOptions = {}
  ): Promise<KernelTaskRecord> {
    const session = await this.requireSession(sessionId);
    const now = Date.now();
    const task: KernelTaskRecord = {
      id: randomUUID(),
      kind: "shell",
      title: options.title ?? deriveTaskTitle(command),
      status: "running",
      createdAt: now,
      updatedAt: now,
      detail: command,
      metadata: {},
    };

    const handle = await this.taskRuntime.startShellTask(session.id, task.id, command, {
      cwd: options.cwd,
    });

    task.outputPath = handle.logPath;
    task.metadata = buildTaskMetadata(command, handle, options.cwd);
    session.tasks.push(task);
    session.background = {
      status: "running",
      processId: handle.pid,
      logPath: handle.logPath,
      startedAt: now,
    };

    await this.sessions.save(session);
    this.emitTyped("task.started", { sessionId: session.id, task });
    this.emitTyped("session.updated", session);
    return task;
  }

  async listTasks(sessionId: string): Promise<KernelTaskRecord[]> {
    const session = await this.requireSession(sessionId);
    const changed = await this.refreshTaskStates(session);
    if (changed) {
      await this.sessions.save(session);
      this.emitTyped("session.updated", session);
    }
    return session.tasks;
  }

  async getTaskLog(
    sessionId: string,
    taskId: string,
    options: { maxBytes?: number } = {}
  ): Promise<string> {
    const session = await this.requireSession(sessionId);
    const task = requireTask(session, taskId);
    const logPath = readTaskLogPath(task);
    if (!logPath) {
      throw new Error(`Task ${taskId} does not have a log file`);
    }
    return readTaskLog(logPath, options.maxBytes);
  }

  async stopTask(
    sessionId: string,
    taskId: string,
    signal: NodeJS.Signals = "SIGTERM"
  ): Promise<boolean> {
    const session = await this.requireSession(sessionId);
    const task = requireTask(session, taskId);
    const pid = readTaskPid(task);
    if (!pid) {
      return false;
    }

    const stopped = stopTaskProcess(pid, signal);
    if (!stopped) {
      return false;
    }

    task.status = "cancelled";
    task.updatedAt = Date.now();
    task.metadata = {
      ...task.metadata,
      stopSignal: signal,
      stoppedAt: task.updatedAt,
    };

    if (session.background.processId === pid) {
      session.background = {
        status: "stopped",
        processId: pid,
        logPath: readTaskLogPath(task),
        startedAt: session.background.startedAt,
      };
    }

    await this.sessions.save(session);
    this.emitTyped("task.updated", { sessionId: session.id, task });
    this.emitTyped("session.updated", session);
    return true;
  }

  async invokeTool(
    sessionId: string,
    name: string,
    input: Record<string, unknown>,
    options: { workspaceRoot?: string; abortSignal?: AbortSignal } = {}
  ): Promise<KernelToolResult> {
    const session = await this.requireSession(sessionId);
    const call: KernelToolCall = {
      id: randomUUID(),
      name,
      input,
    };

    const result = await this.executeToolCall(
      session,
      call,
      options.workspaceRoot,
      options.abortSignal
    );

    const toolMessage = createMessage("tool", summarizeToolResult(result), {
      name,
      toolCallId: call.id,
    });
    session.messages.push(toolMessage);
    await this.saveAndEmitMessage(session, toolMessage);
    return result;
  }

  private async executeToolCall(
    session: KernelSession,
    call: KernelToolCall,
    workspaceRoot?: string,
    abortSignal?: AbortSignal
  ): Promise<KernelToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${call.name}" is not registered`,
      };
    }

    this.emitTyped("tool.started", { sessionId: session.id, call });

    const evaluation = this.permissionManager.evaluate(
      tool,
      call,
      session,
      workspaceRoot
    );
    await this.auditLogStore.logPermission(evaluation.request);

    if (evaluation.finalDecision !== "allow") {
      const approval = await this.recordApproval(session, call, evaluation.request);
      if (approval.decision === "denied") {
        await this.auditLogStore.logToolResult(session.id, call, {
          success: false,
          error: approval.reason ?? `Tool "${call.name}" was denied by policy`,
        });
        return {
          success: false,
          error: approval.reason ?? `Tool "${call.name}" was denied by policy`,
        };
      }
    }

    const result = await tool.execute(call.input, {
      session,
      workspaceRoot,
      abortSignal,
    });

    if (result.artifacts?.length) {
      session.artifacts.push(...result.artifacts);
    }

    await this.sessions.save(session);
    this.emitTyped("tool.completed", { sessionId: session.id, call, result });
    await this.auditLogStore.logToolResult(session.id, call, result);
    return result;
  }

  private async recordApproval(
    session: KernelSession,
    call: KernelToolCall,
    permissionRequest: PermissionRequest
  ): Promise<KernelApprovalRecord> {
    const resolved = permissionRequest.decision === "deny"
      ? { decision: "denied" as const, reason: "Denied by tool permission policy" }
      : await this.approvalResolver?.({
          session,
          toolCall: call,
          permissionRequest,
        }) ?? {
          decision: "denied" as const,
          reason: `No approval resolver configured for "${call.name}"`,
        };

    const approval: KernelApprovalRecord = {
      id: randomUUID(),
      toolName: call.name,
      decision: resolved.decision,
      reason: resolved.reason,
      createdAt: Date.now(),
      input: call.input,
    };
    session.approvals.push(approval);
    await this.sessions.save(session);
    this.emitTyped("approval.recorded", { sessionId: session.id, approval });
    await this.auditLogStore.logApproval(session.id, approval);
    return approval;
  }

  private async runStreamingCompletion(
    session: KernelSession,
    options: KernelRunOptions
  ) {
    const chunks: string[] = [];
    const toolCalls: KernelToolCall[] = [];
    const response = await this.completionProvider!.stream!(
      {
        session,
        messages: session.messages,
        tools: this.tools.list(),
        systemPrompt: options.systemPrompt,
        abortSignal: options.abortSignal,
      },
      (chunk) => {
        if (chunk.type === "text" && chunk.text) {
          chunks.push(chunk.text);
        }
        if (chunk.type === "tool_call" && chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
        }
      }
    );

    return {
      ...response,
      content: response.content || chunks.join(""),
      toolCalls: response.toolCalls ?? toolCalls,
    };
  }

  private async requireSession(sessionId: string): Promise<KernelSession> {
    const session = await this.sessions.load(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  private async saveAndEmitMessage(session: KernelSession, message: KernelMessage): Promise<void> {
    await this.sessions.save(session);
    this.emitTyped("message.created", { sessionId: session.id, message });
    this.emitTyped("session.updated", session);
  }

  private async refreshTaskStates(session: KernelSession): Promise<boolean> {
    let changed = false;

    for (const task of session.tasks) {
      const refreshed = await refreshTaskRecordState(task);
      if (!refreshed.changed) {
        continue;
      }

      Object.assign(task, refreshed.task);
      changed = true;

      if (session.background.processId && session.background.processId === readTaskPid(task)) {
        session.background = {
          status: refreshed.task.status === "completed"
            ? "stopped"
            : refreshed.task.status === "failed"
              ? "failed"
              : refreshed.task.status === "cancelled"
                ? "stopped"
                : "running",
          processId: readTaskPid(task),
          logPath: readTaskLogPath(task),
          startedAt: session.background.startedAt,
        };
      }

      this.emitTyped("task.updated", { sessionId: session.id, task });
    }

    return changed;
  }

  private emitTyped<K extends keyof KernelEventPayloads>(
    event: K,
    payload: KernelEventPayloads[K]
  ): void {
    this.emit(event, payload);
  }
}

function deriveSessionTitle(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function deriveTaskTitle(command: string): string {
  const normalized = command.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function createMessage(
  role: KernelMessage["role"],
  content: string,
  extra: Partial<KernelMessage> = {}
): KernelMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

function buildTaskMetadata(
  command: string,
  handle: RuntimeTaskHandle,
  cwd?: string
): Record<string, unknown> {
  return {
    command,
    cwd,
    pid: handle.pid,
    logPath: handle.logPath,
    statusPath: handle.statusPath,
    runnerPath: handle.runnerPath,
  };
}

function readTaskPid(task: KernelTaskRecord): number | undefined {
  const pid = task.metadata?.pid;
  return typeof pid === "number" ? pid : undefined;
}

function readTaskLogPath(task: KernelTaskRecord): string | undefined {
  const logPath = task.metadata?.logPath;
  return typeof logPath === "string" ? logPath : task.outputPath;
}

function requireTask(session: KernelSession, taskId: string): KernelTaskRecord {
  const task = session.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found in session ${session.id}`);
  }
  return task;
}
