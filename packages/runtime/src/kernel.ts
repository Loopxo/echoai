import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHookRegistry, HOOK_EVENTS, type HookRegistry } from "@echoai/hooks";
import { compactSession } from "./compaction.js";
import { SessionRegistry } from "./registry.js";
import { AuditLogStore } from "./audit.js";
import { createBuiltInTools } from "./builtin-tools.js";
import { normalizeSystemPrompt, resolveSystemPrompt } from "./prompting.js";
import { SessionMemoryStore } from "./session-memory.js";
import {
  createTaskRuntime,
  readTaskLog,
  refreshTaskRecordState,
  stopTaskProcess,
  type RuntimeTaskHandle,
} from "./tasks.js";
import {
  createSafetyClassifierResolver,
  PermissionResolver,
  PermissionResolverOrchestrator,
  RuntimePermissionManager,
  type PermissionRequest,
  resolvePathWithinWorkspace,
} from "./permissions.js";
import {
  ToolRegistry,
  summarizeToolResult,
} from "./tools.js";
import type {
  KernelApprovalRecord,
  KernelCompletionResponse,
  KernelCompactionReport,
  KernelCompletionProvider,
  KernelEventPayloads,
  KernelForkOptions,
  KernelPermissionHookPayload,
  KernelMessageHookPayload,
  KernelMessage,
  KernelRunEvent,
  KernelRunOptions,
  KernelRunResult,
  KernelSessionHookPayload,
  KernelSession,
  KernelShellTaskOptions,
  KernelTaskRecord,
  KernelTool,
  KernelToolAfterHookPayload,
  KernelToolBeforeHookPayload,
  KernelToolCall,
  KernelToolExecutionMode,
  KernelToolResult,
  KernelSystemPromptConfig,
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
  sessionMemoryStore?: SessionMemoryStore;
  hookRegistry?: HookRegistry;
  approvalResolvers?: PermissionResolver[];
  approvalResolver?: (request: {
    session: KernelSession;
    toolCall: KernelToolCall;
    permissionRequest: PermissionRequest;
    abortSignal?: AbortSignal;
  }) => Promise<{ decision: "approved" | "denied"; reason?: string }>;
}

interface PreparedToolCall {
  call: KernelToolCall;
  evaluation: ReturnType<RuntimePermissionManager["evaluate"]>;
  executionMode: KernelToolExecutionMode;
}

interface ToolExecutionBatch {
  mode: KernelToolExecutionMode;
  entries: PreparedToolCall[];
}

interface ToolExecutionOutcome {
  call: KernelToolCall;
  result: KernelToolResult;
  approval?: KernelApprovalRecord;
}

export class AgentKernel extends EventEmitter {
  readonly sessions: SessionRegistry;
  readonly tools: ToolRegistry;
  readonly hooks: HookRegistry;

  private completionProvider?: KernelCompletionProvider;
  private readonly autoCompactMessages: number;
  private readonly auditLogStore: AuditLogStore;
  private readonly permissionManager: RuntimePermissionManager;
  private readonly approvalResolver?: AgentKernelOptions["approvalResolver"];
  private readonly approvalResolvers: PermissionResolver[];
  private readonly taskRuntime: ReturnType<typeof createTaskRuntime>;
  private readonly sessionMemoryStore: SessionMemoryStore;

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
    this.sessionMemoryStore = options.sessionMemoryStore ?? new SessionMemoryStore(options.registryOptions);
    this.hooks = options.hookRegistry ?? createHookRegistry();
    this.approvalResolvers = [
      this.createHookPermissionResolver(),
      createSafetyClassifierResolver(),
      ...(options.approvalResolvers ?? []),
      ...(options.approvalResolver
        ? [{
            name: "interactive",
            resolve: async ({ session, toolCall, permissionRequest, abortSignal }) => {
              const result = await options.approvalResolver!({
                session,
                toolCall,
                permissionRequest,
                abortSignal,
              });
              return {
                decision: result.decision,
                reason: result.reason,
                source: "interactive",
                resolver: "interactive",
              };
            },
          } satisfies PermissionResolver]
        : []),
    ];

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
    await this.sessions.appendEvent(session.id, "session.created", {
      title: session.title,
      provider: session.provider ?? "",
      model: session.model ?? "",
    });
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

  async forkSession(
    parentSessionId: string,
    options: KernelForkOptions = {}
  ): Promise<KernelSession> {
    const parent = await this.requireSession(parentSessionId);
    const forked = await this.createSession(
      options.title ?? `${parent.title} (Subagent)`,
      options.provider ?? parent.provider,
      options.model ?? parent.model
    );

    if (options.includeMessages !== false) {
      forked.messages = parent.messages.map((message) => ({
        ...message,
        toolCalls: message.toolCalls?.map((toolCall) => ({ ...toolCall })),
        attachments: message.attachments?.map((attachment) => ({ ...attachment })),
        metadata: message.metadata ? { ...message.metadata } : undefined,
      }));
    }

    if (options.includeMetadata !== false) {
      forked.metadata = {
        ...parent.metadata,
      };
    }

    forked.metadata.parentSessionId = parent.id;
    forked.metadata.cacheShared = options.includeMessages !== false;

    if (options.worktree?.enabled) {
      const sourceWorkspace = readStringMetadata(parent.metadata.workspaceRoot);
      const worktreePath = options.worktree.path
        ?? (sourceWorkspace ? await createIsolatedWorkspace(sourceWorkspace, forked.id) : undefined);

      forked.worktree = {
        enabled: true,
        path: worktreePath,
        branch: options.worktree.branch ?? `echoai/${forked.id.slice(0, 8)}`,
      };

      if (worktreePath) {
        forked.metadata.workspaceRoot = worktreePath;
        forked.metadata.workingDirectory = worktreePath;
      }
    }

    await this.sessions.save(forked);
    await this.sessions.appendEvent(forked.id, "session.forked", {
      parentSessionId: parent.id,
      cacheShared: options.includeMessages !== false,
      worktree: forked.worktree as unknown as Record<string, unknown>,
    });
    return forked;
  }

  async runSubagent(
    parentSessionId: string,
    runOptions: Omit<KernelRunOptions, "sessionId">,
    forkOptions: KernelForkOptions = {}
  ): Promise<KernelRunResult> {
    const session = await this.forkSession(parentSessionId, forkOptions);
    return this.run({
      ...runOptions,
      sessionId: session.id,
      workspaceRoot: session.worktree.path
        ?? readStringMetadata(session.metadata.workspaceRoot)
        ?? runOptions.workspaceRoot,
    });
  }

  async run(options: KernelRunOptions): Promise<KernelRunResult> {
    let result: KernelRunResult | undefined;
    for await (const event of this.runEvents(options)) {
      if (event.type === "run.completed") {
        result = event.result;
      }
    }

    if (!result) {
      throw new Error("Kernel run terminated before producing a result");
    }

    return result;
  }

  async *runEvents(options: KernelRunOptions): AsyncGenerator<KernelRunEvent, KernelRunResult> {
    throwIfAborted(options.abortSignal);
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
    if (options.mode) {
      session.mode = options.mode;
    }
    session.metadata.provider = session.provider ?? session.metadata.provider;
    session.metadata.model = session.model ?? session.metadata.model;
    const workspaceRoot = this.resolveWorkspaceRoot(session, options.workspaceRoot);
    session.metadata.workspaceRoot = workspaceRoot;
    session.metadata.workingDirectory = workspaceRoot;

    yield { type: "run.started", session };
    await this.hooks.trigger<KernelSessionHookPayload>(HOOK_EVENTS.SESSION_START, {
      session,
      options,
    });
    throwIfAborted(options.abortSignal);

    const userMessage = createMessage(
      "user",
      options.input,
      options.userMessageId ? { id: options.userMessageId } : {}
    );
    session.messages.push(userMessage);
    await this.saveAndEmitMessage(session, userMessage);
    yield { type: "message.created", sessionId: session.id, message: userMessage };

    if (!this.completionProvider) {
      throw new Error("No completion provider configured for AgentKernel");
    }

    const maxTurns = options.maxTurns ?? 6;
    let turns = 0;
    let toolCalls = 0;
    let responseText = "";
    let compaction: KernelCompactionReport | undefined;
    const promptConfig = normalizeSystemPrompt(options.systemPrompt);

    while (turns < maxTurns) {
      throwIfAborted(options.abortSignal);
      turns += 1;
      const assistantMessageId = randomUUID();
      const sessionMemory = await this.sessionMemoryStore.read(session.id);
      const resolvedSystemPrompt = await this.resolveRunSystemPrompt(
        session,
        promptConfig,
        workspaceRoot,
        sessionMemory?.content
      );

      const completionIterator = this.streamCompletionEvents(session, {
        ...options,
        systemPrompt: resolvedSystemPrompt,
      }, assistantMessageId);
      let completion: KernelCompletionResponse | undefined;

      while (true) {
        const step = await completionIterator.next();
        if (step.done) {
          completion = step.value;
          break;
        }
        yield step.value;
      }

      if (!completion) {
        throw new Error("Completion provider returned no response");
      }
      throwIfAborted(options.abortSignal);

      const assistantMessage = createMessage("assistant", completion.content, {
        id: assistantMessageId,
        toolCalls: completion.toolCalls,
        metadata: completion.metadata,
      });
      responseText = completion.content;
      session.messages.push(assistantMessage);
      await this.saveAndEmitMessage(session, assistantMessage);
      yield { type: "message.created", sessionId: session.id, message: assistantMessage };

      if (!completion.toolCalls || completion.toolCalls.length === 0) {
        break;
      }

      const toolIterator = this.executeToolCallsWithEvents(
        session,
        completion.toolCalls,
        workspaceRoot,
        options.abortSignal
      );
      let outcomes: ToolExecutionOutcome[] = [];

      while (true) {
        const step = await toolIterator.next();
        if (step.done) {
          outcomes = step.value;
          break;
        }
        yield step.value;
      }

      for (const { call, result } of outcomes) {
        toolCalls += 1;
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
        yield { type: "message.created", sessionId: session.id, message: toolMessage };
      }
    }

    if (session.messages.length > this.autoCompactMessages) {
      compaction = await compactSession(session, { maxMessages: this.autoCompactMessages }, this.completionProvider);
      if (compaction.appliedStrategies.length > 0) {
        await this.sessions.save(session);
        await this.sessions.appendEvent(session.id, "session.compacted", {
          report: compaction as unknown as Record<string, unknown>,
          messages: session.messages,
        });
        this.emitTyped("session.compacted", { session, report: compaction });
        yield { type: "session.compacted", session, report: compaction };
      }
    }

    throwIfAborted(options.abortSignal);
    await this.sessionMemoryStore.write(session);

    const result: KernelRunResult = {
      session,
      response: responseText,
      turns,
      toolCalls,
      compaction,
    };
    await this.hooks.trigger<KernelSessionHookPayload>(HOOK_EVENTS.SESSION_END, {
      session,
      options,
    });
    yield { type: "run.completed", result };
    return result;
  }

  private async resolveRunSystemPrompt(
    session: KernelSession,
    config: KernelSystemPromptConfig | undefined,
    workspaceRoot: string | undefined,
    sessionMemory: string | undefined
  ): Promise<string | undefined> {
    return resolveSystemPrompt(session, config, {
      session,
      workspaceRoot,
      currentDate: new Date().toISOString(),
      sessionMemory,
    });
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

  async updateTask(
    sessionId: string,
    taskId: string,
    updates: Partial<Omit<KernelTaskRecord, "id" | "createdAt">>
  ): Promise<KernelTaskRecord> {
    const session = await this.requireSession(sessionId);
    const task = requireTask(session, taskId);
    Object.assign(task, updates, { updatedAt: Date.now() });
    await this.sessions.save(session);
    this.emitTyped("task.updated", { sessionId: session.id, task });
    this.emitTyped("session.updated", session);
    return task;
  }

  async appendMessage(
    sessionId: string,
    role: KernelMessage["role"],
    content: string,
    extra: Partial<KernelMessage> = {}
  ): Promise<KernelMessage> {
    const session = await this.requireSession(sessionId);
    const message = createMessage(role, content, extra);
    session.messages.push(message);
    await this.saveAndEmitMessage(session, message);
    return message;
  }

  async addArtifact(
    sessionId: string,
    artifact: Omit<KernelSession["artifacts"][number], "id" | "createdAt">
  ): Promise<KernelSession["artifacts"][number]> {
    const session = await this.requireSession(sessionId);
    const record = {
      ...artifact,
      id: randomUUID(),
      createdAt: Date.now(),
    };
    session.artifacts.push(record);
    await this.sessions.save(session);
    this.emitTyped("session.updated", session);
    return record;
  }

  async startShellTask(
    sessionId: string,
    command: string,
    options: KernelShellTaskOptions = {}
  ): Promise<KernelTaskRecord> {
    throwIfAborted(options.abortSignal);
    const session = await this.requireSession(sessionId);
    throwIfAborted(options.abortSignal);
    const workspaceRoot = this.resolveWorkspaceRoot(session);
    const cwd = options.cwd
      ? resolvePathWithinWorkspace(options.cwd, workspaceRoot)
      : resolvePathWithinWorkspace(".", workspaceRoot);

    const taskTool = createShellTaskTool();
    const taskCall: KernelToolCall = {
      id: randomUUID(),
      name: taskTool.name,
      input: {
        command,
        cwd,
      },
    };
    const evaluation = this.permissionManager.evaluate(taskTool, taskCall, session, workspaceRoot);
    await this.auditLogStore.logPermission(evaluation.request);
    throwIfAborted(options.abortSignal);

    if (evaluation.finalDecision !== "allow") {
      const approval = await this.recordApproval(
        session,
        taskCall,
        evaluation.request,
        options.abortSignal
      );
      throwIfAborted(options.abortSignal);
      if (approval.decision === "denied") {
        throw new Error(approval.reason ?? `Background task "${command}" was denied`);
      }
    }

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
      cwd,
      abortSignal: options.abortSignal,
    });

    try {
      throwIfAborted(options.abortSignal);
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
      throwIfAborted(options.abortSignal);
    } catch (error) {
      stopTaskProcess(handle.pid);
      task.status = options.abortSignal?.aborted ? "cancelled" : "failed";
      task.updatedAt = Date.now();
      task.outputPath = handle.logPath;
      task.metadata = {
        ...buildTaskMetadata(command, handle, options.cwd),
        ...task.metadata,
        startupError: error instanceof Error ? error.message : String(error),
        stoppedAt: task.updatedAt,
      };
      if (!session.tasks.some((entry) => entry.id === task.id)) {
        session.tasks.push(task);
      }
      session.background = {
        status: options.abortSignal?.aborted ? "stopped" : "failed",
        processId: handle.pid,
        logPath: handle.logPath,
        startedAt: now,
      };
      await this.sessions.save(session).catch(() => undefined);
      throw error;
    }

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
    const expected = this.taskRuntime.getTaskPaths(session.id, task.id).logPath;
    if (path.resolve(logPath) !== path.resolve(expected)) {
      throw new Error(`Task ${taskId} has an unmanaged log path`);
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
    const paths = this.taskRuntime.getTaskPaths(session.id, task.id);
    if (!isManagedTaskRecord(task, paths)) {
      throw new Error(`Task ${taskId} metadata is not managed by the runtime`);
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
    const workspaceRoot = this.resolveWorkspaceRoot(session, options.workspaceRoot);
    const call: KernelToolCall = {
      id: randomUUID(),
      name,
      input,
    };

    const outcome = await this.executePreparedToolCall(
      session,
      this.prepareToolCall(session, call, workspaceRoot),
      workspaceRoot,
      options.abortSignal
    );
    await this.finalizeToolOutcome(session, outcome.call, outcome.result);

    const toolMessage = createMessage("tool", summarizeToolResult(outcome.result), {
      name,
      toolCallId: call.id,
    });
    session.messages.push(toolMessage);
    await this.saveAndEmitMessage(session, toolMessage);
    return outcome.result;
  }

  private prepareToolCall(
    session: KernelSession,
    call: KernelToolCall,
    workspaceRoot?: string
  ): PreparedToolCall {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        call,
        evaluation: {
          request: {
            id: randomUUID(),
            sessionId: session.id,
            toolName: call.name,
            scope: "process",
            decision: "deny",
            risk: "medium",
            reason: `Tool "${call.name}" is not registered`,
            metadata: {
              input: call.input,
            },
          },
          finalDecision: "deny",
        },
        executionMode: "serial",
      };
    }

    const evaluation = this.permissionManager.evaluate(
      tool,
      call,
      session,
      workspaceRoot
    );
    return {
      call,
      evaluation,
      executionMode: evaluation.request.scope === "read" && evaluation.finalDecision === "allow"
        ? "parallel"
        : "serial",
    };
  }

  private buildToolExecutionBatches(
    session: KernelSession,
    calls: KernelToolCall[],
    workspaceRoot?: string
  ): ToolExecutionBatch[] {
    const batches: ToolExecutionBatch[] = [];
    let concurrentEntries: PreparedToolCall[] = [];

    for (const call of calls) {
      const prepared = this.prepareToolCall(session, call, workspaceRoot);
      if (prepared.executionMode === "parallel") {
        concurrentEntries.push(prepared);
        continue;
      }

      if (concurrentEntries.length > 0) {
        batches.push({ mode: "parallel", entries: concurrentEntries });
        concurrentEntries = [];
      }

      batches.push({ mode: "serial", entries: [prepared] });
    }

    if (concurrentEntries.length > 0) {
      batches.push({ mode: "parallel", entries: concurrentEntries });
    }

    return batches;
  }

  private async *executeToolCallsWithEvents(
    session: KernelSession,
    calls: KernelToolCall[],
    workspaceRoot?: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<KernelRunEvent, ToolExecutionOutcome[]> {
    const batches = this.buildToolExecutionBatches(session, calls, workspaceRoot);
    const outcomes: ToolExecutionOutcome[] = [];

    for (const batch of batches) {
      throwIfAborted(abortSignal);
      const batchPayload = {
        sessionId: session.id,
        mode: batch.mode,
        calls: batch.entries.map((entry) => entry.call),
      };
      this.emitTyped("tool.batch.started", batchPayload);
      yield { type: "tool.batch.started", ...batchPayload };

      if (batch.mode === "parallel") {
        for (const entry of batch.entries) {
          this.emitTyped("tool.started", { sessionId: session.id, call: entry.call });
          yield { type: "tool.started", sessionId: session.id, call: entry.call };
        }

        const settled = await Promise.all(
          batch.entries.map((entry) => this.executePreparedToolCall(session, entry, workspaceRoot, abortSignal))
        );

        for (const outcome of settled) {
          await this.finalizeToolOutcome(session, outcome.call, outcome.result);
          yield { type: "tool.completed", sessionId: session.id, call: outcome.call, result: outcome.result };
          outcomes.push(outcome);
        }
        continue;
      }

      for (const entry of batch.entries) {
        this.emitTyped("tool.started", { sessionId: session.id, call: entry.call });
        yield { type: "tool.started", sessionId: session.id, call: entry.call };

        const outcome = await this.executePreparedToolCall(session, entry, workspaceRoot, abortSignal);
        if (outcome.approval) {
          yield { type: "approval.recorded", sessionId: session.id, approval: outcome.approval };
        }

        await this.finalizeToolOutcome(session, outcome.call, outcome.result);
        yield { type: "tool.completed", sessionId: session.id, call: outcome.call, result: outcome.result };
        outcomes.push(outcome);
      }
    }

    return outcomes;
  }

  private async executePreparedToolCall(
    session: KernelSession,
    prepared: PreparedToolCall,
    workspaceRoot?: string,
    abortSignal?: AbortSignal
  ): Promise<ToolExecutionOutcome> {
    throwIfAborted(abortSignal);
    let { call, evaluation } = prepared;
    const tool = this.tools.get(call.name);

    if (!tool) {
      return {
        call,
        result: {
          success: false,
          error: `Tool "${call.name}" is not registered`,
        },
      };
    }

    const loopGuard = this.checkToolLoopGuard(session, call);
    if (loopGuard) {
      return {
        call,
        result: {
          success: false,
          error: loopGuard,
          summary: "Stopped repeated tool call",
        },
      };
    }

    const beforeHook = await this.hooks.trigger<KernelToolBeforeHookPayload>(HOOK_EVENTS.TOOL_BEFORE, {
      session,
      call,
      workspaceRoot,
      abortSignal,
    });
    throwIfAborted(abortSignal);

    if (beforeHook.call.id !== call.id || beforeHook.call.name !== call.name || beforeHook.call.input !== call.input) {
      call = beforeHook.call;
      evaluation = this.permissionManager.evaluate(tool, call, session, workspaceRoot);
    }

    if (beforeHook.skip) {
      return {
        call,
        result: beforeHook.result ?? {
          success: false,
          error: `Tool "${call.name}" was blocked by a pre-tool hook`,
        },
      };
    }

    await this.auditLogStore.logPermission(evaluation.request);

    let approval: KernelApprovalRecord | undefined;
    if (evaluation.finalDecision !== "allow") {
      approval = await this.recordApproval(session, call, evaluation.request, abortSignal);
      throwIfAborted(abortSignal);
      if (approval.decision === "denied") {
        return {
          call,
          approval,
          result: {
            success: false,
            error: approval.reason ?? `Tool "${call.name}" was denied by policy`,
          },
        };
      }
    }

    const result = await tool.execute(call.input, {
      session,
      workspaceRoot,
      abortSignal,
    });
    throwIfAborted(abortSignal);
    this.recordToolLoopOutcome(session, call, result);
    const afterHook = await this.hooks.trigger<KernelToolAfterHookPayload>(HOOK_EVENTS.TOOL_AFTER, {
      session,
      call,
      result,
    });

    return { call, result: afterHook.result, approval };
  }

  private checkToolLoopGuard(session: KernelSession, call: KernelToolCall): string | undefined {
    const signature = toolCallSignature(call);
    const state = getLoopGuardState(session);
    const seen = state.calls[signature] ?? 0;
    if (seen >= 3) {
      return `Repeated tool call blocked after ${seen} attempts: ${call.name}`;
    }
    if ((state.failures[signature] ?? 0) >= 2) {
      return `Repeated failing tool call blocked: ${call.name}`;
    }
    state.calls[signature] = seen + 1;
    return undefined;
  }

  private recordToolLoopOutcome(session: KernelSession, call: KernelToolCall, result: KernelToolResult): void {
    if (result.success) return;
    const signature = toolCallSignature(call);
    const state = getLoopGuardState(session);
    state.failures[signature] = (state.failures[signature] ?? 0) + 1;
  }

  private async finalizeToolOutcome(
    session: KernelSession,
    call: KernelToolCall,
    result: KernelToolResult
  ): Promise<void> {
    if (result.artifacts?.length) {
      session.artifacts.push(...result.artifacts);
    }

    await this.sessions.save(session);
    await this.sessions.appendEvent(session.id, "tool.completed", {
      call: call as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
    });
    this.emitTyped("tool.completed", { sessionId: session.id, call, result });
    await this.auditLogStore.logToolResult(session.id, call, result);
  }

  private async recordApproval(
    session: KernelSession,
    call: KernelToolCall,
    permissionRequest: PermissionRequest,
    abortSignal?: AbortSignal
  ): Promise<KernelApprovalRecord> {
    const resolved = permissionRequest.decision === "deny"
      ? {
          decision: "denied" as const,
          reason: "Denied by tool permission policy",
          source: "policy",
          resolver: "policy",
        }
      : await new PermissionResolverOrchestrator(this.approvalResolvers).resolve({
          session,
          tool: this.tools.get(call.name)!,
          toolCall: call,
          permissionRequest,
          abortSignal,
        }) ?? {
          decision: "denied" as const,
          reason: `No approval resolver configured for "${call.name}"`,
          source: "default",
          resolver: "default",
        };

    const approval: KernelApprovalRecord = {
      id: randomUUID(),
      toolCallId: call.id,
      toolName: call.name,
      decision: resolved.decision,
      reason: resolved.reason,
      source: resolved.source,
      resolver: resolved.resolver,
      createdAt: Date.now(),
      input: call.input,
    };
    session.approvals.push(approval);
    await this.sessions.save(session);
    await this.sessions.appendEvent(session.id, "approval.recorded", {
      approval: approval as unknown as Record<string, unknown>,
    });
    this.emitTyped("approval.recorded", { sessionId: session.id, approval });
    await this.auditLogStore.logApproval(session.id, approval);
    return approval;
  }

  private async *streamCompletionEvents(
    session: KernelSession,
    options: Omit<KernelRunOptions, "systemPrompt"> & { systemPrompt?: string },
    assistantMessageId: string
  ): AsyncGenerator<KernelRunEvent, KernelCompletionResponse> {
    if (!(options.stream && this.completionProvider?.stream)) {
      return this.completionProvider!.complete({
        session,
        messages: session.messages,
        tools: this.tools.list(),
        systemPrompt: options.systemPrompt,
        abortSignal: options.abortSignal,
      });
    }

    const chunks: string[] = [];
    const toolCalls: KernelToolCall[] = [];
    const queue = createAsyncQueue<KernelRunEvent>();
    const responsePromise = this.completionProvider!.stream!(
      {
        session,
        messages: session.messages,
        tools: this.tools.list(),
        systemPrompt: options.systemPrompt,
        abortSignal: options.abortSignal,
      },
      (chunk) => {
        if (options.abortSignal?.aborted) return;
        if (chunk.type === "text" && chunk.text) {
          chunks.push(chunk.text);
          queue.push({
            type: "assistant.delta",
            sessionId: session.id,
            messageId: assistantMessageId,
            text: chunk.text,
          });
        }
        if (chunk.type === "tool_call" && chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          queue.push({ type: "assistant.tool_call", sessionId: session.id, call: chunk.toolCall });
        }
      }
    )
      .then((response) => ({
        ...response,
        content: response.content || chunks.join(""),
        toolCalls: response.toolCalls ?? toolCalls,
      }))
      .finally(() => {
        queue.close();
      });

    for await (const event of queue.iterate()) {
      yield event;
    }

    return await responsePromise;
  }

  private async requireSession(sessionId: string): Promise<KernelSession> {
    const session = await this.sessions.load(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  private resolveWorkspaceRoot(session: KernelSession, requested?: string): string {
    return requested
      ?? session.worktree.path
      ?? readStringMetadata(session.metadata.workspaceRoot)
      ?? process.cwd();
  }

  private async saveAndEmitMessage(session: KernelSession, message: KernelMessage): Promise<void> {
    const hookEvent = message.role === "assistant" || message.role === "tool"
      ? HOOK_EVENTS.MESSAGE_RECEIVE
      : HOOK_EVENTS.MESSAGE_SEND;
    const hookPayload = await this.hooks.trigger<KernelMessageHookPayload>(hookEvent, {
      session,
      message,
    });

    if (hookPayload.message !== message) {
      Object.assign(message, hookPayload.message);
    }
    await this.sessions.save(session);
    await this.sessions.appendEvent(session.id, "message.created", {
      message: message as unknown as Record<string, unknown>,
    });
    this.emitTyped("message.created", { sessionId: session.id, message });
    this.emitTyped("session.updated", session);
  }

  private createHookPermissionResolver(): PermissionResolver {
    return {
      name: "hook",
      resolve: async ({ session, toolCall, permissionRequest }) => {
        const payload = await this.hooks.trigger<KernelPermissionHookPayload>(
          HOOK_EVENTS.PERMISSION_RESOLVE,
          {
            session,
            call: toolCall,
            permissionRequest,
          }
        );

        if (!payload.decision) {
          return null;
        }

        return {
          decision: payload.decision.decision,
          reason: payload.decision.reason,
          source: payload.decision.source ?? "hook",
          resolver: payload.decision.resolver ?? "hook",
        };
      },
    };
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

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  const error = new Error("EchoAI operation was cancelled");
  error.name = "AbortError";
  throw error;
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

function createAsyncQueue<T>() {
  const values: T[] = [];
  const waiters: Array<(value: IteratorResult<T>) => void> = [];
  let closed = false;

  return {
    push(value: T): void {
      if (closed) {
        return;
      }

      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value, done: false });
        return;
      }

      values.push(value);
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;

      while (waiters.length > 0) {
        waiters.shift()?.({ value: undefined as T, done: true });
      }
    },
    async *iterate(): AsyncGenerator<T> {
      while (true) {
        if (values.length > 0) {
          yield values.shift() as T;
          continue;
        }

        if (closed) {
          return;
        }

        const nextValue = await new Promise<IteratorResult<T>>((resolve) => {
          waiters.push(resolve);
        });

        if (nextValue.done) {
          return;
        }

        yield nextValue.value;
      }
    },
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

async function createIsolatedWorkspace(sourceWorkspace: string, sessionId: string): Promise<string> {
  const targetRoot = path.join(os.tmpdir(), "echoai-worktrees");
  const targetPath = path.join(targetRoot, sessionId);
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(sourceWorkspace, targetPath, {
    recursive: true,
    filter: (entry) => {
      const base = path.basename(entry);
      return !["node_modules", ".git", "dist", "coverage"].includes(base);
    },
  });
  return targetPath;
}

function readStringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toolCallSignature(call: KernelToolCall): string {
  return `${call.name}:${stableJson(call.input)}`;
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function getLoopGuardState(session: KernelSession): { calls: Record<string, number>; failures: Record<string, number> } {
  const existing = session.metadata.loopGuard;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    const state = existing as { calls?: Record<string, number>; failures?: Record<string, number> };
    state.calls ??= {};
    state.failures ??= {};
    return state as { calls: Record<string, number>; failures: Record<string, number> };
  }
  const state = { calls: {}, failures: {} };
  session.metadata.loopGuard = state;
  return state;
}

function createShellTaskTool(): KernelTool {
  return {
    name: "run_shell_task",
    description: "Run a background shell command inside the workspace",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
      },
      required: ["command"],
    },
    permission: { process: "ask" },
    async execute() {
      return { success: true };
    },
  };
}

function isManagedTaskRecord(
  task: KernelTaskRecord,
  expected: { logPath: string; statusPath: string; runnerPath: string }
): boolean {
  const logPath = readTaskLogPath(task);
  const statusPath = typeof task.metadata?.statusPath === "string" ? task.metadata.statusPath : undefined;
  const runnerPath = typeof task.metadata?.runnerPath === "string" ? task.metadata.runnerPath : undefined;

  return path.resolve(logPath ?? "") === path.resolve(expected.logPath)
    && path.resolve(statusPath ?? "") === path.resolve(expected.statusPath)
    && path.resolve(runnerPath ?? "") === path.resolve(expected.runnerPath);
}
