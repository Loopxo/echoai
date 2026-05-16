import { randomUUID } from 'node:crypto';
import {
  AgentKernel,
  AuditLogStore,
  RuntimePermissionManager,
  SessionRegistry,
  type KernelCompletionProvider,
  type KernelCompletionRequest,
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

type RuntimeEventSink = (event: DesktopRuntimeEvent) => void;

interface ActiveRun {
  controller: AbortController;
  startedAt: string;
}

export class DesktopRuntimeService {
  private readonly kernel: AgentKernel;
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(
    stateDir: string,
    private readonly logger: DesktopLogger,
    private readonly emitEvent: RuntimeEventSink
  ) {
    const registryOptions = { stateDir, namespace: 'desktop' };
    this.kernel = new AgentKernel({
      completionProvider: createDesktopCompletionProvider(),
      sessionRegistry: new SessionRegistry(registryOptions),
      auditLogStore: new AuditLogStore(registryOptions),
      permissionManager: new RuntimePermissionManager({
        profile: { read: 'allow', write: 'ask', process: 'ask', network: 'ask' },
      }),
      autoCompactMessages: 30,
    });
  }

  async getStatus(): Promise<DesktopRuntimeStatus> {
    const sessions = await this.kernel.listSessions();
    return {
      activeRuns: this.activeRuns.size,
      sessionCount: sessions.length,
      provider: 'desktop',
      model: 'echoai-local',
    };
  }

  async listSessions(): Promise<DesktopRuntimeSessionSummary[]> {
    const sessions = await this.kernel.listSessions();
    return sessions.map(toSessionSummary);
  }

  async createSession(title: string): Promise<DesktopRuntimeSessionSummary> {
    const session = await this.kernel.createSession(title.trim() || 'Desktop session', 'desktop', 'echoai-local');
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
      for await (const event of this.kernel.runEvents({
        sessionId: request.sessionId,
        title: 'Desktop session',
        input: request.input,
        workspaceRoot: request.workspaceRoot,
        mode: request.mode,
        provider: request.provider ?? 'desktop',
        model: request.model ?? 'echoai-local',
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

function createDesktopCompletionProvider(): KernelCompletionProvider {
  return {
    async complete(request) {
      return {
        content: buildDesktopResponse(request),
        metadata: { provider: 'desktop', model: 'echoai-local' },
      };
    },
    async stream(request, onChunk) {
      const content = buildDesktopResponse(request);
      for (const chunk of content.match(/.{1,48}/g) ?? [content]) {
        if (request.abortSignal?.aborted) {
          throw new Error('Run cancelled');
        }
        onChunk({ type: 'text', text: chunk });
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      onChunk({ type: 'done' });
      return {
        content,
        metadata: { provider: 'desktop', model: 'echoai-local' },
      };
    },
  };
}

function buildDesktopResponse(request: KernelCompletionRequest): string {
  const latestUserMessage = [...request.messages].reverse().find((message) => message.role === 'user');
  const prompt = latestUserMessage?.content.trim() || 'No prompt provided.';
  return `EchoAI desktop runtime is connected.\n\n${prompt}`;
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
