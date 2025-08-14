import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { Config, ProviderConfig, VSCodeConfig, GitConfig } from '../types/index.js';

const ProviderConfigSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

const VSCodeConfigSchema = z.object({
  enabled: z.boolean(),
  autoSave: z.boolean(),
  diffPreview: z.boolean(),
});

const GitConfigSchema = z.object({
  autoCommit: z.boolean(),
  commitMessageTemplate: z.string().optional(),
});

const TokenLimitsSchema = z.object({
  daily: z.number().positive().optional(),
  session: z.number().positive().optional(),
  monthly: z.number().positive().optional(),
  cost: z.object({
    daily: z.number().positive().optional(),
    monthly: z.number().positive().optional(),
  }).optional(),
});

const SoundConfigSchema = z.object({
  enabled: z.boolean(),
  volume: z.number().min(0).max(100),
  permissionPrompts: z.boolean(),
  tokenWarnings: z.boolean(),
  completionNotifications: z.boolean(),
});

const ConfigSchema = z.object({
  providers: z.record(ProviderConfigSchema),
  defaults: z.object({
    provider: z.string(),
    model: z.string(),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().positive(),
  }),
  integrations: z.object({
    vscode: VSCodeConfigSchema,
    git: GitConfigSchema,
  }),
  features: z.object({
    autoCommit: z.boolean(),
    diffPreview: z.boolean(),
    streaming: z.boolean(),
  }),
  limits: TokenLimitsSchema.optional(),
  sound: SoundConfigSchema.optional(),
});

export class ConfigManager {
  private explorer = cosmiconfig('ai', {
    searchPlaces: [
      'package.json',
      '.airc',
      '.airc.json',
      '.airc.yaml',
      '.airc.yml',
      '.ai/config.json',
      '.ai/config.yaml',
      '.ai/config.yml',
    ],
  });

  private globalConfigPath = join(homedir(), '.aiconfig', 'config.json');

  async getConfig(): Promise<Config> {
    // First try to load global config
    const globalConfig = this.loadGlobalConfig();
    
    // If global config has providers, use it
    if (globalConfig.providers && Object.keys(globalConfig.providers).length > 0) {
      return globalConfig;
    }
    
    // Otherwise, search for project-specific config
    const result = await this.explorer.search();
    
    if (result) {
      try {
        return ConfigSchema.parse(result.config);
      } catch (error) {
        console.warn('Invalid configuration found, using defaults');
      }
    }

    return globalConfig; // Return global config even if empty
  }

  private loadGlobalConfig(): Config {
    try {
      if (existsSync(this.globalConfigPath)) {
        const content = readFileSync(this.globalConfigPath, 'utf-8');
        const globalConfig = JSON.parse(content);
        const parsed = ConfigSchema.parse(globalConfig);
        return parsed;
      }
    } catch (error) {
      console.warn('Invalid global configuration, using defaults');
      if (error instanceof Error) {
        console.warn('Config error details:', error.message);
      }
    }

    return this.getDefaultConfig();
  }

  private getDefaultConfig(): Config {
    return {
      providers: {},
      defaults: {
        provider: 'claude',
        model: 'claude-3-sonnet-20240229',
        temperature: 0.7,
        maxTokens: 4096,
      },
      integrations: {
        vscode: {
          enabled: true,
          autoSave: true,
          diffPreview: true,
        },
        git: {
          autoCommit: false,
        },
      },
      features: {
        autoCommit: false,
        diffPreview: true,
        streaming: true,
      },
    };
  }

  async setGlobalConfig(config: Partial<Config>): Promise<void> {
    const existingConfig = await this.getConfig();
    const mergedConfig = this.mergeConfigs(existingConfig, config);
    
    const configDir = join(homedir(), '.aiconfig');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(this.globalConfigPath, JSON.stringify(mergedConfig, null, 2));
  }

  async setProvider(name: string, config: ProviderConfig): Promise<void> {
    const existingConfig = await this.getConfig();
    existingConfig.providers[name] = config;
    await this.setGlobalConfig(existingConfig);
  }

  async getProvider(name: string): Promise<ProviderConfig | null> {
    const config = await this.getConfig();
    return config.providers[name] || null;
  }

  async listProviders(): Promise<string[]> {
    const config = await this.getConfig();
    return Object.keys(config.providers);
  }

  validateConfig(config: unknown): { isValid: boolean; errors: string[] } {
    try {
      ConfigSchema.parse(config);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        };
      }
      return { isValid: false, errors: ['Unknown validation error'] };
    }
  }

  private mergeConfigs(existing: Config, partial: Partial<Config>): Config {
    return {
      ...existing,
      ...partial,
      providers: { ...existing.providers, ...partial.providers },
      defaults: { ...existing.defaults, ...partial.defaults },
      integrations: {
        vscode: { ...existing.integrations.vscode, ...partial.integrations?.vscode },
        git: { ...existing.integrations.git, ...partial.integrations?.git },
      },
      features: { ...existing.features, ...partial.features },
    };
  }
}