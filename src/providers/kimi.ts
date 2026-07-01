import { ProviderConfig } from '../types/index.js';
import { OpenAIProvider } from './openai.js';

export class KimiProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.moonshot.cn/v1',
    });
    this.name = 'kimi';
    this.models = [
      'kimi-k2-0711-preview', // K2 agentic/coding flagship
      'moonshot-v1-auto',
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k'
    ];
  }

  protected getDefaultModel(): string {
    return this.config.model || 'kimi-k2-0711-preview';
  }

  async authenticate(apiKey: string): Promise<boolean> {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || 'https://api.moonshot.cn/v1',
      });

      await client.chat.completions.create({
        model: this.getDefaultModel(),
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8,
      });

      return true;
    } catch (error) {
      console.error('Kimi authentication failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  protected sanitizeToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
    return sanitizeKimiSchema(schema) as Record<string, unknown>;
  }

  validateConfig(config: ProviderConfig) {
    const validation = super.validateConfig(config);
    if (!config.apiKey) {
      validation.isValid = false;
      validation.errors?.push('Kimi API key is required');
    }
    return validation;
  }
}

function sanitizeKimiSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeKimiSchema);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  if (typeof input.$ref === 'string') {
    return { $ref: input.$ref };
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (key === 'patternProperties' || key === 'unevaluatedProperties') continue;
    if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
      if (Array.isArray(child) && child.length > 0) {
        Object.assign(output, sanitizeKimiSchema(child[0]));
      }
      continue;
    }
    if (key === 'items' && Array.isArray(child)) {
      output.items = child.length > 0 ? sanitizeKimiSchema(child[0]) : {};
      continue;
    }
    output[key] = sanitizeKimiSchema(child);
  }

  return output;
}
