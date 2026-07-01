import { ProviderConfig } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

/**
 * MiniMax provider (Chinese).
 *
 * MiniMax exposes an OpenAI-compatible chat-completions endpoint. The default
 * base URL targets the international endpoint; mainland users can override with
 * `https://api.minimax.chat/v1`.
 *
 * Model IDs should be verified against the live MiniMax catalog as new
 * releases ship.
 */
export class MiniMaxProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.minimaxi.chat/v1',
    });
    this.name = 'minimax';
    this.models = [
      'MiniMax-M2',
      'MiniMax-Text-01',
      'abab6.5s-chat',
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'MiniMax-M2';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'https://api.minimaxi.chat/v1',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('MiniMax authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(config: ProviderConfig) {
    // Do not call super: MiniMax keys do not use the OpenAI `sk-` prefix.
    const errors: string[] = [];
    if (!config.apiKey) {
      errors.push('MiniMax API key is required');
    }
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }
    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      errors.push('Max tokens must be greater than 0');
    }
    return { isValid: errors.length === 0, errors };
  }
}
