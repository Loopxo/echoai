import OpenAI from 'openai';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation 
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

  private client: OpenAI;
  private config: ProviderConfig;

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
        model: 'gpt-3.5-turbo',
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
        });

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
        });

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

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = (options.model || this.config.model || this.models[4]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      });

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