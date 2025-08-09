import { describe, it, expect } from 'vitest';
import {
  formatError,
  validateApiKey,
  truncateText,
  formatFileSize,
  isValidTemperature,
  isValidMaxTokens,
} from '../index';

describe('Utility Functions', () => {
  describe('formatError', () => {
    it('should format Error objects', () => {
      const error = new Error('Test error message');
      expect(formatError(error)).toBe('Test error message');
    });

    it('should format non-Error objects', () => {
      expect(formatError('string error')).toBe('string error');
      expect(formatError(123)).toBe('123');
      expect(formatError(null)).toBe('null');
    });
  });

  describe('validateApiKey', () => {
    it('should validate Claude API keys', () => {
      expect(validateApiKey('claude', 'sk-ant-valid-key')).toBe(true);
      expect(validateApiKey('claude', 'invalid-key')).toBe(false);
      expect(validateApiKey('claude', 'sk-invalid-key')).toBe(false);
    });

    it('should validate OpenAI API keys', () => {
      expect(validateApiKey('openai', 'sk-valid-key')).toBe(true);
      expect(validateApiKey('openai', 'invalid-key')).toBe(false);
      expect(validateApiKey('openai', 'sk-ant-invalid')).toBe(false);
    });

    it('should validate Gemini API keys', () => {
      expect(validateApiKey('gemini', 'valid-gemini-key-123')).toBe(true);
      expect(validateApiKey('gemini', 'short')).toBe(false);
    });

    it('should return false for unknown providers', () => {
      expect(validateApiKey('unknown', 'any-key')).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very lo...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      expect(truncateText(shortText, 20)).toBe(shortText);
    });

    it('should handle exact length', () => {
      const text = 'Exactly twenty chars';
      expect(truncateText(text, 20)).toBe(text);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2097152)).toBe('2 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('isValidTemperature', () => {
    it('should validate temperature range', () => {
      expect(isValidTemperature(0)).toBe(true);
      expect(isValidTemperature(0.5)).toBe(true);
      expect(isValidTemperature(1)).toBe(true);
      expect(isValidTemperature(2)).toBe(true);
      
      expect(isValidTemperature(-0.1)).toBe(false);
      expect(isValidTemperature(2.1)).toBe(false);
    });
  });

  describe('isValidMaxTokens', () => {
    it('should validate max tokens range', () => {
      expect(isValidMaxTokens(1)).toBe(true);
      expect(isValidMaxTokens(1000)).toBe(true);
      expect(isValidMaxTokens(32000)).toBe(true);
      
      expect(isValidMaxTokens(0)).toBe(false);
      expect(isValidMaxTokens(-1)).toBe(false);
      expect(isValidMaxTokens(50000)).toBe(false);
    });
  });
});