// import Groq from 'groq-sdk'; // TODO: Install groq-sdk
type Groq = any;
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
    // this.client = new Groq({
    //   apiKey: config.apiKey,
    // });
    throw new Error('Groq provider requires groq-sdk to be installed. Run: npm install groq-sdk');
  }

  async authenticate(apiKey: string): Promise<boolean> {
    return false; // Groq not implemented yet
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    throw new Error('Groq provider not implemented yet');
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    throw new Error('Groq provider not implemented yet');
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