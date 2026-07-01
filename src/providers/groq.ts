import { ProviderConfig, ConfigValidation } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

/**
 * Groq provider.
 *
 * Groq exposes an OpenAI-compatible endpoint that supports function/tool
 * calling, so we extend OpenAIProvider to inherit completeWithTools and
 * streamWithTools (agentic tool use) instead of the previous chat-only shim.
 */
export class GroqProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
    });
    this.name = 'groq';
    this.models = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'moonshotai/kimi-k2-instruct',
      'qwen/qwen3-32b',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'llama-3.3-70b-versatile';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'https://api.groq.com/openai/v1',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('Groq authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(config: ProviderConfig): ConfigValidation {
    const errors: string[] = [];
    if (!config.apiKey) {
      errors.push('API key is required');
    } else if (!config.apiKey.startsWith('gsk_')) {
      errors.push('Invalid Groq API key format (should start with gsk_)');
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
