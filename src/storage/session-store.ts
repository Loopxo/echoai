import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { resolveStateDir } from '@echoai/core';
import { SessionData, SessionFilter, SessionMetadata, SessionShare } from '../types/session.js';

interface StoredState {
  sessions: Record<string, StoredSessionRecord>;
  shares: Record<string, StoredShareRecord>;
}

interface StoredSessionRecord {
  metadata: Omit<SessionMetadata, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
  messages: SessionData['messages'];
  config: SessionData['config'];
  context?: SessionData['context'];
}

interface StoredShareRecord extends Omit<SessionShare, 'createdAt' | 'expiresAt'> {
  createdAt: string;
  expiresAt?: string;
}

const EMPTY_STATE: StoredState = {
  sessions: {},
  shares: {},
};

export class SessionStore {
  private readonly statePath: string;
  private state: StoredState;

  constructor() {
    const legacyDir = join(homedir(), '.echoai');
    const defaultDir = resolveStateDir();
    const echoDir = existsSync(defaultDir)
      ? defaultDir
      : (existsSync(legacyDir) ? legacyDir : defaultDir);

    if (!existsSync(echoDir)) {
      mkdirSync(echoDir, { recursive: true });
    }

    this.statePath = join(echoDir, 'sessions.json');
    this.state = this.readState();
  }

  async saveSession(sessionData: SessionData): Promise<void> {
    this.state.sessions[sessionData.metadata.id] = {
      metadata: {
        ...sessionData.metadata,
        createdAt: sessionData.metadata.createdAt.toISOString(),
        updatedAt: sessionData.metadata.updatedAt.toISOString(),
      },
      messages: sessionData.messages,
      config: sessionData.config,
      context: sessionData.context,
    };
    this.writeState();
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const record = this.state.sessions[sessionId];
    if (!record) {
      return null;
    }

    return this.deserializeSession(record);
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMetadata[]> {
    return Object.values(this.state.sessions)
      .map((record) => this.deserializeSession(record))
      .filter((session) => this.matchesFilter(session, filter))
      .map((session) => session.metadata)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.state.sessions[sessionId]) {
      return false;
    }

    delete this.state.sessions[sessionId];
    for (const [shareId, share] of Object.entries(this.state.shares)) {
      if (share.sessionId === sessionId) {
        delete this.state.shares[shareId];
      }
    }
    this.writeState();
    return true;
  }

  async createShare(sessionId: string, options: {
    expiresAt?: Date;
    isPublic?: boolean;
    password?: string;
  } = {}): Promise<SessionShare> {
    const shareId = uuidv4();
    const share: SessionShare = {
      id: shareId,
      sessionId,
      shareUrl: `https://echo.ai/share/${shareId}`,
      expiresAt: options.expiresAt,
      isPublic: options.isPublic || false,
      password: options.password,
      createdAt: new Date(),
    };

    this.state.shares[shareId] = {
      ...share,
      createdAt: share.createdAt.toISOString(),
      expiresAt: share.expiresAt?.toISOString(),
    };
    this.writeState();
    return share;
  }

  async getShare(shareId: string): Promise<SessionShare | null> {
    const record = this.state.shares[shareId];
    return record ? this.deserializeShare(record) : null;
  }

  async listShares(sessionId: string): Promise<SessionShare[]> {
    return Object.values(this.state.shares)
      .filter((share) => share.sessionId === sessionId)
      .map((share) => this.deserializeShare(share))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async deleteShare(shareId: string): Promise<boolean> {
    if (!this.state.shares[shareId]) {
      return false;
    }

    delete this.state.shares[shareId];
    this.writeState();
    return true;
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    providerBreakdown: Record<string, number>;
    modelBreakdown: Record<string, number>;
  }> {
    const sessions = Object.values(this.state.sessions).map((record) => this.deserializeSession(record).metadata);
    const providerBreakdown: Record<string, number> = {};
    const modelBreakdown: Record<string, number> = {};

    let totalMessages = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const session of sessions) {
      totalMessages += session.messageCount;
      totalTokens += session.totalTokens;
      totalCost += session.cost || 0;
      providerBreakdown[session.provider] = (providerBreakdown[session.provider] || 0) + 1;
      modelBreakdown[session.model] = (modelBreakdown[session.model] || 0) + 1;
    }

    return {
      totalSessions: sessions.length,
      totalMessages,
      totalTokens,
      totalCost,
      providerBreakdown,
      modelBreakdown,
    };
  }

  close(): void {}

  private readState(): StoredState {
    if (!existsSync(this.statePath)) {
      return { ...EMPTY_STATE };
    }

    try {
      const raw = JSON.parse(readFileSync(this.statePath, 'utf8')) as Partial<StoredState>;
      return {
        sessions: raw.sessions || {},
        shares: raw.shares || {},
      };
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  private writeState(): void {
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  private deserializeSession(record: StoredSessionRecord): SessionData {
    return {
      metadata: {
        ...record.metadata,
        createdAt: new Date(record.metadata.createdAt),
        updatedAt: new Date(record.metadata.updatedAt),
      },
      messages: record.messages.map((message) => ({
        ...message,
        timestamp: message.timestamp ? new Date(message.timestamp) : undefined,
      })),
      config: record.config,
      context: record.context,
    };
  }

  private deserializeShare(record: StoredShareRecord): SessionShare {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      expiresAt: record.expiresAt ? new Date(record.expiresAt) : undefined,
    };
  }

  private matchesFilter(session: SessionData, filter?: SessionFilter): boolean {
    if (!filter) {
      return true;
    }

    if (filter.provider && session.metadata.provider !== filter.provider) {
      return false;
    }

    if (filter.model && session.metadata.model !== filter.model) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const sessionTags = session.metadata.tags || [];
      if (!filter.tags.every((tag) => sessionTags.includes(tag))) {
        return false;
      }
    }

    if (filter.dateRange) {
      const createdAt = session.metadata.createdAt.getTime();
      if (createdAt < filter.dateRange.from.getTime() || createdAt > filter.dateRange.to.getTime()) {
        return false;
      }
    }

    if (filter.searchQuery) {
      const haystacks = [
        session.metadata.title,
        JSON.stringify(session.messages),
        JSON.stringify(session.context || {}),
      ].join('\n').toLowerCase();
      if (!haystacks.includes(filter.searchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  }
}
