import { AIProvider, ProviderConfig } from '../types/index.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { MetaAIProvider } from './meta.js';

export class ProviderFactory {
  getProvider(name: string, config: ProviderConfig): AIProvider {
    switch (name.toLowerCase()) {
      case 'claude':
        return new ClaudeProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'groq':
        return new GroqProvider(config);
      case 'meta':
        return new MetaAIProvider(config);
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  getAvailableProviders(): string[] {
    return ['claude', 'openai', 'gemini', 'groq', 'meta'];
  }
}

export const providerFactory = new ProviderFactory();