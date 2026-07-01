import { ProviderConfig } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.deepseek.com',
    });
    this.name = 'deepseek';
    this.models = [
      'deepseek-chat', // points to the latest DeepSeek V3 line
      'deepseek-reasoner' // points to the latest DeepSeek R1 reasoning line
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'deepseek-chat';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'https://api.deepseek.com',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('DeepSeek authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(config: ProviderConfig) {
    const validation = super.validateConfig(config);
    if (!config.apiKey) {
      validation.isValid = false;
      validation.errors?.push('DeepSeek API key is required');
    }
    return validation;
  }
}
