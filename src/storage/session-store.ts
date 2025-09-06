import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { SessionData, SessionMetadata, SessionFilter, SessionShare } from '../types/session.js';
import { v4 as uuidv4 } from 'uuid';

export class SessionStore {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor() {
    const echoDir = join(homedir(), '.echo');
    if (!existsSync(echoDir)) {
      mkdirSync(echoDir, { recursive: true });
    }

    this.dbPath = join(echoDir, 'sessions.db');
    this.db = new Database(this.dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        tags TEXT,
        parent_session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `);

    // Create session shares table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_shares (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        share_url TEXT NOT NULL UNIQUE,
        expires_at TEXT,
        is_public INTEGER NOT NULL DEFAULT 0,
        password TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_provider ON sessions (provider);
      CREATE INDEX IF NOT EXISTS idx_sessions_model ON sessions (model);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at);
      CREATE INDEX IF NOT EXISTS idx_session_shares_url ON session_shares (share_url);
    `);
  }

  async saveSession(sessionData: SessionData): Promise<void> {
    const { metadata, messages, config, context } = sessionData;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, title, provider, model, message_count, total_tokens, cost, tags,
        parent_session_id, created_at, updated_at, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metadata.id,
      metadata.title,
      metadata.provider,
      metadata.model,
      metadata.messageCount,
      metadata.totalTokens,
      metadata.cost || 0,
      metadata.tags ? JSON.stringify(metadata.tags) : null,
      metadata.parentSessionId || null,
      metadata.createdAt.toISOString(),
      metadata.updatedAt.toISOString(),
      JSON.stringify({ messages, config, context })
    );
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;

    if (!row) return null;

    const data = JSON.parse(row.data);
    return {
      metadata: {
        id: row.id,
        title: row.title,
        provider: row.provider,
        model: row.model,
        messageCount: row.message_count,
        totalTokens: row.total_tokens,
        cost: row.cost,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        parentSessionId: row.parent_session_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      messages: data.messages,
      config: data.config,
      context: data.context,
    };
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMetadata[]> {
    let query = 'SELECT * FROM sessions WHERE 1=1';
    const params: any[] = [];

    if (filter?.provider) {
      query += ' AND provider = ?';
      params.push(filter.provider);
    }

    if (filter?.model) {
      query += ' AND model = ?';
      params.push(filter.model);
    }

    if (filter?.tags) {
      const tagConditions = filter.tags.map(() => 'tags LIKE ?').join(' AND ');
      query += ` AND (${tagConditions})`;
      filter.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    if (filter?.dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(filter.dateRange.from.toISOString(), filter.dateRange.to.toISOString());
    }

    if (filter?.searchQuery) {
      query += ' AND (title LIKE ? OR data LIKE ?)';
      const searchTerm = `%${filter.searchQuery}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      provider: row.provider,
      model: row.model,
      messageCount: row.message_count,
      totalTokens: row.total_tokens,
      cost: row.cost,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      parentSessionId: row.parent_session_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(sessionId);
    return result.changes > 0;
  }

  async createShare(sessionId: string, options: {
    expiresAt?: Date;
    isPublic?: boolean;
    password?: string;
  } = {}): Promise<SessionShare> {
    const shareId = uuidv4();
    const shareUrl = `https://echo.ai/share/${shareId}`;

    const stmt = this.db.prepare(`
      INSERT INTO session_shares (
        id, session_id, share_url, expires_at, is_public, password, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      shareId,
      sessionId,
      shareUrl,
      options.expiresAt?.toISOString() || null,
      options.isPublic ? 1 : 0,
      options.password || null,
      new Date().toISOString()
    );

    return {
      id: shareId,
      sessionId,
      shareUrl,
      expiresAt: options.expiresAt,
      isPublic: options.isPublic || false,
      password: options.password,
      createdAt: new Date(),
    };
  }

  async getShare(shareId: string): Promise<SessionShare | null> {
    const stmt = this.db.prepare('SELECT * FROM session_shares WHERE id = ?');
    const row = stmt.get(shareId) as any;

    if (!row) return null;

    return {
      id: row.id,
      sessionId: row.session_id,
      shareUrl: row.share_url,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      isPublic: row.is_public === 1,
      password: row.password,
      createdAt: new Date(row.created_at),
    };
  }

  async listShares(sessionId: string): Promise<SessionShare[]> {
    const stmt = this.db.prepare('SELECT * FROM session_shares WHERE session_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(sessionId) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      shareUrl: row.share_url,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      isPublic: row.is_public === 1,
      password: row.password,
      createdAt: new Date(row.created_at),
    }));
  }

  async deleteShare(shareId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM session_shares WHERE id = ?');
    const result = stmt.run(shareId);
    return result.changes > 0;
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    providerBreakdown: Record<string, number>;
    modelBreakdown: Record<string, number>;
  }> {
    const totalStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(message_count) as total_messages,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost
      FROM sessions
    `).get() as any;

    const providerStats = this.db.prepare(`
      SELECT provider, COUNT(*) as count
      FROM sessions
      GROUP BY provider
      ORDER BY count DESC
    `).all() as any[];

    const modelStats = this.db.prepare(`
      SELECT model, COUNT(*) as count
      FROM sessions
      GROUP BY model
      ORDER BY count DESC
    `).all() as any[];

    const providerBreakdown: Record<string, number> = {};
    providerStats.forEach(row => {
      providerBreakdown[row.provider] = row.count;
    });

    const modelBreakdown: Record<string, number> = {};
    modelStats.forEach(row => {
      modelBreakdown[row.model] = row.count;
    });

    return {
      totalSessions: totalStats.total_sessions || 0,
      totalMessages: totalStats.total_messages || 0,
      totalTokens: totalStats.total_tokens || 0,
      totalCost: totalStats.total_cost || 0,
      providerBreakdown,
      modelBreakdown,
    };
  }

  close(): void {
    this.db.close();
  }
}