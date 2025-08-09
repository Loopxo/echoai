import OpenAI from 'openai';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation 
} from '../types/index.js';

export class MetaAIProvider implements AIProvider {
  name = 'meta';
  models = [
    'llama-3.1-405b-instruct',
    'llama-3.1-70b-instruct', 
    'llama-3.1-8b-instruct',
    'llama-3.2-90b-vision-instruct',
    'llama-3.2-11b-vision-instruct',
    'llama-3.2-3b-instruct',
    'llama-3.2-1b-instruct',
    'code-llama-70b-instruct',
    'code-llama-34b-instruct',
    'code-llama-13b-instruct',
  ];

  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    // Meta AI uses OpenAI-compatible API through various providers
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.together.ai/v1', // Together AI as default Meta provider
    });
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({ 
        apiKey,
        baseURL: this.config.baseUrl || 'https://api.together.ai/v1',
      });
      
      // Test with a minimal request
      await testClient.chat.completions.create({
        model: 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      });
      
      return true;
    } catch (error) {
      console.error('Meta AI authentication failed:', error);
      return false;
    }
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const model = this.mapModelName(options.model || this.config.model || this.models[2]);
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    const metaMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      if (options.stream !== false) {
        const stream = await this.client.chat.completions.create({
          model,
          messages: metaMessages,
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
          messages: metaMessages,
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
        throw new Error(`Meta AI API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = this.mapModelName(options.model || this.config.model || this.models[2]);
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
        throw new Error(`Meta AI API Error: ${error.message}`);
      }
      throw error;
    }
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
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

  private mapModelName(modelName: string): string {
    // Map friendly model names to actual API model names
    const modelMap: Record<string, string> = {
      'llama-3.1-405b-instruct': 'meta-llama/Llama-3.1-405B-Instruct-Turbo',
      'llama-3.1-70b-instruct': 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
      'llama-3.1-8b-instruct': 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
      'llama-3.2-90b-vision-instruct': 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      'llama-3.2-11b-vision-instruct': 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      'llama-3.2-3b-instruct': 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
      'llama-3.2-1b-instruct': 'meta-llama/Llama-3.2-1B-Instruct-Turbo',
      'code-llama-70b-instruct': 'codellama/CodeLlama-70b-Instruct-hf',
      'code-llama-34b-instruct': 'codellama/CodeLlama-34b-Instruct-hf',
      'code-llama-13b-instruct': 'codellama/CodeLlama-13b-Instruct-hf',
    };

    return modelMap[modelName] || modelName;
  }
}