import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  createProvider,
  type CompletionRequest,
  type Provider,
  type ProviderConfig,
} from '@echoai/providers';
import type {
  KernelCompletionProvider,
  KernelCompletionRequest,
  KernelCompletionResponse,
  KernelToolCall,
} from '@echoai/runtime';
import type { DesktopRuntimeProvider } from '@shared/ipc';

export type ProviderRegion = 'us' | 'cn' | 'local';

interface ProviderDefinition {
  id: string;
  label: string;
  type: ProviderConfig['type'];
  configAliases: string[];
  envKeys: string[];
  defaultModel: string;
  models: string[];
  region: ProviderRegion;
  family: string;
  // Vendors without a dedicated class in @echoai/providers ride the
  // OpenAI-compatible client, so the endpoint has to travel with the definition.
  // `@echoai/providers` also lets a `baseUrl` override the class default, which is
  // how DeepSeek and Kimi reach their own APIs instead of api.openai.com.
  defaultBaseUrl?: string;
  alwaysAvailable?: boolean;
}

/**
 * `DesktopRuntimeProvider` in @shared/ipc still describes only
 * {id,label,defaultModel,source}. It needs widening with `models`, `region` and
 * `family` before the renderer can render a grouped picker over these values.
 */
export interface DesktopProviderDescriptor extends DesktopRuntimeProvider {
  models: string[];
  region: ProviderRegion;
  family: string;
}

interface StoredProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface ProviderCatalogConfig {
  providers?: Record<string, StoredProviderConfig>;
  defaults?: {
    provider?: string;
    model?: string;
  };
}

export interface DesktopProviderCatalogOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  providerFactory?: (config: ProviderConfig) => Provider;
}

const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'deepseek',
    configAliases: ['deepseek'],
    envKeys: ['DEEPSEEK_API_KEY'],
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    region: 'cn',
    family: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    type: 'kimi',
    configAliases: ['kimi', 'moonshot'],
    envKeys: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
    defaultModel: 'moonshot-v1-32k',
    models: [
      'kimi-k2-0711-preview',
      'kimi-k2-turbo-preview',
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
    ],
    region: 'cn',
    family: 'Moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    id: 'qwen',
    label: 'Qwen (DashScope)',
    type: 'openai',
    configAliases: ['qwen', 'dashscope'],
    envKeys: ['DASHSCOPE_API_KEY', 'QWEN_API_KEY'],
    defaultModel: 'qwen-plus',
    models: [
      'qwen-plus',
      'qwen-max',
      'qwen-turbo',
      'qwen-long',
      'qwen3-coder-plus',
      'qwen2.5-72b-instruct',
    ],
    region: 'cn',
    family: 'Qwen',
    // Singapore/international accounts use a different host; a stored `baseUrl`
    // overrides this without needing a second catalog entry.
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'glm',
    label: 'GLM (Zhipu)',
    type: 'openai',
    configAliases: ['glm', 'zhipu', 'bigmodel'],
    envKeys: ['ZHIPU_API_KEY', 'GLM_API_KEY'],
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4.6', 'glm-4.5', 'glm-4-air', 'glm-4-long', 'glm-4-flash'],
    region: 'cn',
    family: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    type: 'openai',
    configAliases: ['minimax'],
    envKeys: ['MINIMAX_API_KEY'],
    defaultModel: 'MiniMax-M2',
    models: ['MiniMax-M2', 'MiniMax-M1', 'MiniMax-Text-01', 'abab6.5s-chat'],
    region: 'cn',
    family: 'MiniMax',
    // Mainland accounts point at api.minimaxi.com/v1 instead; override via config.
    defaultBaseUrl: 'https://api.minimax.io/v1',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    type: 'openai',
    configAliases: ['openai'],
    envKeys: ['OPENAI_API_KEY'],
    defaultModel: 'gpt-4o',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini',
    ],
    region: 'us',
    family: 'GPT',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    type: 'anthropic',
    configAliases: ['claude', 'anthropic'],
    envKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    region: 'us',
    family: 'Claude',
  },
  {
    id: 'nim',
    label: 'NVIDIA NIM',
    type: 'nim',
    configAliases: ['nim'],
    envKeys: ['NVIDIA_API_KEY', 'NIM_API_KEY'],
    defaultModel: 'meta/llama-3.1-70b-instruct',
    models: [
      'meta/llama-3.1-70b-instruct',
      'meta/llama-3.1-8b-instruct',
      'mistralai/mistral-large',
      'nvidia/nemotron-4-340b-instruct',
    ],
    region: 'us',
    family: 'NVIDIA NIM',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    type: 'ollama',
    configAliases: ['ollama'],
    envKeys: [],
    defaultModel: 'llama3.2',
    // Suggestions only: the daemon reports whatever the user has pulled, and
    // `resolve` lets any model id through.
    models: ['llama3.2', 'llama3.1', 'qwen2.5-coder', 'deepseek-r1', 'mistral', 'phi4'],
    region: 'local',
    family: 'Ollama',
    alwaysAvailable: true,
  },
];

export class DesktopProviderCatalog {
  readonly completionProvider: KernelCompletionProvider;
  private readonly descriptors: DesktopProviderDescriptor[];
  private readonly configs = new Map<string, ProviderConfig>();
  private readonly providers = new Map<string, Provider>();
  private readonly providerFactory: (config: ProviderConfig) => Provider;
  private readonly configuredDefault?: { provider: string; model?: string };

  constructor(options: DesktopProviderCatalogOptions = {}) {
    const configPath = options.configPath ?? join(homedir(), '.echoai', 'config.json');
    const stored = readStoredConfig(configPath);
    const env = options.env ?? process.env;
    this.providerFactory = options.providerFactory ?? createProvider;

    for (const definition of PROVIDERS) {
      const storedConfig = definition.configAliases
        .map((alias) => stored.providers?.[alias])
        .find((candidate) => candidate !== undefined);
      const envKey = definition.envKeys
        .map((key) => env[key]?.trim())
        .find((value): value is string => Boolean(value));
      const apiKey = storedConfig?.apiKey?.trim() || envKey;

      if (!definition.alwaysAvailable && !storedConfig && !apiKey) {
        continue;
      }

      const model = storedConfig?.model?.trim() || (
        stored.defaults?.provider && definition.configAliases.includes(stored.defaults.provider)
          ? stored.defaults.model?.trim()
          : undefined
      ) || definition.defaultModel;

      this.configs.set(definition.id, {
        type: definition.type,
        apiKey,
        baseUrl: storedConfig?.baseUrl?.trim() || definition.defaultBaseUrl,
        model,
      });
    }

    this.descriptors = PROVIDERS
      .filter((definition) => this.configs.has(definition.id))
      .map((definition) => {
        const defaultModel = this.configs.get(definition.id)?.model ?? definition.defaultModel;
        return {
          id: definition.id,
          label: definition.label,
          defaultModel,
          source: definition.alwaysAvailable && !stored.providers?.[definition.id]
            ? 'local'
            : 'configured',
          // A privately hosted or newly released model id chosen in config.json
          // still belongs in the picker, otherwise the UI would silently drop it.
          models: definition.models.includes(defaultModel)
            ? [...definition.models]
            : [defaultModel, ...definition.models],
          region: definition.region,
          family: definition.family,
        };
      });

    const requestedDefault = stored.defaults?.provider;
    const matchedDefault = requestedDefault
      ? PROVIDERS.find((definition) => definition.configAliases.includes(requestedDefault))
      : undefined;
    if (matchedDefault && this.configs.has(matchedDefault.id)) {
      this.configuredDefault = {
        provider: matchedDefault.id,
        model: stored.defaults?.model,
      };
    }

    this.completionProvider = {
      complete: async (request) => this.complete(request),
      stream: async (request, onChunk) => {
        throwIfAborted(request);
        const provider = this.getProvider(request.session.provider);
        const response = await provider.stream(
          toProviderRequest(request, true),
          (event) => {
            throwIfAborted(request);
            if (event.type === 'text_delta' && event.text) {
              onChunk({ type: 'text', text: event.text });
            } else if (event.type === 'tool_use' && event.toolCall) {
              onChunk({ type: 'tool_call', toolCall: toKernelToolCall(event.toolCall) });
            } else if (event.type === 'message_end') {
              onChunk({ type: 'done' });
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Provider stream failed');
            }
          }
        );
        throwIfAborted(request);
        return toKernelResponse(response);
      },
    };
  }

  // Structurally still a DesktopRuntimeProvider[]; the extra fields are additive
  // until the shared IPC type is widened.
  list(): DesktopProviderDescriptor[] {
    return this.descriptors.map((descriptor) => ({
      ...descriptor,
      models: [...descriptor.models],
    }));
  }

  getDefault(): { provider: string; model: string } {
    const descriptor = this.configuredDefault
      ? this.descriptors.find((candidate) => candidate.id === this.configuredDefault?.provider)
      : this.descriptors[0];
    if (!descriptor) {
      throw new Error('No desktop providers are available');
    }
    return {
      provider: descriptor.id,
      model: this.configuredDefault?.model || descriptor.defaultModel,
    };
  }

  resolve(provider?: string, model?: string): { provider: string; model: string } {
    const fallback = this.getDefault();
    const providerId = provider && this.configs.has(provider) ? provider : fallback.provider;
    const descriptor = this.descriptors.find((candidate) => candidate.id === providerId);
    return {
      provider: providerId,
      model: model?.trim() || descriptor?.defaultModel || fallback.model,
    };
  }

  private async complete(request: KernelCompletionRequest): Promise<KernelCompletionResponse> {
    throwIfAborted(request);
    const provider = this.getProvider(request.session.provider);
    const response = await provider.complete(toProviderRequest(request, false));
    throwIfAborted(request);
    return toKernelResponse(response);
  }

  private getProvider(requested?: string): Provider {
    const { provider: providerId } = this.resolve(requested);
    let provider = this.providers.get(providerId);
    if (!provider) {
      const config = this.configs.get(providerId);
      if (!config) {
        throw new Error(`Desktop provider "${providerId}" is not configured`);
      }
      provider = this.providerFactory(config);
      this.providers.set(providerId, provider);
    }
    return provider;
  }
}

function readStoredConfig(configPath: string): ProviderCatalogConfig {
  if (!existsSync(configPath)) return {};
  try {
    const value = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as ProviderCatalogConfig
      : {};
  } catch {
    return {};
  }
}

function toProviderRequest(
  request: KernelCompletionRequest,
  stream: boolean
): CompletionRequest {
  return {
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
      name: message.name,
      toolCallId: message.toolCallId,
    })),
    model: request.session.model,
    tools: request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
    systemPrompt: request.systemPrompt,
    stream,
  };
}

function toKernelResponse(
  response: Awaited<ReturnType<Provider['complete']>>
): KernelCompletionResponse {
  return {
    content: response.content,
    toolCalls: response.toolCalls?.map(toKernelToolCall),
    metadata: {
      providerMessageId: response.id,
      model: response.model,
      stopReason: response.stopReason,
      usage: response.usage,
    },
  };
}

function toKernelToolCall(toolCall: {
  id: string;
  function: { name: string; arguments: string };
}): KernelToolCall {
  let input: Record<string, unknown>;
  try {
    const parsed = JSON.parse(toolCall.function.arguments) as unknown;
    input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { value: parsed };
  } catch {
    input = { raw: toolCall.function.arguments };
  }

  return {
    id: toolCall.id,
    name: toolCall.function.name,
    input,
  };
}

function throwIfAborted(request: KernelCompletionRequest): void {
  if (request.abortSignal?.aborted) {
    throw new Error('Run cancelled');
  }
}
