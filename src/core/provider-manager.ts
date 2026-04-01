import { AIProvider } from '../types/index.js';
import { ConfigManager } from '../config/manager.js';

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private loadingProviders: Map<string, Promise<void>> = new Map();
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async registerProvider(provider: AIProvider): Promise<void> {
    this.providers.set(provider.name, provider);
  }

  async getProvider(name: string): Promise<AIProvider> {
    if (!this.providers.has(name)) {
      await this.ensureProviderLoaded(name);
    }

    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not found or failed to load`);
    }

    return provider;
  }

  private async ensureProviderLoaded(name: string): Promise<void> {
    const inFlight = this.loadingProviders.get(name);
    if (inFlight) {
      await inFlight;
      return;
    }

    const loadPromise = this.loadProvider(name).finally(() => {
      this.loadingProviders.delete(name);
    });

    this.loadingProviders.set(name, loadPromise);
    await loadPromise;
  }

  private async loadProvider(name: string): Promise<void> {
    const config = await this.configManager.getProvider(name);
    if (!config) {
      throw new Error(`No configuration found for provider '${name}'. Run: echo config setup`);
    }

    let provider: AIProvider;

    switch (name) {
      case 'claude':
        const { ClaudeProvider } = await import('../providers/claude.js');
        provider = new ClaudeProvider(config);
        break;
      
      case 'openai':
        const { OpenAIProvider } = await import('../providers/openai.js');
        provider = new OpenAIProvider(config);
        break;
      
      case 'gemini':
        const { GeminiProvider } = await import('../providers/gemini.js');
        provider = new GeminiProvider(config);
        break;
      
      case 'groq':
        const { GroqProvider } = await import('../providers/groq.js');
        provider = new GroqProvider(config);
        break;
      
      case 'meta':
        const { MetaAIProvider } = await import('../providers/meta.js');
        provider = new MetaAIProvider(config);
        break;
      
      default:
        throw new Error(`Unsupported provider: ${name}`);
    }

    const isAuthenticated = await provider.authenticate(config.apiKey);
    if (!isAuthenticated) {
      throw new Error(`Authentication failed for provider '${name}'. Please check your API key.`);
    }

    this.providers.set(name, provider);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async testProvider(name: string): Promise<boolean> {
    try {
      const provider = await this.getProvider(name);
      const config = await this.configManager.getProvider(name);
      
      if (!config) return false;
      
      return await provider.authenticate(config.apiKey);
    } catch (error) {
      return false;
    }
  }
}
