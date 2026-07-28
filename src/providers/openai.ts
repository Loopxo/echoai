import OpenAI from 'openai';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation,
  StructuredMessage,
  ProviderToolDefinition,
  ProviderCompletionResult,
  ProviderStreamChunk,
  StructuredToolCall
} from '../types/index.js';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  models = [
    'gpt-4-turbo-preview',
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo',
  ];

  protected client: OpenAI;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({ 
        apiKey,
        baseURL: this.config.baseUrl,
      });
      
      await testClient.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      });
      
      return true;
    } catch (error) {
      console.error('OpenAI authentication failed:', error);
      return false;
    }
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const model = (options.model || this.config.model || this.models[4]) as any; // gpt-3.5-turbo default
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    const openaiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      if (options.stream !== false) {
        const stream = await this.client.chat.completions.create({
          model,
          messages: openaiMessages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        }, { signal: options.signal });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      } else {
        const response = await this.client.chat.completions.create({
          model,
          messages: openaiMessages,
          max_tokens: maxTokens,
          temperature,
        }, { signal: options.signal });

        const content = response.choices[0]?.message?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API Error: ${error.message}`);
      }
      throw error;
    }
  }

  protected getDefaultModel(): string {
    return this.config.model || this.models[4] || this.models[0] || 'gpt-3.5-turbo';
  }

  protected sanitizeToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
    return schema;
  }

  protected formatTools(tools?: ProviderToolDefinition[]): unknown[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: this.sanitizeToolSchema(t.inputSchema)
      }
    }));
  }

  protected parseToolInput(raw: string | undefined): Record<string, unknown> {
    if (!raw?.trim()) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : { value: parsed };
    } catch {
      return { _raw: raw, _parseError: 'Invalid JSON arguments from provider' };
    }
  }

  async completeWithTools(
    messages: StructuredMessage[],
    options: ChatOptions & { tools?: ProviderToolDefinition[] }
  ): Promise<ProviderCompletionResult> {
    const model = (options.model || this.getDefaultModel()) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    const formattedMessages = messages.map(m => {
      const msg: any = { role: m.role, content: m.content || "" };
      if (m.name) msg.name = m.name;
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) }
        }));
      }
      return msg;
    });

    const payload: any = {
      model,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature,
    };

    const formattedTools = this.formatTools(options.tools);
    if (formattedTools) payload.tools = formattedTools;

    const response = await this.client.chat.completions.create(payload, { signal: options.signal });
    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls = message?.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: this.parseToolInput(tc.function.arguments)
    }));

    return {
      content: message?.content || '',
      toolCalls,
      metadata: extractProviderMetadata(message),
    };
  }

  async streamWithTools(
    messages: StructuredMessage[],
    options: ChatOptions & { tools?: ProviderToolDefinition[] },
    onChunk: (chunk: ProviderStreamChunk) => void
  ): Promise<ProviderCompletionResult> {
    const model = (options.model || this.getDefaultModel()) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    const formattedMessages = messages.map(m => {
      const msg: any = { role: m.role, content: m.content || "" };
      if (m.name) msg.name = m.name;
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) }
        }));
      }
      return msg;
    });

    const payload: any = {
      model,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    };

    const formattedTools = this.formatTools(options.tools);
    if (formattedTools) payload.tools = formattedTools;

    const stream = await this.client.chat.completions.create(payload, { signal: options.signal }) as any;
    
    let content = '';
    const toolCallsMap = new Map<number, any>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        content += delta.content;
        onChunk({ type: 'text', text: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index;
          if (!toolCallsMap.has(index)) {
            toolCallsMap.set(index, {
              id: tc.id,
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || ''
            });
          } else {
            const existing = toolCallsMap.get(index);
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
          }
        }
      }
    }

    const toolCalls: StructuredToolCall[] = [];
    for (const [_, tc] of toolCallsMap) {
      const input = this.parseToolInput(tc.arguments);
      const finalTc = { id: tc.id, name: tc.name, input };
      toolCalls.push(finalTc);
      onChunk({ type: 'tool_call', toolCall: finalTc });
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = (options.model || this.getDefaultModel()) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }, { signal: options.signal });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API Error: ${error.message}`);
      }
      throw error;
    }
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    } else if (!config.apiKey.startsWith('sk-')) {
      errors.push('Invalid OpenAI API key format (should start with sk-)');
    }

    if (config.model && !this.models.includes(config.model)) {
      errors.push(`Unsupported model: ${config.model}. Supported models: ${this.models.join(', ')}`);
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      errors.push('Max tokens must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

function extractProviderMetadata(message: unknown): Record<string, unknown> | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const record = message as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  for (const key of ['reasoning_content', 'reasoning', 'reasoningContent']) {
    if (record[key]) metadata[key] = record[key];
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
