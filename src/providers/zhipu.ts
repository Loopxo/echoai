import { ProviderConfig } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

/**
 * Zhipu AI / GLM provider (Chinese).
 *
 * GLM exposes an OpenAI-compatible endpoint, so we extend OpenAIProvider and
 * only override the base URL, model catalog, and auth/validation.
 *
 * Model IDs reflect the GLM coding-capable lineup. They can be overridden via
 * `config.model` and should be verified against the live Zhipu catalog at
 * https://open.bigmodel.cn/dev/api as new GLM releases ship.
 */
export class ZhipuProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
    });
    this.name = 'zhipu';
    this.models = [
      'glm-4.6',
      'glm-4.5',
      'glm-4.5-air',
      'glm-4-plus',
      'glm-4-air',
      'glm-4-flash', // free / low-cost tier, ideal for students
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'glm-4.6';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('Zhipu authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(config: ProviderConfig) {
    // Do not call super: GLM keys do not use the OpenAI `sk-` prefix.
    const errors: string[] = [];
    if (!config.apiKey) {
      errors.push('Zhipu (GLM) API key is required');
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
