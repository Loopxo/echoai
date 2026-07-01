import { ProviderConfig } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

/**
 * Qwen / Alibaba DashScope provider (Chinese).
 *
 * DashScope offers an OpenAI-compatible endpoint. The default base URL targets
 * the international endpoint; mainland users can override with
 * `https://dashscope.aliyuncs.com/compatible-mode/v1`.
 *
 * Model IDs cover the Qwen coding lineup and should be verified against the
 * live DashScope catalog as new Qwen releases ship.
 */
export class QwenProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    });
    this.name = 'qwen';
    this.models = [
      'qwen3-coder-plus',
      'qwen3-coder-480b-a35b-instruct',
      'qwen-max',
      'qwen-plus',
      'qwen-turbo', // low-cost tier, ideal for students
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'qwen3-coder-plus';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('Qwen authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(config: ProviderConfig) {
    // Do not call super: DashScope keys do not use the OpenAI `sk-` prefix.
    const errors: string[] = [];
    if (!config.apiKey) {
      errors.push('Qwen (DashScope) API key is required');
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
