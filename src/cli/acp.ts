import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { Command } from 'commander';
import {
  AgentSideConnection,
  PROTOCOL_VERSION,
  RequestError,
  ndJsonStream,
  type Agent,
  type AgentSideConnection as AcpClient,
  type AuthenticateRequest,
  type AuthenticateResponse,
  type CancelNotification,
  type ContentBlock,
  type InitializeRequest,
  type InitializeResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type LoadSessionResponse,
  type McpServer,
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type SessionInfo,
  type SessionModeState,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type ToolCallContent,
  type ToolCallLocation,
  type ToolKind,
} from '@agentclientprotocol/sdk';
import {
  AgentKernel,
  AuditLogStore,
  RuntimePermissionManager,
  SessionRegistry,
  type KernelArtifact,
  type KernelRunEvent,
  type KernelSession,
  type KernelToolCall,
  type KernelToolResult,
} from '@echoai/runtime';
import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { createCompletionProvider, registerConfiguredMcpTools } from '../runtime/cli-kernel.js';
import type { MCPServer } from '../types/mcp.js';

export interface AcpAgentOptions {
  workspaceRoot: string;
}

const modes: SessionModeState = {
  currentModeId: 'default',
  availableModes: [
    {
      id: 'default',
      name: 'Build',
      description: 'Plan, edit, test, review, and summarize coding work.',
    },
    {
      id: 'plan',
      name: 'Plan',
      description: 'Inspect and plan without making file or shell changes.',
    },
  ],
};

export const acpCommand = new Command('acp')
  .description('Start the EchoAI Agent Client Protocol server')
  .option('--stdio', 'Serve ACP over newline-delimited JSON stdio', true)
  .option('--capabilities', 'Print ACP server capabilities and exit')
  .action(async (options) => {
    if (options.capabilities) {
      console.log(JSON.stringify(createAcpCapabilities(), null, 2));
      return;
    }
    await serveAcpStdio({
      workspaceRoot: process.cwd(),
    });
  });

export async function serveAcpStdio(options: AcpAgentOptions): Promise<void> {
  const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  let agent: EchoAcpAgent | undefined;
  const connection = new AgentSideConnection(
    (client) => {
      agent = new EchoAcpAgent(client, options);
      return agent;
    },
    ndJsonStream(output, input)
  );
  try {
    await connection.closed;
  } finally {
    agent?.shutdown();
  }
}

export class EchoAcpAgent implements Agent {
  private readonly client: AcpClient;
  private readonly sessions = new SessionRegistry({ namespace: 'runtime' });
  private readonly workspaceRoot: string;
  private readonly cancelled = new Set<string>();
  private readonly activeRuns = new Map<string, AbortController>();
  private readonly sessionMcpServers = new Map<string, McpServer[]>();

  constructor(client: AcpClient, options: AcpAgentOptions) {
    this.client = client;
    this.workspaceRoot = options.workspaceRoot;
  }

  shutdown(): void {
    for (const controller of this.activeRuns.values()) {
      if (controller.signal.aborted) continue;
      const error = new Error('EchoAI ACP connection closed');
      error.name = 'AbortError';
      controller.abort(error);
    }
    this.activeRuns.clear();
    this.sessionMcpServers.clear();
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    const authMethods: InitializeResponse['authMethods'] = params.clientCapabilities?.auth?.terminal
      ? [
          {
            id: 'echoai-login',
            type: 'terminal',
            name: 'EchoAI Login',
            description: 'Connect EchoAI Cloud credits with the bundled terminal login flow.',
            args: ['login'],
          },
        ]
      : [];

    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: {
        name: 'EchoAI',
        version: readVersion(),
      },
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          embeddedContext: true,
        },
        mcpCapabilities: {
          http: true,
          sse: true,
        },
        sessionCapabilities: {
          list: {},
        },
      },
      authMethods,
    };
  }

  async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse | void> {
    if (params.methodId !== 'echoai-login') {
      throw RequestError.invalidParams({ methodId: params.methodId }, 'Unsupported EchoAI authentication method');
    }
    return {};
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    rejectAdditionalDirectories(params.additionalDirectories);
    const cwd = resolveAcpWorkspaceRoot(params.cwd, this.workspaceRoot);
    const config = await new ConfigManager().getConfig();
    const session = await this.sessions.create('ACP Session');
    const requestedRouting = readEchoRoutingMeta(params._meta);
    session.provider = requestedRouting.provider || config.defaults.provider;
    session.model = requestedRouting.model || config.defaults.model;
    session.metadata.provider = session.provider;
    session.metadata.model = session.model;
    session.metadata.workspaceRoot = cwd;
    session.metadata.mcpServerNames = params.mcpServers.map((server) => server.name);
    delete session.metadata.additionalDirectories;
    delete session.metadata.mcpServers;
    this.sessionMcpServers.set(session.id, params.mcpServers);
    await this.sessions.save(session);
    await this.safeSessionUpdate({
      sessionId: session.id,
      update: {
        sessionUpdate: 'session_info_update',
        title: session.title,
        updatedAt: new Date(session.updatedAt).toISOString(),
        _meta: echoSessionMeta(session),
      },
    });
    return {
      _meta: echoSessionMeta(session),
      sessionId: session.id,
      modes: modeState(session),
    };
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    rejectAdditionalDirectories(params.additionalDirectories);
    const session = await this.loadRequiredSession(params.sessionId);
    const persistedWorkspaceRoot = resolveAcpWorkspaceRoot(
      readStringMetadata(session, 'workspaceRoot') ?? this.workspaceRoot,
      this.workspaceRoot,
    );
    const cwd = resolveAcpWorkspaceRoot(params.cwd ?? persistedWorkspaceRoot, this.workspaceRoot);
    const config = await new ConfigManager().getConfig();
    session.provider = session.provider || readStringMetadata(session, 'provider') || config.defaults.provider;
    session.model = session.model || readStringMetadata(session, 'model') || config.defaults.model;
    session.metadata.provider = session.provider;
    session.metadata.model = session.model;
    session.metadata.workspaceRoot = cwd;
    session.metadata.mcpServerNames = params.mcpServers.map((server) => server.name);
    delete session.metadata.additionalDirectories;
    delete session.metadata.mcpServers;
    this.sessionMcpServers.set(session.id, params.mcpServers);
    await this.sessions.save(session);
    await this.replaySession(session);
    return {
      _meta: echoSessionMeta(session),
      modes: modeState(session),
    };
  }

  async listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
    rejectAdditionalDirectories(params.additionalDirectories);
    const requestedCwd = params.cwd
      ? resolveAcpWorkspaceRoot(params.cwd, this.workspaceRoot)
      : undefined;
    const sessions = await this.sessions.list();
    const scoped = sessions.flatMap((session) => {
      const storedWorkspaceRoot = typeof session.metadata.workspaceRoot === 'string'
        ? session.metadata.workspaceRoot
        : this.workspaceRoot;
      try {
        const cwd = resolveAcpWorkspaceRoot(storedWorkspaceRoot, this.workspaceRoot);
        return !requestedCwd || cwd === requestedCwd ? [{ session, cwd }] : [];
      } catch {
        return [];
      }
    });
    const offset = decodeSessionCursor(params.cursor);
    const pageSize = 50;
    const page = scoped.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    return {
      sessions: page.map(({ session, cwd }): SessionInfo => ({
        _meta: echoSessionMeta(session),
        sessionId: session.id,
        title: session.title,
        cwd,
        updatedAt: new Date(session.updatedAt).toISOString(),
      })),
      nextCursor: nextOffset < scoped.length ? encodeSessionCursor(nextOffset) : null,
    };
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
    if (this.activeRuns.has(params.sessionId)) {
      throw RequestError.invalidParams(
        { sessionId: params.sessionId },
        'Cancel the active EchoAI turn before changing session mode',
      );
    }

    const session = await this.loadRequiredSession(params.sessionId);
    if (params.modeId !== 'default' && params.modeId !== 'plan') {
      throw RequestError.invalidParams({ modeId: params.modeId }, 'Unsupported EchoAI session mode');
    }
    session.mode = params.modeId;
    await this.sessions.save(session);
    await this.safeSessionUpdate({
      sessionId: session.id,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: session.mode,
      },
    });
    return {};
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    if (this.activeRuns.has(params.sessionId)) {
      throw RequestError.invalidParams(
        { sessionId: params.sessionId },
        'An EchoAI turn is already active for this session',
      );
    }

    this.cancelled.delete(params.sessionId);
    const runController = new AbortController();
    this.activeRuns.set(params.sessionId, runController);
    let userMessageId = params.messageId ?? undefined;

    try {
      const session = await this.loadRequiredSession(params.sessionId);
      const promptText = contentBlocksToText(params.prompt).trim();

      // A model switch in the client applies from the next turn onward, so routing
      // is re-read per prompt and persisted onto the session.
      const requestedRouting = readEchoRoutingMeta(params._meta);
      if (requestedRouting.provider || requestedRouting.model) {
        let routingChanged = false;
        if (requestedRouting.provider && requestedRouting.provider !== session.provider) {
          session.provider = requestedRouting.provider;
          session.metadata.provider = requestedRouting.provider;
          routingChanged = true;
        }
        if (requestedRouting.model && requestedRouting.model !== session.model) {
          session.model = requestedRouting.model;
          session.metadata.model = requestedRouting.model;
          routingChanged = true;
        }
        if (routingChanged) {
          await this.sessions.save(session);
          await this.safeSessionUpdate({
            sessionId: session.id,
            update: {
              sessionUpdate: 'session_info_update',
              title: session.title,
              updatedAt: new Date(session.updatedAt).toISOString(),
              _meta: echoSessionMeta(session),
            },
          });
        }
      }

      if (runController.signal.aborted || this.cancelled.has(session.id)) {
        return { stopReason: 'cancelled', userMessageId: userMessageId ?? null };
      }

      userMessageId ??= randomUUID();
      const modelBacked = await this.runModelBackedTurn(
        session,
        promptText,
        userMessageId,
        runController.signal,
      );
      return {
        ...modelBacked,
        userMessageId,
      };
    } catch (error) {
      if (runController.signal.aborted || this.cancelled.has(params.sessionId)) {
        return { stopReason: 'cancelled', userMessageId: userMessageId ?? null };
      }
      throw error;
    } finally {
      if (this.activeRuns.get(params.sessionId) === runController) {
        this.activeRuns.delete(params.sessionId);
      }
      this.cancelled.delete(params.sessionId);
    }
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.cancelled.add(params.sessionId);
    const controller = this.activeRuns.get(params.sessionId);
    if (controller && !controller.signal.aborted) {
      const error = new Error('EchoAI ACP turn cancelled');
      error.name = 'AbortError';
      controller.abort(error);
    }
  }

  private async runModelBackedTurn(
    session: KernelSession,
    promptText: string,
    userMessageId: string,
    abortSignal: AbortSignal,
  ): Promise<PromptResponse> {
    const workspaceRoot = resolveAcpWorkspaceRoot(
      typeof session.metadata.workspaceRoot === 'string'
        ? session.metadata.workspaceRoot
        : this.workspaceRoot,
      this.workspaceRoot,
    );
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    const config = await configManager.getConfig();
    const providerName = session.provider || readStringMetadata(session, 'provider') || config.defaults.provider;
    const modelName = session.model || readStringMetadata(session, 'model') || config.defaults.model;
    if (!providerName) {
      throw new Error('No EchoAI provider is configured for this ACP session.');
    }

    const provider = await providerManager.getProvider(providerName);
    const kernel = new AgentKernel({
      sessionRegistry: new SessionRegistry({ namespace: 'runtime' }),
      auditLogStore: new AuditLogStore({ namespace: 'runtime' }),
      completionProvider: createCompletionProvider(provider, {
        model: modelName,
        temperature: config.defaults.temperature,
        maxTokens: config.defaults.maxTokens,
        stream: true,
      }),
      permissionManager: new RuntimePermissionManager({
        profile: session.mode === 'plan'
          ? { read: 'allow', write: 'deny', process: 'deny', network: 'ask' }
          : undefined,
      }),
      approvalResolver: async ({ session: runtimeSession, toolCall, permissionRequest, abortSignal: permissionSignal }) => {
        return this.resolveAcpPermission(
          runtimeSession.id,
          toolCall,
          permissionRequest,
          permissionSignal,
        );
      },
    });
    const mcpManager = await registerConfiguredMcpTools(kernel, {
      servers: toRuntimeMcpServers(this.sessionMcpServers.get(session.id) ?? []),
      abortSignal,
    });
    const streamedMessageIds = new Set<string>();

    try {
      for await (const event of kernel.runEvents({
        sessionId: session.id,
        title: session.title,
        input: promptText,
        userMessageId,
        provider: providerName,
        model: modelName,
        mode: session.mode,
        workspaceRoot,
        stream: true,
        abortSignal,
      })) {
        if (abortSignal.aborted || this.cancelled.has(session.id)) {
          return {
            stopReason: 'cancelled',
            userMessageId,
          };
        }
        await this.handleKernelEvent(event, streamedMessageIds);
      }

      return {
        stopReason: this.cancelled.has(session.id) ? 'cancelled' : 'end_turn',
        userMessageId,
      };
    } finally {
      await mcpManager.shutdown();
    }
  }

  private async handleKernelEvent(
    event: KernelRunEvent,
    streamedMessageIds: Set<string>,
  ): Promise<void> {
    switch (event.type) {
      case 'run.started':
        await this.safeSessionUpdate({
          sessionId: event.session.id,
          update: {
            sessionUpdate: 'session_info_update',
            title: event.session.title,
            updatedAt: new Date(event.session.updatedAt).toISOString(),
            _meta: echoSessionMeta(event.session),
          },
        });
        return;
      case 'message.created':
        if (event.message.role === 'user') {
          await this.emitMessage(event.sessionId, 'user_message_chunk', event.message.content, event.message.id);
          return;
        }
        if (event.message.role === 'assistant' && !streamedMessageIds.has(event.message.id)) {
          await this.emitMessage(event.sessionId, 'agent_message_chunk', event.message.content, event.message.id);
        }
        return;
      case 'assistant.delta':
        streamedMessageIds.add(event.messageId);
        await this.emitMessage(event.sessionId, 'agent_message_chunk', event.text, event.messageId);
        return;
      case 'assistant.tool_call':
        await this.emitToolCall(event.sessionId, event.call, 'pending');
        return;
      case 'tool.started':
        await this.emitToolCallUpdate(event.sessionId, event.call.id, {
          status: 'in_progress',
        });
        return;
      case 'tool.completed':
        await this.emitToolCallUpdate(event.sessionId, event.call.id, {
          status: event.result.success ? 'completed' : 'failed',
          rawOutput: event.result,
          locations: inferToolLocations(event.call, event.result.artifacts),
          content: toolResultContent(event.result),
        });
        return;
      case 'approval.recorded':
        await this.emitToolCallUpdate(
          event.sessionId,
          event.approval.toolCallId ?? event.approval.id,
          {
            title: `${event.approval.toolName} ${event.approval.decision}`,
            status: event.approval.decision === 'approved' ? 'in_progress' : 'failed',
            rawOutput: event.approval,
          },
        );
        return;
      case 'session.compacted':
      case 'tool.batch.started':
      case 'run.completed':
        return;
    }
  }

  private async emitToolCall(sessionId: string, call: KernelToolCall, status: 'pending' | 'in_progress' | 'completed' | 'failed'): Promise<void> {
    await this.safeSessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: call.id,
        title: call.name,
        kind: inferToolKind(call.name),
        rawInput: call.input,
        locations: inferToolLocations(call),
        status,
      },
    });
  }

  private async emitToolCallUpdate(
    sessionId: string,
    toolCallId: string,
    update: {
      title?: string;
      status?: 'pending' | 'in_progress' | 'completed' | 'failed';
      rawOutput?: unknown;
      locations?: ToolCallLocation[];
      content?: ToolCallContent[];
    },
  ): Promise<void> {
    await this.safeSessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        ...update,
      },
    });
  }

  private async resolveAcpPermission(
    sessionId: string,
    toolCall: KernelToolCall,
    permissionRequest: { reason: string; risk: string; resource?: string },
    abortSignal?: AbortSignal,
  ): Promise<{ decision: 'approved' | 'denied'; reason?: string }> {
    if (abortSignal?.aborted || this.cancelled.has(sessionId)) {
      return { decision: 'denied', reason: 'The ACP run was cancelled.' };
    }

    try {
      const response = await raceWithAbort(this.client.requestPermission({
        sessionId,
        toolCall: {
          toolCallId: toolCall.id,
          title: toolCall.name,
          status: 'pending',
          rawInput: toolCall.input,
          locations: permissionRequest.resource ? [{ path: permissionRequest.resource }] : undefined,
        },
        options: [
          { optionId: 'allow_once', kind: 'allow_once', name: 'Allow once' },
          { optionId: 'reject_once', kind: 'reject_once', name: 'Reject once' },
        ],
      }), abortSignal);
      if (abortSignal?.aborted || this.cancelled.has(sessionId)) {
        return { decision: 'denied', reason: 'The ACP run was cancelled.' };
      }
      return response.outcome.outcome === 'selected' && response.outcome.optionId === 'allow_once'
        ? { decision: 'approved', reason: permissionRequest.reason }
        : { decision: 'denied', reason: permissionRequest.reason };
    } catch {
      return {
        decision: 'denied',
        reason: abortSignal?.aborted
          ? 'The ACP run was cancelled.'
          : `ACP client did not approve ${toolCall.name}`,
      };
    }
  }

  private async replaySession(session: KernelSession): Promise<void> {
    const events = await this.sessions.readEventLog(session.id);
    const emittedMessages = new Set<string>();
    const emittedTools = new Set<string>();
    const latestCompactionIndex = events.reduce(
      (latest, event, index) => event.type === 'session.compacted' ? index : latest,
      -1,
    );
    const retainedMessageIds = latestCompactionIndex >= 0
      ? new Set(session.messages.map((message) => message.id))
      : undefined;

    for (const [eventIndex, event] of events.entries()) {
      if (event.type === 'message.created') {
        const message = readPersistedMessage(event.payload.message);
        if (!message || emittedMessages.has(message.id)) continue;
        if (retainedMessageIds && !retainedMessageIds.has(message.id)) continue;
        if (message.role === 'assistant' || message.role === 'user') {
          emittedMessages.add(message.id);
          await this.emitMessage(
            session.id,
            message.role === 'assistant' ? 'agent_message_chunk' : 'user_message_chunk',
            message.content,
            message.id,
          );
        }
        continue;
      }

      if (event.type === 'session.compacted') {
        // Only the latest snapshot is authoritative. Earlier compactions may
        // contain messages removed by a later compaction.
        if (eventIndex !== latestCompactionIndex) continue;
        const messages = Array.isArray(event.payload.messages) ? event.payload.messages : [];
        for (const value of messages) {
          const message = readPersistedMessage(value);
          if (!message || emittedMessages.has(message.id)) continue;
          if (retainedMessageIds && !retainedMessageIds.has(message.id)) continue;
          if (message.role === 'assistant' || message.role === 'user') {
            emittedMessages.add(message.id);
            await this.emitMessage(
              session.id,
              message.role === 'assistant' ? 'agent_message_chunk' : 'user_message_chunk',
              message.content,
              message.id,
            );
          }
        }
        continue;
      }

      if (event.type === 'approval.recorded') {
        const approval = readPersistedApproval(event.payload.approval);
        if (!approval) continue;
        const callId = approval.toolCallId ?? approval.id;
        if (!emittedTools.has(callId)) {
          emittedTools.add(callId);
          await this.emitToolCall(session.id, {
            id: callId,
            name: approval.toolName,
            input: approval.input,
          }, 'pending');
        }
        await this.emitToolCallUpdate(session.id, callId, {
          title: `${approval.toolName} ${approval.decision}`,
          status: approval.decision === 'approved' ? 'in_progress' : 'failed',
          rawOutput: approval,
        });
        continue;
      }

      if (event.type === 'tool.completed') {
        const call = readPersistedToolCall(event.payload.call);
        const result = readPersistedToolResult(event.payload.result);
        if (!call || !result) continue;
        if (!emittedTools.has(call.id)) {
          emittedTools.add(call.id);
          await this.emitToolCall(session.id, call, 'in_progress');
        }
        await this.emitToolCallUpdate(session.id, call.id, {
          status: result.success ? 'completed' : 'failed',
          rawOutput: result,
          locations: inferToolLocations(call, result.artifacts),
          content: toolResultContent(result),
        });
      }
    }

    // Older sessions may predate the JSONL event log. The reconstructed
    // session snapshot is also the authority after compaction.
    for (const message of session.messages) {
      if (emittedMessages.has(message.id)) continue;
      if (message.role === 'assistant' || message.role === 'user') {
        emittedMessages.add(message.id);
        await this.emitMessage(
          session.id,
          message.role === 'assistant' ? 'agent_message_chunk' : 'user_message_chunk',
          message.content,
          message.id,
        );
      }
    }
  }

  private async loadRequiredSession(sessionId: string): Promise<KernelSession> {
    const session = await this.sessions.load(sessionId);
    if (!session) {
      throw RequestError.resourceNotFound(`session:${sessionId}`);
    }
    resolveAcpWorkspaceRoot(
      readStringMetadata(session, 'workspaceRoot') ?? this.workspaceRoot,
      this.workspaceRoot,
    );
    return session;
  }

  private async emitMessage(
    sessionId: string,
    sessionUpdate: 'user_message_chunk' | 'agent_message_chunk',
    text: string,
    messageId: string
  ): Promise<void> {
    await this.safeSessionUpdate({
      sessionId,
      update: {
        sessionUpdate,
        content: { type: 'text', text },
        messageId,
      },
    });
  }

  private async safeSessionUpdate(params: Parameters<AcpClient['sessionUpdate']>[0]): Promise<void> {
    try {
      await this.client.sessionUpdate(params);
    } catch {
      // Short-lived stdio smoke clients may close before notifications flush.
    }
  }
}

function createAcpCapabilities(): Record<string, unknown> {
  return {
    protocol: 'acp',
    protocolVersion: PROTOCOL_VERSION,
    transport: 'ndjson-stdio',
    command: 'echoai acp --stdio',
    server: {
      name: 'EchoAI',
      version: readVersion(),
      status: 'sdk-backed',
    },
    methods: [
      'initialize',
      'session/new',
      'session/load',
      'session/list',
      'session/prompt',
      'session/cancel',
      'session/set_mode',
    ],
    capabilities: {
      sessionLoad: true,
      sessionList: true,
      embeddedContext: true,
      mcp: ['stdio', 'http', 'sse'],
      toolUpdates: true,
      toolLocations: true,
      structuredDiffs: true,
      permissions: true,
    },
  };
}

function modeState(session: KernelSession): SessionModeState {
  return {
    ...modes,
    currentModeId: session.mode,
  };
}

function contentBlocksToText(blocks: ContentBlock[]): string {
  return blocks.map((block) => {
    if (block.type === 'text') return block.text;
    if (block.type === 'resource_link') return `[resource] ${block.uri}`;
    if (block.type === 'resource') {
      const resource = block.resource;
      if ('text' in resource) {
        return `[embedded resource: ${resource.uri}]\n${resource.text}`;
      }
      return `[embedded binary resource: ${resource.uri}]`;
    }
    if (block.type === 'image') return `[image${block.uri ? `: ${block.uri}` : ''}]`;
    if (block.type === 'audio') return '[audio]';
    return '[content]';
  }).join('\n\n');
}

function echoSessionMeta(session: KernelSession): Record<string, unknown> {
  const provider = session.provider || readStringMetadata(session, 'provider');
  const model = session.model || readStringMetadata(session, 'model');
  return {
    echoai: {
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    },
  };
}

/**
 * Read a client-requested provider/model out of an ACP request `_meta`.
 *
 * A client such as the Echo AI IDE model picker needs to route a turn without
 * editing the user's global config. Routing is accepted on `session/new` and on
 * `session/prompt`; anything unparseable is ignored so an older or unrelated ACP
 * client keeps the configured defaults.
 */
function readEchoRoutingMeta(meta: unknown): { provider?: string; model?: string } {
  if (!isRecord(meta)) return {};
  const echoai = meta.echoai;
  if (!isRecord(echoai)) return {};
  const provider = typeof echoai.provider === 'string' ? echoai.provider.trim() : '';
  const model = typeof echoai.model === 'string' ? echoai.model.trim() : '';
  return {
    ...(provider && provider.length <= 100 ? { provider } : {}),
    ...(model && model.length <= 200 ? { model } : {}),
  };
}

function toolResultContent(result: KernelToolResult): ToolCallContent[] {
  const content: ToolCallContent[] = [];
  const textParts = [result.output, result.error, result.summary]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const text = [...new Set(textParts)].join('\n');
  if (text) {
    content.push({
      type: 'content',
      content: {
        type: 'text',
        text,
      },
    });
  }

  for (const artifact of result.artifacts ?? []) {
    if (artifact.type === 'diff') {
      const newText = readArtifactText(artifact, 'newText');
      if (newText !== undefined) {
        const oldText = readArtifactText(artifact, 'oldText');
        content.push({
          type: 'diff',
          path: artifact.path ?? artifact.label,
          ...(oldText !== undefined ? { oldText } : {}),
          newText,
        });
        continue;
      }
    }

    if (artifact.content) {
      content.push({
        type: 'content',
        content: {
          type: 'text',
          text: `${artifact.label}\n${artifact.content}`,
        },
      });
    }
  }

  return content;
}

function readArtifactText(artifact: KernelArtifact, key: 'oldText' | 'newText'): string | undefined {
  const value = artifact.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function inferToolLocations(call: KernelToolCall, artifacts: KernelArtifact[] = []): ToolCallLocation[] | undefined {
  const locations: ToolCallLocation[] = [];
  const inputPath = [call.input.path, call.input.filePath, call.input.targetPath]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const inputLine = [call.input.line, call.input.startLine]
    .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (inputPath) {
    locations.push({
      path: inputPath,
      ...(inputLine !== undefined ? { line: Math.floor(inputLine) } : {}),
    });
  }
  for (const artifact of artifacts) {
    const artifactPath = artifact.path ?? (artifact.type === 'diff' ? artifact.label : undefined);
    if (artifactPath) {
      locations.push({ path: artifactPath });
    }
  }
  if (locations.length === 0) {
    return undefined;
  }

  const unique = new Map<string, ToolCallLocation>();
  for (const location of locations) {
    unique.set(`${location.path}:${location.line ?? ''}`, location);
  }
  return [...unique.values()];
}

function readStringMetadata(session: KernelSession, key: string): string | undefined {
  const value = session.metadata[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function inferToolKind(toolName: string): ToolKind {
  if (toolName.includes('read') || toolName.includes('diagnostic') || toolName.includes('definition') || toolName.includes('reference')) {
    return 'read';
  }
  if (toolName.includes('write') || toolName.includes('edit') || toolName.includes('patch') || toolName.includes('revert')) {
    return 'edit';
  }
  if (toolName.includes('grep') || toolName.includes('glob') || toolName.includes('symbol')) {
    return 'search';
  }
  if (toolName.includes('run') || toolName.includes('shell') || toolName.includes('test') || toolName.includes('lint')) {
    return 'execute';
  }
  return 'other';
}

function resolveAcpWorkspaceRoot(requested: string | undefined, configuredRoot: string): string {
  let canonicalConfiguredRoot: string;
  let canonicalRequestedRoot: string;
  let requestedIsDirectory: boolean;
  try {
    canonicalConfiguredRoot = realpathSync.native(path.resolve(configuredRoot));
    canonicalRequestedRoot = realpathSync.native(path.resolve(requested || configuredRoot));
    requestedIsDirectory = statSync(canonicalRequestedRoot).isDirectory();
  } catch {
    throw RequestError.invalidParams(
      { cwd: requested },
      'EchoAI requires an existing workspace directory for ACP sessions',
    );
  }

  const relative = path.relative(canonicalConfiguredRoot, canonicalRequestedRoot);
  const outsideConfiguredRoot = relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative);
  if (outsideConfiguredRoot || !requestedIsDirectory) {
    throw RequestError.invalidParams(
      { cwd: requested },
      'EchoAI ACP sessions must stay inside the launched workspace',
    );
  }
  return canonicalRequestedRoot;
}

function rejectAdditionalDirectories(additionalDirectories?: string[]): void {
  if (additionalDirectories && additionalDirectories.length > 0) {
    throw RequestError.invalidParams(
      { additionalDirectories },
      'EchoAI does not support additional workspace directories for ACP sessions',
    );
  }
}

function encodeSessionCursor(offset: number): string {
  return Buffer.from(`echoai-session-v1:${offset}`, 'utf8').toString('base64url');
}

function decodeSessionCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const match = /^echoai-session-v1:(\d+)$/.exec(decoded);
    if (!match) throw new Error('invalid cursor');
    const offset = Number(match[1]);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('invalid cursor');
    return offset;
  } catch {
    throw RequestError.invalidParams({ cursor }, 'Invalid EchoAI session cursor');
  }
}

function toRuntimeMcpServers(servers: McpServer[]): MCPServer[] {
  return servers.map((server, index): MCPServer => {
    const id = `acp_session_${index}_${server.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`;
    if ('type' in server && server.type === 'http') {
      return {
        id,
        name: server.name,
        transport: 'http',
        url: server.url,
        headers: Object.fromEntries(server.headers.map((header) => [header.name, header.value])),
        tools: [],
        connected: false,
      };
    }
    if ('type' in server && server.type === 'sse') {
      return {
        id,
        name: server.name,
        transport: 'sse',
        url: server.url,
        headers: Object.fromEntries(server.headers.map((header) => [header.name, header.value])),
        tools: [],
        connected: false,
      };
    }
    return {
      id,
      name: server.name,
      transport: 'stdio',
      command: server.command,
      args: server.args,
      env: Object.fromEntries(server.env.map((entry) => [entry.name, entry.value])),
      tools: [],
      connected: false,
    };
  });
}

function readPersistedMessage(value: unknown): {
  id: string;
  role: string;
  content: string;
} | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.id === 'string' && typeof value.role === 'string' && typeof value.content === 'string'
    ? { id: value.id, role: value.role, content: value.content }
    : undefined;
}

function readPersistedApproval(value: unknown): {
  id: string;
  toolCallId?: string;
  toolName: string;
  decision: 'approved' | 'denied';
  input: Record<string, unknown>;
} | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.id !== 'string'
    || typeof value.toolName !== 'string'
    || (value.decision !== 'approved' && value.decision !== 'denied')
  ) {
    return undefined;
  }
  return {
    id: value.id,
    toolCallId: typeof value.toolCallId === 'string' ? value.toolCallId : undefined,
    toolName: value.toolName,
    decision: value.decision,
    input: isRecord(value.input) ? value.input : {},
  };
}

function readPersistedToolCall(value: unknown): KernelToolCall | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return undefined;
  }
  return {
    id: value.id,
    name: value.name,
    input: isRecord(value.input) ? value.input : {},
  };
}

function readPersistedToolResult(value: unknown): KernelToolResult | undefined {
  if (!isRecord(value) || typeof value.success !== 'boolean') return undefined;
  return {
    success: value.success,
    output: typeof value.output === 'string' ? value.output : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts.filter(isRecord) as unknown as KernelArtifact[]
      : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw abortError(signal);

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error('EchoAI ACP operation was cancelled');
  error.name = 'AbortError';
  return error;
}

function readVersion(): string {
  const bundledVersion = process.env.ECHOAI_VERSION?.trim();
  if (bundledVersion) {
    return bundledVersion;
  }

  try {
    const packageUrl = new URL('../../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8')) as { version?: string };
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default acpCommand;
