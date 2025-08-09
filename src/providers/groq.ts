import Groq from 'groq-sdk';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation 
} from '../types/index.js';

export class GroqProvider implements AIProvider {
  name = 'groq';
  models = [
    'llama3-8b-8192',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
    'gemma-7b-it',
    'gemma2-9b-it',
  ];

  private client: Groq;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
    });
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new Groq({ apiKey });
      
      // Test with a minimal request
      await testClient.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
        temperature: 0.1,
      });
      
      return true;
    } catch (error) {
      console.error('Groq authentication failed:', error);
      return false;
    }
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const model = (options.model || this.config.model || this.models[0]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 8192;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    // Convert messages to Groq format
    const groqMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      if (options.stream !== false) {
        const stream = await this.client.chat.completions.create({
          model,
          messages: groqMessages,
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
          messages: groqMessages,
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
        throw new Error(`Groq API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = (options.model || this.config.model || this.models[0]) as any;
    const maxTokens = options.maxTokens || this.config.maxTokens || 8192;
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
        throw new Error(`Groq API Error: ${error.message}`);
      }
      throw error;
    }
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    } else if (!config.apiKey.startsWith('gsk_')) {
      errors.push('Invalid Groq API key format (should start with gsk_)');
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