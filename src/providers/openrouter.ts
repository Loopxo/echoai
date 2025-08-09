import OpenAI from 'openai';
import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation 
} from '../types/index.js';

export class OpenRouterProvider implements AIProvider {
  name = 'openrouter';
  models = [
    // OpenAI Models via OpenRouter
    'openai/gpt-4-turbo',
    'openai/gpt-4o',
    'openai/gpt-3.5-turbo',
    
    // Anthropic Models via OpenRouter  
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-haiku',
    
    // Meta Models via OpenRouter
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct', 
    'meta-llama/llama-3.1-8b-instruct',
    'meta-llama/codellama-70b-instruct',
    
    // Google Models via OpenRouter
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    
    // Mistral Models via OpenRouter
    'mistralai/mixtral-8x7b-instruct',
    'mistralai/mistral-7b-instruct',
    
    // Other Popular Models
    'cohere/command-r-plus',
    'perplexity/llama-3.1-sonar-large-128k-online',
    'qwen/qwen-2-72b-instruct',
  ];

  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://echo-ai-cli.com', // Your app's URL
        'X-Title': 'Echo AI CLI', // Your app's name
      },
    });
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://echo-ai-cli.com',
          'X-Title': 'Echo AI CLI',
        },
      });
      
      // Test with a small, fast model
      await testClient.chat.completions.create({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      
      return true;
    } catch (error) {
      console.error('OpenRouter authentication failed:', error);
      return false;
    }
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const model = options.model || this.config.model || this.models[1]!; // Default to Claude 3.5 Sonnet
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;

    const openRouterMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      if (options.stream !== false) {
        const stream = await this.client.chat.completions.create({
          model,
          messages: openRouterMessages,
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
          messages: openRouterMessages,
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
        throw new Error(`OpenRouter API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = options.model || this.config.model || this.models[1]!; // Default to Claude 3.5 Sonnet
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
        throw new Error(`OpenRouter API Error: ${error.message}`);
      }
      throw error;
    }
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    } else if (!config.apiKey.startsWith('sk-or-')) {
      errors.push('Invalid OpenRouter API key format (should start with sk-or-)');
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