import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { Command } from 'commander';
import {
  AgentSideConnection,
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
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type SessionInfo,
  type SessionModeState,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type ToolKind,
} from '@agentclientprotocol/sdk';
import {
  AgentKernel,
  AuditLogStore,
  RuntimePermissionManager,
  createBuiltInTools,
  SessionRegistry,
  type KernelMessage,
  type KernelRunEvent,
  type KernelSession,
  type KernelToolCall,
} from '@echoai/runtime';
import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { createCompletionProvider, registerConfiguredMcpTools } from '../runtime/cli-kernel.js';

interface AcpAgentOptions {
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
    await serveAcpStdio({ workspaceRoot: process.cwd() });
  });

export async function serveAcpStdio(options: AcpAgentOptions): Promise<void> {
  const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  const connection = new AgentSideConnection(
    (client) => new EchoAcpAgent(client, options),
    ndJsonStream(output, input)
  );
  await connection.closed;
}

export class EchoAcpAgent implements Agent {
  private readonly client: AcpClient;
  private readonly sessions = new SessionRegistry({ namespace: 'runtime' });
  private readonly workspaceRoot: string;
  private readonly cancelled = new Set<string>();

  constructor(client: AcpClient, options: AcpAgentOptions) {
    this.client = client;
    this.workspaceRoot = options.workspaceRoot;
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: params.protocolVersion,
      agentInfo: {
        name: 'EchoAI',
        version: readVersion(),
      },
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          embeddedContext: true,
        },
        sessionCapabilities: {
          additionalDirectories: {},
          list: {},
          resume: {},
        },
      },
      authMethods: [
        {
          id: 'echoai-login',
          type: 'terminal',
          name: 'EchoAI Login',
          description: 'Run echoai login in a terminal to connect EchoAI Cloud credits, or configure local BYOK providers before starting ACP.',
          args: ['login'],
        },
      ],
    };
  }

  async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse | void> {
    if (params.methodId !== 'echoai-login') {
      throw RequestError.invalidParams({ methodId: params.methodId }, 'Unsupported EchoAI authentication method');
    }
    return {};
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    const cwd = params.cwd || this.workspaceRoot;
    const session = await this.sessions.create('ACP Session');
    session.metadata.workspaceRoot = cwd;
    session.metadata.additionalDirectories = params.additionalDirectories ?? [];
    session.metadata.mcpServers = params.mcpServers ?? [];
    await this.sessions.save(session);
    await this.safeSessionUpdate({
      sessionId: session.id,
      update: {
        sessionUpdate: 'session_info_update',
        title: session.title,
        updatedAt: new Date(session.updatedAt).toISOString(),
      },
    });
    return {
      sessionId: session.id,
      modes: modeState(session),
    };
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    const session = await this.loadRequiredSession(params.sessionId);
    session.metadata.workspaceRoot = params.cwd || session.metadata.workspaceRoot || this.workspaceRoot;
    session.metadata.additionalDirectories = params.additionalDirectories ?? session.metadata.additionalDirectories ?? [];
    session.metadata.mcpServers = params.mcpServers ?? session.metadata.mcpServers ?? [];
    await this.sessions.save(session);
    for (const message of session.messages) {
      await this.emitMessage(session.id, message.role === 'assistant' ? 'agent_message_chunk' : 'user_message_chunk', message.content, message.id);
    }
    return {
      modes: modeState(session),
    };
  }

  async listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
    const sessions = await this.sessions.list();
    const filtered = sessions.filter((session) => {
      const cwd = typeof session.metadata.workspaceRoot === 'string' ? session.metadata.workspaceRoot : this.workspaceRoot;
      return !params.cwd || cwd === params.cwd;
    });
    return {
      sessions: filtered.slice(0, 50).map((session): SessionInfo => ({
        sessionId: session.id,
        title: session.title,
        cwd: typeof session.metadata.workspaceRoot === 'string' ? session.metadata.workspaceRoot : this.workspaceRoot,
        additionalDirectories: Array.isArray(session.metadata.additionalDirectories)
          ? session.metadata.additionalDirectories.filter((entry): entry is string => typeof entry === 'string')
          : [],
        updatedAt: new Date(session.updatedAt).toISOString(),
      })),
    };
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
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
    const session = await this.loadRequiredSession(params.sessionId);
    this.cancelled.delete(session.id);

    const promptText = contentBlocksToText(params.prompt).trim();
    await this.safeSessionUpdate({
      sessionId: session.id,
      update: {
        sessionUpdate: 'plan',
        entries: [
          {
            content: 'Inspect the requested coding task and gather only the needed context.',
            priority: 'high',
            status: 'completed',
          },
          {
            content: 'Use EchoAI runtime tools for edits, diagnostics, tests, and review.',
            priority: 'high',
            status: 'pending',
          },
        ],
      },
    });

    if (this.cancelled.has(session.id)) {
      return { stopReason: 'cancelled', userMessageId: params.messageId ?? null };
    }

    const modelBacked = await this.tryRunModelBackedTurn(session, promptText);
    if (modelBacked) {
      return {
        ...modelBacked,
        userMessageId: modelBacked.userMessageId ?? params.messageId ?? null,
      };
    }

    return this.runOfflineAcpTurn(session, promptText, params.messageId ?? randomUUID());
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.cancelled.add(params.sessionId);
  }

  private async tryRunModelBackedTurn(session: KernelSession, promptText: string): Promise<PromptResponse | null> {
    try {
      const workspaceRoot = typeof session.metadata.workspaceRoot === 'string' ? session.metadata.workspaceRoot : this.workspaceRoot;
      const configManager = new ConfigManager();
      const providerManager = new ProviderManager(configManager);
      const config = await configManager.getConfig();
      const providerName = session.provider || readStringMetadata(session, 'provider') || config.defaults.provider;
      const modelName = session.model || readStringMetadata(session, 'model') || config.defaults.model;
      if (!providerName) return null;

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
            ? { read: 'allow', write: 'deny', process: 'ask', network: 'ask' }
            : undefined,
        }),
        approvalResolver: async ({ session: runtimeSession, toolCall, permissionRequest }) => {
          return this.resolveAcpPermission(runtimeSession.id, toolCall, permissionRequest);
        },
      });
      await registerConfiguredMcpTools(kernel);

      let userMessageId: string | undefined;
      let assistantStreamed = false;
      let finalResponse = '';

      for await (const event of kernel.runEvents({
        sessionId: session.id,
        title: session.title,
        input: promptText,
        provider: providerName,
        model: modelName,
        mode: session.mode,
        workspaceRoot,
        stream: true,
      })) {
        if (this.cancelled.has(session.id)) {
          return {
            stopReason: 'cancelled',
            userMessageId,
          };
        }
        const handled = await this.handleKernelEvent(event, { assistantStreamed });
        assistantStreamed = handled.assistantStreamed;
        if (handled.userMessageId) userMessageId = handled.userMessageId;
        if (event.type === 'run.completed') {
          finalResponse = event.result.response;
        }
      }

      return {
        stopReason: this.cancelled.has(session.id) ? 'cancelled' : 'end_turn',
        userMessageId,
        usage: estimateUsage(promptText, finalResponse),
      };
    } catch {
      return null;
    }
  }

  private async handleKernelEvent(
    event: KernelRunEvent,
    state: { assistantStreamed: boolean }
  ): Promise<{ assistantStreamed: boolean; userMessageId?: string }> {
    switch (event.type) {
      case 'run.started':
        await this.safeSessionUpdate({
          sessionId: event.session.id,
          update: {
            sessionUpdate: 'session_info_update',
            title: event.session.title,
            updatedAt: new Date(event.session.updatedAt).toISOString(),
          },
        });
        return state;
      case 'message.created':
        if (event.message.role === 'user') {
          await this.emitMessage(event.sessionId, 'user_message_chunk', event.message.content, event.message.id);
          return { ...state, userMessageId: event.message.id };
        }
        if (event.message.role === 'assistant' && !state.assistantStreamed) {
          await this.emitMessage(event.sessionId, 'agent_message_chunk', event.message.content, event.message.id);
        }
        return state;
      case 'assistant.delta':
        await this.emitMessage(event.sessionId, 'agent_message_chunk', event.text, randomUUID());
        return { assistantStreamed: true };
      case 'assistant.tool_call':
      case 'tool.started':
        await this.emitToolCall(event.sessionId, event.call, 'in_progress');
        return state;
      case 'tool.completed':
        await this.safeSessionUpdate({
          sessionId: event.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: event.call.id,
            status: event.result.success ? 'completed' : 'failed',
            rawOutput: event.result,
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: event.result.output ?? event.result.error ?? event.result.summary ?? '',
                },
              },
            ],
          },
        });
        return state;
      case 'approval.recorded':
        await this.safeSessionUpdate({
          sessionId: event.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: event.approval.id,
            title: `${event.approval.toolName} ${event.approval.decision}`,
            status: event.approval.decision === 'approved' ? 'completed' : 'failed',
            rawOutput: event.approval,
          },
        });
        return state;
      case 'session.compacted':
        await this.safeSessionUpdate({
          sessionId: event.session.id,
          update: {
            sessionUpdate: 'usage_update',
            size: event.report.afterCount,
            used: event.report.afterCount,
          },
        });
        return state;
      case 'tool.batch.started':
      case 'run.completed':
        return state;
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
        status,
      },
    });
  }

  private async resolveAcpPermission(
    sessionId: string,
    toolCall: KernelToolCall,
    permissionRequest: { reason: string; risk: string; resource?: string }
  ): Promise<{ decision: 'approved' | 'denied'; reason?: string }> {
    try {
      const response = await this.client.requestPermission({
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
      });
      return response.outcome.outcome === 'selected' && response.outcome.optionId === 'allow_once'
        ? { decision: 'approved', reason: permissionRequest.reason }
        : { decision: 'denied', reason: permissionRequest.reason };
    } catch {
      return {
        decision: 'denied',
        reason: `ACP client did not approve ${toolCall.name}`,
      };
    }
  }

  private async runOfflineAcpTurn(session: KernelSession, promptText: string, userMessageId: string): Promise<PromptResponse> {
    const userMessage = await this.appendMessage(session, {
      id: userMessageId,
      role: 'user',
      content: promptText,
      createdAt: Date.now(),
    });
    await this.emitMessage(session.id, 'user_message_chunk', promptText, userMessage.id);

    const toolCatalog = createBuiltInTools({
      workspaceRoot: typeof session.metadata.workspaceRoot === 'string' ? session.metadata.workspaceRoot : this.workspaceRoot,
    }).map((tool) => tool.name);
    const response = [
      'EchoAI ACP session is connected.',
      `Received: ${promptText || '(empty prompt)'}`,
      `Runtime tools available: ${toolCatalog.slice(0, 12).join(', ')}${toolCatalog.length > 12 ? ', ...' : ''}`,
      'Model-backed ACP turns use the same EchoAI sessions, permission policy, and runtime tools as the terminal CLI.',
    ].join('\n');
    const assistantMessage = await this.appendMessage(session, {
      id: randomUUID(),
      role: 'assistant',
      content: response,
      createdAt: Date.now(),
    });
    await this.emitMessage(session.id, 'agent_message_chunk', response, assistantMessage.id);
    await this.safeSessionUpdate({
      sessionId: session.id,
      update: {
        sessionUpdate: 'usage_update',
        size: 0,
        used: 0,
      },
    });

    return {
      stopReason: this.cancelled.has(session.id) ? 'cancelled' : 'end_turn',
      userMessageId: userMessage.id,
      usage: estimateUsage(promptText, response),
    };
  }

  private async loadRequiredSession(sessionId: string): Promise<KernelSession> {
    const session = await this.sessions.load(sessionId);
    if (!session) {
      throw RequestError.resourceNotFound(`session:${sessionId}`);
    }
    return session;
  }

  private async appendMessage(session: KernelSession, message: KernelMessage): Promise<KernelMessage> {
    session.messages.push(message);
    await this.sessions.appendEvent(session.id, 'message.created', { message });
    await this.sessions.save(session);
    return message;
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
      sessions: true,
      messages: true,
      plans: true,
      toolCatalog: true,
      fileEdits: true,
      permissions: true,
      modelSelection: true,
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
    if (block.type === 'resource') return '[embedded resource]';
    if (block.type === 'image') return '[image]';
    if (block.type === 'audio') return '[audio]';
    return '[content]';
  }).join('\n');
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

function estimateUsage(input: string, output: string): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function readVersion(): string {
  try {
    const packageUrl = new URL('../../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8')) as { version?: string };
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default acpCommand;
