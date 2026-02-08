/**
 * EchoAI Sessions - Conversation Session Management
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const SESSIONS_DIR = path.join(STATE_DIR, "sessions");

export interface Message { role: "user" | "assistant" | "system" | "tool"; content: string; timestamp: number; metadata?: Record<string, unknown>; }
export interface Session { id: string; userId: string; channelId: string; messages: Message[]; context: Record<string, unknown>; createdAt: number; updatedAt: number; expiresAt?: number; }

export class SessionManager extends EventEmitter {
    private sessions: Map<string, Session> = new Map();
    private ttlMs: number;

    constructor(ttlMs = 3600000) { super(); this.ttlMs = ttlMs; }

    async create(userId: string, channelId: string, context: Record<string, unknown> = {}): Promise<Session> {
        const session: Session = {
            id: randomUUID(), userId, channelId, messages: [], context,
            createdAt: Date.now(), updatedAt: Date.now(),
            expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : undefined,
        };
        this.sessions.set(session.id, session);
        await this.persist(session);
        this.emit("created", session);
        return session;
    }

    async get(sessionId: string): Promise<Session | undefined> {
        let session = this.sessions.get(sessionId);
        if (!session) session = await this.load(sessionId);
        if (session?.expiresAt && Date.now() > session.expiresAt) {
            await this.delete(sessionId);
            return undefined;
        }
        return session || undefined;
    }

    async getByUser(userId: string, channelId?: string): Promise<Session[]> {
        const all = [...this.sessions.values()];
        return all.filter(s => s.userId === userId && (!channelId || s.channelId === channelId));
    }

    async addMessage(sessionId: string, message: Omit<Message, "timestamp">): Promise<void> {
        const session = await this.get(sessionId);
        if (!session) throw new Error("Session not found");
        session.messages.push({ ...message, timestamp: Date.now() });
        session.updatedAt = Date.now();
        if (session.expiresAt) session.expiresAt = Date.now() + this.ttlMs;
        await this.persist(session);
        this.emit("message", session, message);
    }

    async updateContext(sessionId: string, context: Record<string, unknown>): Promise<void> {
        const session = await this.get(sessionId);
        if (!session) throw new Error("Session not found");
        Object.assign(session.context, context);
        session.updatedAt = Date.now();
        await this.persist(session);
    }

    async delete(sessionId: string): Promise<boolean> {
        this.sessions.delete(sessionId);
        try { await fs.unlink(path.join(SESSIONS_DIR, `${sessionId}.json`)); } catch { /* ignore */ }
        this.emit("deleted", sessionId);
        return true;
    }

    async cleanup(): Promise<number> {
        let count = 0;
        for (const [id, session] of this.sessions) {
            if (session.expiresAt && Date.now() > session.expiresAt) {
                await this.delete(id);
                count++;
            }
        }
        return count;
    }

    private async persist(session: Session): Promise<void> {
        await fs.mkdir(SESSIONS_DIR, { recursive: true });
        await fs.writeFile(path.join(SESSIONS_DIR, `${session.id}.json`), JSON.stringify(session, null, 2));
    }

    private async load(sessionId: string): Promise<Session | undefined> {
        try {
            const data = await fs.readFile(path.join(SESSIONS_DIR, `${sessionId}.json`), "utf8");
            const session = JSON.parse(data) as Session;
            this.sessions.set(session.id, session);
            return session;
        } catch { return undefined; }
    }
}

export function createSessionManager(ttlMs?: number): SessionManager { return new SessionManager(ttlMs); }
