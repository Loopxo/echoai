import { ProviderConfig, ConfigValidation } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

/**
 * Ollama provider — fully free, local models for students with zero spend.
 *
 * Ollama exposes an OpenAI-compatible endpoint at /v1, so we extend
 * OpenAIProvider. No API key is required for a local Ollama server; a dummy key
 * is used to satisfy the OpenAI client. Override the host with OLLAMA_HOST or
 * config.baseUrl. Pull a coding model first, e.g. `ollama pull qwen2.5-coder`.
 */
export class OllamaProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    const baseUrl = config.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434/v1';
    super({ ...config, baseUrl, apiKey: config.apiKey || 'ollama' });
    this.name = 'ollama';
    this.models = [
      'qwen2.5-coder',
      'qwen2.5-coder:32b',
      'deepseek-coder-v2',
      'llama3.1',
      'qwen3',
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'qwen2.5-coder';
  }

  async authenticate(_apiKey: string): Promise<boolean> {
    // Local server needs no key; just verify it is reachable.
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey: this.config.apiKey || 'ollama',
        baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
      });
      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });
      return true;
    } catch (error) {
      console.error('Ollama connection failed (is `ollama serve` running?):', error instanceof Error ? error.message : error);
      return false;
    }
  }

  validateConfig(_config: ProviderConfig): ConfigValidation {
    // No key required for local Ollama.
    return { isValid: true, errors: [] };
  }
}
