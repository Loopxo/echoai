import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import {
  AIProvider,
  ChatOptions,
  CompletionOptions,
  ConfigValidation,
  Message,
  ProviderCompletionResult,
  ProviderConfig,
  ProviderStreamChunk,
  ProviderToolDefinition,
  StructuredMessage,
  StructuredToolCall,
} from '../types/index.js';

interface EchoAuthFile {
  accessToken?: string;
  refreshToken?: string;
  apiUrl?: string;
  expiresAt?: string;
}

export class EchoAIProvider implements AIProvider {
  name = 'echoai';
  models = ['fast', 'code', 'reason', 'deepseek-chat', 'deepseek-reasoner', 'moonshot-v1-32k'];

  private apiUrl: string;

  constructor(private config: ProviderConfig) {
    this.apiUrl = config.baseUrl || process.env.ECHOAI_API_URL || readAuthFile().apiUrl || 'https://echoai.loopxo.org';
  }

  async authenticate(): Promise<boolean> {
    return Boolean(readAuthFile().accessToken);
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const result = await this.completeWithTools(
      messages.map((message) => ({ role: message.role, content: message.content })),
      options
    );
    if (result.content) yield result.content;
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const result = await this.completeWithTools([{ role: 'user', content: prompt }], options);
    return result.content;
  }

  async completeWithTools(
    messages: StructuredMessage[],
    options: ChatOptions & { tools?: ProviderToolDefinition[] }
  ): Promise<ProviderCompletionResult> {
    const response = await this.fetchGateway('/chat/completions', {
      model: options.model || this.config.model || 'code',
      messages,
      tools: options.tools,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stream: false,
    });

    return {
      content: String(response.content ?? ''),
      toolCalls: normalizeToolCalls(response.toolCalls),
      metadata: response.metadata && typeof response.metadata === 'object'
        ? response.metadata as Record<string, unknown>
        : undefined,
    };
  }

  async streamWithTools(
    messages: StructuredMessage[],
    options: ChatOptions & { tools?: ProviderToolDefinition[] },
    onChunk: (chunk: ProviderStreamChunk) => void
  ): Promise<ProviderCompletionResult> {
    const auth = requireAuthFile();
    const res = await fetch(`${this.apiUrl.replace(/\/$/, '')}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        model: options.model || this.config.model || 'code',
        messages,
        tools: options.tools,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`EchoAI gateway error: ${res.status} ${await res.text()}`);
    }

    const decoder = new TextDecoder();
    const reader = res.body?.getReader();
    if (!reader) throw new Error('EchoAI gateway returned no response body');

    let content = '';
    let buffer = '';
    const toolCalls: StructuredToolCall[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        const event = JSON.parse(payload) as Record<string, unknown>;
        if (event.type === 'text' && typeof event.text === 'string') {
          content += event.text;
          onChunk({ type: 'text', text: event.text });
        }
        if (event.type === 'tool_call') {
          const calls = normalizeToolCalls([event.toolCall]);
          const firstCall = calls?.[0];
          if (firstCall) {
            toolCalls.push(firstCall);
            onChunk({ type: 'tool_call', toolCall: firstCall });
          }
        }
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  validateConfig(): ConfigValidation {
    const errors: string[] = [];
    if (!readAuthFile().accessToken) {
      errors.push('Run `echoai login` before using the hosted EchoAI provider.');
    }
    return { isValid: errors.length === 0, errors };
  }

  private async fetchGateway(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const auth = requireAuthFile();
    const res = await fetch(`${this.apiUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`EchoAI gateway error: ${res.status} ${await res.text()}`);
    }

    return await res.json() as Record<string, unknown>;
  }
}

function normalizeToolCalls(value: unknown): StructuredToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const calls = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string') return [];
    const input = record.input && typeof record.input === 'object' && !Array.isArray(record.input)
      ? record.input as Record<string, unknown>
      : {};
    return [{ id: record.id, name: record.name, input }];
  });
  return calls.length > 0 ? calls : undefined;
}

function requireAuthFile(): Required<Pick<EchoAuthFile, 'accessToken'>> & EchoAuthFile {
  const auth = readAuthFile();
  if (!auth.accessToken) {
    throw new Error('Not logged in. Run `echoai login` first.');
  }
  return auth as Required<Pick<EchoAuthFile, 'accessToken'>> & EchoAuthFile;
}

function readAuthFile(): EchoAuthFile {
  const file = join(homedir(), '.echoai', 'auth.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as EchoAuthFile;
  } catch {
    return {};
  }
}
