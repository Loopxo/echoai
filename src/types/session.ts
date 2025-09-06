import { Message } from './index.js';

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  provider: string;
  model: string;
  messageCount: number;
  totalTokens: number;
  cost?: number;
  tags?: string[];
  parentSessionId?: string;
}

export interface SessionData {
  metadata: SessionMetadata;
  messages: Message[];
  config: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  context?: {
    files?: string[];
    workingDirectory?: string;
    gitBranch?: string;
    gitCommit?: string;
  };
}

export interface SessionFilter {
  provider?: string;
  model?: string;
  tags?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  searchQuery?: string;
}

export interface SessionShare {
  id: string;
  sessionId: string;
  shareUrl: string;
  expiresAt?: Date;
  isPublic: boolean;
  password?: string;
  createdAt: Date;
}

export interface SessionExport {
  format: 'json' | 'markdown' | 'text';
  includeMetadata: boolean;
  includeContext: boolean;
  messageRange?: {
    from: number;
    to: number;
  };
}