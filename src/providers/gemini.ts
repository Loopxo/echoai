import { 
  AIProvider, 
  Message, 
  ChatOptions, 
  CompletionOptions, 
  ProviderConfig, 
  ConfigValidation 
} from '../types/index.js';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  models = [
    'gemini-pro',
    'gemini-pro-vision',
  ];

  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async authenticate(apiKey: string): Promise<boolean> {
    // TODO: Implement Google Gemini authentication
    console.warn('Gemini provider is not yet implemented');
    return false;
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    throw new Error('Gemini provider is not yet implemented');
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    throw new Error('Gemini provider is not yet implemented');
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    return {
      isValid: false,
      errors: ['Gemini provider is not yet implemented'],
    };
  }
}