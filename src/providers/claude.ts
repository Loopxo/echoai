import Anthropic from '@anthropic-ai/sdk';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation 
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
}