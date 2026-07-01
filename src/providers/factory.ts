import { AIProvider, ProviderConfig } from '../types/index.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { GroqProvider } from './groq.js';
import { MetaAIProvider } from './meta.js';
import { OpenRouterProvider } from './openrouter.js';
import { DeepSeekProvider } from './deepseek.js';
import { KimiProvider } from './kimi.js';
import { ZhipuProvider } from './zhipu.js';
import { QwenProvider } from './qwen.js';
import { MiniMaxProvider } from './minimax.js';
import { NIMProvider } from './nim.js';
import { OllamaProvider } from './ollama.js';
import { EchoAIProvider } from './echoai.js';

export class ProviderFactory {
  getProvider(name: string, config: ProviderConfig): AIProvider {
    switch (name.toLowerCase()) {
      case 'echoai':
        return new EchoAIProvider(config);
      case 'claude':
        return new ClaudeProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'deepseek':
        return new DeepSeekProvider(config);
      case 'kimi':
        return new KimiProvider(config);
      case 'zhipu':
      case 'glm':
        return new ZhipuProvider(config);
      case 'qwen':
      case 'dashscope':
        return new QwenProvider(config);
      case 'minimax':
        return new MiniMaxProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'nim':
        return new NIMProvider(config);
      case 'groq':
        return new GroqProvider(config);
      case 'meta':
        return new MetaAIProvider(config);
      case 'openrouter':
        return new OpenRouterProvider(config);
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  getAvailableProviders(): string[] {
    return [
      'echoai',
      'claude',
      'openai',
      'deepseek',
      'kimi',
      'zhipu',
      'qwen',
      'minimax',
      'nim',
      'ollama',
      'groq',
      'meta',
      'openrouter',
    ];
  }
}

export const providerFactory = new ProviderFactory();
