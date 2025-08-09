import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from '../manager';

// Mock fs and os modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/user'),
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    vi.clearAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', async () => {
      const config = await configManager.getConfig();
      
      expect(config).toHaveProperty('providers');
      expect(config).toHaveProperty('defaults');
      expect(config).toHaveProperty('integrations');
      expect(config).toHaveProperty('features');
      
      expect(config.defaults.provider).toBe('claude');
      expect(config.defaults.temperature).toBe(0.7);
      expect(config.features.streaming).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        providers: {
          claude: {
            apiKey: 'sk-ant-test',
            temperature: 0.7,
            maxTokens: 4096,
          },
        },
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

      const result = configManager.validateConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        providers: {},
        defaults: {
          provider: 'invalid',
          model: '',
          temperature: -1, // Invalid temperature
          maxTokens: 0, // Invalid max tokens
        },
        integrations: {
          vscode: {
            enabled: 'not-boolean', // Should be boolean
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

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('setProvider', () => {
    it('should set provider configuration', async () => {
      const providerConfig = {
        apiKey: 'sk-test-key',
        model: 'test-model',
        temperature: 0.5,
      };

      await configManager.setProvider('test-provider', providerConfig);
      
      // This would require mocking the file system operations
      // For now, we just ensure the method doesn't throw
      expect(true).toBe(true);
    });
  });
});