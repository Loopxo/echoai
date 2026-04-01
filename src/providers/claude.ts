import Anthropic from '@anthropic-ai/sdk';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation,
  ProviderCompletionResult,
  ProviderStreamChunk,
  ProviderToolDefinition,
  StructuredMessage,
  StructuredToolCall,
} from '../types/index.js';

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  models = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];

  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new Anthropic({ 
        apiKey,
        baseURL: this.config.baseUrl,
      });
      
      await testClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      
      return true;
    } catch (error) {
      console.error('Claude authentication failed:', error);
      return false;
    }
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const model = (options.model || this.config.model || this.models[1]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const systemMessage = messages.find(msg => msg.role === 'system')?.content;

    try {
      if (options.stream !== false) {
        const stream = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemMessage,
          messages: anthropicMessages,
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            yield chunk.delta.text;
          }
        }
      } else {
        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemMessage,
          messages: anthropicMessages,
        });

        if (response.content[0]?.type === 'text') {
          yield response.content[0].text;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Claude API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = (options.model || this.config.model || this.models[1]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      });

      if (response.content[0]?.type === 'text') {
        return response.content[0].text;
      }
      
      return '';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Claude API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async completeWithTools(
    messages: StructuredMessage[],
    options: ChatOptions & { tools?: ProviderToolDefinition[] } = {}
  ): Promise<ProviderCompletionResult> {
    const model = (options.model || this.config.model || this.models[1]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const payload = this.buildStructuredPayload(messages);

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: payload.system,
      messages: payload.messages,
      tools: this.mapTools(options.tools),
    } as any);

    return this.parseStructuredResponse(response.content as any[]);
  }

  async streamWithTools(
    messages: StructuredMessage[],
    options: ChatOptions & { tools?: ProviderToolDefinition[] } = {},
    onChunk: (chunk: ProviderStreamChunk) => void
  ): Promise<ProviderCompletionResult> {
    const model = (options.model || this.config.model || this.models[1]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const payload = this.buildStructuredPayload(messages);
    const stream = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: payload.system,
      messages: payload.messages,
      tools: this.mapTools(options.tools),
      stream: true,
    } as any);

    let content = '';
    const toolStates = new Map<number, { id: string; name: string; inputJson: string; input?: Record<string, unknown> }>();
    const toolCalls: StructuredToolCall[] = [];

    for await (const part of stream as any) {
      if (part.type === 'content_block_delta' && part.delta?.type === 'text_delta') {
        content += part.delta.text;
        onChunk({ type: 'text', text: part.delta.text });
        continue;
      }

      if (part.type === 'content_block_start' && part.content_block?.type === 'tool_use') {
        toolStates.set(part.index, {
          id: part.content_block.id,
          name: part.content_block.name,
          inputJson: '',
          input: isRecord(part.content_block.input) ? part.content_block.input : undefined,
        });
        continue;
      }

      if (part.type === 'content_block_delta' && part.delta?.type === 'input_json_delta') {
        const state = toolStates.get(part.index);
        if (state) {
          state.inputJson += part.delta.partial_json ?? '';
        }
        continue;
      }

      if (part.type === 'content_block_stop') {
        const state = toolStates.get(part.index);
        if (!state) {
          continue;
        }

        const parsedInput = state.input ?? parseJsonObject(state.inputJson);
        const toolCall: StructuredToolCall = {
          id: state.id,
          name: state.name,
          input: parsedInput,
        };
        toolCalls.push(toolCall);
        onChunk({ type: 'tool_call', toolCall });
        toolStates.delete(part.index);
      }
    }

    return {
      content,
      toolCalls,
    };
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    } else if (!config.apiKey.startsWith('sk-ant-')) {
      errors.push('Invalid Claude API key format (should start with sk-ant-)');
    }

    if (config.model && !this.models.includes(config.model)) {
      errors.push(`Unsupported model: ${config.model}. Supported models: ${this.models.join(', ')}`);
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
      errors.push('Temperature must be between 0 and 1');
    }

    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      errors.push('Max tokens must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private buildStructuredPayload(messages: StructuredMessage[]): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
  } {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .filter(Boolean)
      .join('\n\n') || undefined;

    const converted: Array<{ role: 'user' | 'assistant'; content: unknown }> = [];

    for (const message of messages) {
      if (message.role === 'system') {
        continue;
      }

      if (message.role === 'tool') {
        converted.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId,
              content: message.content,
            },
          ],
        });
        continue;
      }

      if (message.role === 'assistant') {
        const contentBlocks: any[] = [];
        if (message.content) {
          contentBlocks.push({ type: 'text', text: message.content });
        }
        for (const toolCall of message.toolCalls ?? []) {
          contentBlocks.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input,
          });
        }

        converted.push({
          role: 'assistant',
          content: contentBlocks.length > 0 ? contentBlocks : '',
        });
        continue;
      }

      converted.push({
        role: message.role,
        content: message.content,
      });
    }

    return {
      system,
      messages: converted,
    };
  }

  private mapTools(tools?: ProviderToolDefinition[]) {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  private parseStructuredResponse(contentBlocks: any[]): ProviderCompletionResult {
    const textParts: string[] = [];
    const toolCalls: StructuredToolCall[] = [];

    for (const block of contentBlocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
      }

      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: isRecord(block.input) ? block.input : {},
        });
      }
    }

    return {
      content: textParts.join(''),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject(input: string): Record<string, unknown> {
  if (!input.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
