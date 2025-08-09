export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function validateApiKey(provider: string, apiKey: string): boolean {
  switch (provider) {
    case 'claude':
      return apiKey.startsWith('sk-ant-');
    case 'openai':
      return apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-') && !apiKey.startsWith('sk-or-');
    case 'groq':
      return apiKey.startsWith('gsk_');
    case 'openrouter':
      return apiKey.startsWith('sk-or-');
    case 'meta':
      return apiKey.length > 10; // Basic validation for Together AI keys
    case 'gemini':
      return apiKey.length > 10; // Basic validation
    default:
      return false;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function isValidTemperature(temp: number): boolean {
  return temp >= 0 && temp <= 2;
}

export function isValidMaxTokens(tokens: number): boolean {
  return tokens > 0 && tokens <= 32000; // Conservative limit
}