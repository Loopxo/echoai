import { ModelInfo, ModelTestResult } from '../types/models.js';
import { Message } from '../types/index.js';
import { modelsRegistry } from './registry.js';

export class UniversalModelProvider {
  private apiKeys: Map<string, string> = new Map();

  constructor() {
    this.loadApiKeys();
  }

  private loadApiKeys(): void {
    // Load API keys from environment variables
    const commonEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DEEPSEEK_API_KEY',
      'XAI_API_KEY',
      'FIREWORKS_API_KEY',
      'OPENROUTER_API_KEY',
      'GROQ_API_KEY',
      'COHERE_API_KEY',
      'GEMINI_API_KEY',
      'MISTRAL_API_KEY',
      'PERPLEXITY_API_KEY',
    ];

    commonEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        const provider = envVar.split('_')[0]?.toLowerCase() || '';
        this.apiKeys.set(provider, value);
      }
    });
  }

  async testModel(modelId: string, testPrompt: string = "Hello, how are you?"): Promise<ModelTestResult> {
    const startTime = Date.now();
    let model: ModelInfo | null = null;
    
    // Find the model across all providers
    const allModels = modelsRegistry.getAllModels();
    model = allModels.find(m => m.id === modelId) || null;

    if (!model) {
      return {
        modelId,
        provider: 'unknown',
        testName: 'basic_test',
        success: false,
        responseTime: Date.now() - startTime,
        tokensUsed: { input: 0, output: 0 },
        cost: 0,
        error: `Model ${modelId} not found in registry`,
      };
    }

    try {
      const provider = modelsRegistry.getProvider(model.provider);
      if (!provider) {
        throw new Error(`Provider ${model.provider} not found`);
      }

      const apiKey = this.getApiKey(provider);
      if (!apiKey) {
        throw new Error(`No API key found for provider ${model.provider}`);
      }

      const response = await this.callModel(provider, model, testPrompt, apiKey);
      const responseTime = Date.now() - startTime;

      return {
        modelId: model.id,
        provider: model.provider,
        testName: 'basic_test',
        success: true,
        responseTime,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
        response: response.content,
      };

    } catch (error) {
      return {
        modelId: model.id,
        provider: model.provider,
        testName: 'basic_test',
        success: false,
        responseTime: Date.now() - startTime,
        tokensUsed: { input: 0, output: 0 },
        cost: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *chatStream(
    modelId: string, 
    messages: Message[], 
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): AsyncGenerator<string> {
    const model = modelsRegistry.getAllModels().find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const provider = modelsRegistry.getProvider(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not found`);
    }

    const apiKey = this.getApiKey(provider);
    if (!apiKey) {
      throw new Error(`No API key for provider ${model.provider}`);
    }

    yield* this.streamModel(provider, model, messages, apiKey, options);
  }

  private getApiKey(provider: any): string | null {
    // Try multiple possible API key formats
    const possibleKeys = [
      provider.id.toUpperCase(),
      provider.id.toLowerCase(),
      provider.name.toUpperCase().replace(/\s+/g, '_'),
    ];

    for (const key of possibleKeys) {
      const apiKey = this.apiKeys.get(key) || process.env[`${key}_API_KEY`];
      if (apiKey) return apiKey;
    }

    // Check provider-specific environment variables
    if (provider.env) {
      for (const envVar of provider.env) {
        const value = process.env[envVar];
        if (value) return value;
      }
    }

    return null;
  }

  private async callModel(provider: any, model: ModelInfo, prompt: string, apiKey: string): Promise<{
    content: string;
    tokensUsed: { input: number; output: number };
    cost: number;
  }> {
    const requestPayload = this.buildRequestPayload(provider, model, prompt);
    const headers = this.buildHeaders(provider, apiKey);

    const response = await fetch(provider.api, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return this.parseResponse(data, model);
  }

  private async *streamModel(
    provider: any, 
    model: ModelInfo, 
    messages: Message[], 
    apiKey: string,
    options: { temperature?: number; maxTokens?: number }
  ): AsyncGenerator<string> {
    const requestPayload = this.buildStreamRequestPayload(provider, model, messages, options);
    const headers = this.buildHeaders(provider, apiKey);

    const response = await fetch(provider.api, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = this.extractStreamContent(parsed);
              if (content) yield content;
            } catch (error) {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildRequestPayload(provider: any, model: ModelInfo, prompt: string): any {
    // Build request based on provider type
    if (provider.api?.includes('openai') || provider.id === 'openai') {
      return {
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      };
    }

    if (provider.id === 'anthropic') {
      return {
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      };
    }

    // Default OpenAI-compatible format
    return {
      model: model.id,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    };
  }

  private buildStreamRequestPayload(provider: any, model: ModelInfo, messages: Message[], options: any): any {
    const payload = {
      model: model.id,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: options.maxTokens || 1000,
    };

    if (options.temperature !== undefined && model.temperature) {
      (payload as any).temperature = options.temperature;
    }

    return payload;
  }

  private buildHeaders(provider: any, apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Provider-specific authorization
    if (provider.id === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider.id === 'openrouter') {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://echo-ai.dev';
      headers['X-Title'] = 'Echo AI CLI';
    } else {
      // Default Bearer token
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  private parseResponse(data: any, model: ModelInfo): {
    content: string;
    tokensUsed: { input: number; output: number };
    cost: number;
  } {
    let content = '';
    let tokensUsed = { input: 0, output: 0 };

    // Extract content based on response format
    if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
    } else if (data.content?.[0]?.text) {
      content = data.content[0].text;
    } else if (data.message?.content) {
      content = data.message.content;
    } else {
      content = JSON.stringify(data);
    }

    // Extract token usage
    if (data.usage) {
      tokensUsed = {
        input: data.usage.prompt_tokens || 0,
        output: data.usage.completion_tokens || 0,
      };
    }

    // Calculate cost
    const cost = this.calculateCost(model, tokensUsed);

    return { content, tokensUsed, cost };
  }

  private extractStreamContent(data: any): string | null {
    if (data.choices?.[0]?.delta?.content) {
      return data.choices[0].delta.content;
    }
    if (data.delta?.text) {
      return data.delta.text;
    }
    return null;
  }

  private calculateCost(model: ModelInfo, tokens: { input: number; output: number }): number {
    if (!model.cost) return 0;

    const inputCost = (model.cost.input || 0) * tokens.input / 1000000; // Cost per million tokens
    const outputCost = (model.cost.output || 0) * tokens.output / 1000000;
    
    return inputCost + outputCost;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.apiKeys.keys());
  }

  setApiKey(provider: string, apiKey: string): void {
    this.apiKeys.set(provider, apiKey);
  }
}

// Global universal provider instance
export const universalProvider = new UniversalModelProvider();