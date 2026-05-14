import { ProviderConfig } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

export class NIMProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:8082',
    });
    this.name = 'nim';
    this.models = [
      'nim-testing-model',
      'claude-3-5-sonnet-20241022',
      'gpt-4o'
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || this.models[0] || 'nim-testing-model';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'http://localhost:8082',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('NIM authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(config: ProviderConfig) {
    // NIM proxy might not require a specific prefix, just check presence
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required for NIM testing provider');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
