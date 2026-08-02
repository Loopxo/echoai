import { randomUUID } from 'node:crypto';
import {
  AgentKernel,
  AuditLogStore,
  RuntimePermissionManager,
  SessionRegistry,
  type KernelRunEvent,
  type KernelSession,
} from '@echoai/runtime';
import type {
  DesktopRuntimeEvent,
  DesktopRuntimeRunHandle,
  DesktopRuntimeRunRequest,
  DesktopRuntimeSessionSummary,
  DesktopRuntimeStatus,
} from '@shared/ipc';
import type { DesktopLogger } from './logger';
import { DesktopProviderCatalog } from './desktop-completion-provider';
import { getSharedMcpRuntime, type McpRuntime } from './mcp-runtime';

type RuntimeEventSink = (event: DesktopRuntimeEvent) => void;

interface ActiveRun {
  controller: AbortController;
  startedAt: string;
}

export class DesktopRuntimeService {
  private readonly kernel: AgentKernel;
  private readonly providers: DesktopProviderCatalog;
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly mcpRuntime: McpRuntime;
  private readonly unsubscribeMcp: () => void;
  private registeredMcpToolNames: string[] = [];

  constructor(
    stateDir: string,
    private readonly logger: DesktopLogger,
    private readonly emitEvent: RuntimeEventSink,
    providers = new DesktopProviderCatalog(),
    mcpRuntime: McpRuntime = getSharedMcpRuntime()
  ) {
    this.providers = providers;
    this.mcpRuntime = mcpRuntime;
    const registryOptions = { stateDir, namespace: 'desktop' };
    this.kernel = new AgentKernel({
      completionProvider: this.providers.completionProvider,
      sessionRegistry: new SessionRegistry(registryOptions),
      auditLogStore: new AuditLogStore(registryOptions),
      permissionManager: new RuntimePermissionManager({
        profile: { read: 'allow', write: 'ask', process: 'ask', network: 'ask' },
      }),
      autoCompactMessages: 30,
    });

    // `AgentKernel.tools` is a live `ToolRegistry`, so MCP tools can be swapped in
    // and out after construction; the kernel reads it at each turn. The runtime
    // pushes a change notification whenever servers start, stop, or fail.
    this.unsubscribeMcp = this.mcpRuntime.onToolsChanged(() => {
      this.refreshMcpTools();
    });
    this.refreshMcpTools();
  }

  /**
   * Replaces the registered MCP tools with whatever the runtime currently has
   * discovered. Removal is name-based because the registry is keyed by tool name.
   */
  refreshMcpTools(): number {
    for (const name of this.registeredMcpToolNames) {
      this.kernel.tools.unregister(name);
    }

    const tools = this.mcpRuntime.listKernelTools();
    for (const tool of tools) {
      this.kernel.tools.register(tool);
    }
    this.registeredMcpToolNames = tools.map((tool) => tool.name);
    return tools.length;
  }

  listMcpToolNames(): string[] {
    return [...this.registeredMcpToolNames];
  }

  async dispose(): Promise<void> {
    this.unsubscribeMcp();
    for (const run of this.activeRuns.values()) {
      run.controller.abort();
    }
    this.activeRuns.clear();
    await this.mcpRuntime.stop();
  }

  async getStatus(): Promise<DesktopRuntimeStatus> {
    const sessions = await this.kernel.listSessions();
    const defaultProvider = this.providers.getDefault();
    return {
      activeRuns: this.activeRuns.size,
      sessionCount: sessions.length,
      provider: defaultProvider.provider,
      model: defaultProvider.model,
      providers: this.providers.list(),
    };
  }

  async listSessions(): Promise<DesktopRuntimeSessionSummary[]> {
    const sessions = await this.kernel.listSessions();
    return sessions.map(toSessionSummary);
  }

  async createSession(title: string): Promise<DesktopRuntimeSessionSummary> {
    const defaultProvider = this.providers.getDefault();
    const session = await this.kernel.createSession(
      title.trim() || 'Desktop session',
      defaultProvider.provider,
      defaultProvider.model
    );
    return toSessionSummary(session);
  }

  async getSession(sessionId: string): Promise<DesktopRuntimeSessionSummary | null> {
    const session = await this.kernel.getSession(sessionId);
    return session ? toSessionSummary(session) : null;
  }

  async exportSession(sessionId: string): Promise<string> {
    return this.kernel.sessions.exportSession(sessionId, {
      includeApprovals: true,
      includeMetadata: true,
      includeTasks: true,
    });
  }

  async runPrompt(request: DesktopRuntimeRunRequest): Promise<DesktopRuntimeRunHandle> {
    if (!request.input.trim()) {
      throw new Error('Prompt is required');
    }

    const runId = randomUUID();
    const controller = new AbortController();
    this.activeRuns.set(runId, {
      controller,
      startedAt: new Date().toISOString(),
    });

    void this.runPromptInBackground(runId, request, controller);
    return { runId };
  }

  cancelRun(runId: string): boolean {
    const run = this.activeRuns.get(runId);
    if (!run) {
      return false;
    }

    run.controller.abort();
    this.activeRuns.delete(runId);
    this.emitEvent({
      runId,
      type: 'run.cancelled',
      sessionId: null,
      createdAt: new Date().toISOString(),
      payload: { startedAt: run.startedAt },
    });
    return true;
  }

  private async runPromptInBackground(
    runId: string,
    request: DesktopRuntimeRunRequest,
    controller: AbortController
  ): Promise<void> {
    try {
      const selection = this.providers.resolve(request.provider, request.model);
      for await (const event of this.kernel.runEvents({
        sessionId: request.sessionId,
        title: 'Desktop session',
        input: request.input,
        workspaceRoot: request.workspaceRoot,
        mode: request.mode,
        provider: selection.provider,
        model: selection.model,
        stream: true,
        abortSignal: controller.signal,
      })) {
        this.emitEvent(toRuntimeEvent(runId, event));
      }
    } catch (error) {
      this.logger.error('desktop runtime run failed', error);
      this.emitEvent({
        runId,
        type: 'run.failed',
        sessionId: request.sessionId ?? null,
        createdAt: new Date().toISOString(),
        payload: { error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      this.activeRuns.delete(runId);
    }
  }
}

function toSessionSummary(session: KernelSession): DesktopRuntimeSessionSummary {
  return {
    id: session.id,
    title: session.title,
    provider: session.provider ?? null,
    model: session.model ?? null,
    mode: session.mode,
    messageCount: session.messages.length,
    artifactCount: session.artifacts.length,
    updatedAt: session.updatedAt,
  };
}

function toRuntimeEvent(runId: string, event: KernelRunEvent): DesktopRuntimeEvent {
  return {
    runId,
    type: event.type,
    sessionId: 'sessionId' in event && typeof event.sessionId === 'string' ? event.sessionId : null,
    createdAt: new Date().toISOString(),
    payload: event,
  };
}
