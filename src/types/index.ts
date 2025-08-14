export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ConfigValidation {
  isValid: boolean;
  errors?: string[];
}

export interface AIProvider {
  name: string;
  models: string[];
  authenticate(apiKey: string): Promise<boolean>;
  chat(messages: Message[], options: ChatOptions): AsyncGenerator<string>;
  complete(prompt: string, options: CompletionOptions): Promise<string>;
  validateConfig(config: ProviderConfig): ConfigValidation;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface VSCodeConfig {
  enabled: boolean;
  autoSave: boolean;
  diffPreview: boolean;
}

export interface GitConfig {
  autoCommit: boolean;
  commitMessageTemplate?: string;
}

export interface TokenLimits {
  daily?: number;
  session?: number;
  monthly?: number;
  cost?: {
    daily?: number;
    monthly?: number;
  };
}

export interface SoundConfig {
  enabled: boolean;
  volume: number; // 0-100
  permissionPrompts: boolean;
  tokenWarnings: boolean;
  completionNotifications: boolean;
}

export interface Config {
  providers: {
    [key: string]: ProviderConfig;
  };
  defaults: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  integrations: {
    vscode: VSCodeConfig;
    git: GitConfig;
  };
  features: {
    autoCommit: boolean;
    diffPreview: boolean;
    streaming: boolean;
  };
  limits?: TokenLimits;
  sound?: SoundConfig;
}

export interface FileDiff {
  original: string;
  modified: string;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'add' | 'remove' | 'modify';
  lineNumber: number;
  content: string;
}

export interface FileOperations {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createDiff(original: string, modified: string): FileDiff;
  applyDiff(path: string, diff: FileDiff): Promise<void>;
  backupFile(path: string): Promise<string>;
}

export interface CommandContext {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  files?: string[];
  output?: string;
}