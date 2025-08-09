import { AIProvider } from '../types/index.js';
import { ConfigManager } from '../config/manager.js';

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async registerProvider(provider: AIProvider): Promise<void> {
    this.providers.set(provider.name, provider);
  }

  async getProvider(name: string): Promise<AIProvider> {
    if (!this.providers.has(name)) {
      await this.loadProvider(name);
    }

    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not found or failed to load`);
    }

    return provider;
  }

  private async loadProvider(name: string): Promise<void> {
    const config = await this.configManager.getProvider(name);
    if (!config) {
      throw new Error(`No configuration found for provider '${name}'. Run: ai config setup`);
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