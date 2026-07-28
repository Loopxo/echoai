import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  KernelSession,
  KernelSessionEventRecord,
  SessionExportOptions,
  SessionListFilter,
  SessionRegistryOptions,
} from "./types.js";

function resolveStateDir(options?: SessionRegistryOptions): string {
  const configured = options?.stateDir ?? process.env.ECHOAI_STATE_DIR?.trim();
  return configured && configured.length > 0
    ? path.resolve(configured)
    : path.join(os.homedir(), ".echoai");
}

function createDefaultSession(
  id: string,
  title: string,
  provider?: string,
  model?: string
): KernelSession {
  const now = Date.now();
  return {
    id,
    title,
    provider,
    model,
    mode: "default",
    messages: [],
    approvals: [],
    tasks: [],
    artifacts: [],
    background: { status: "idle" },
    worktree: { enabled: false },
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export class SessionRegistry {
  private readonly stateRoot: string;
  private readonly sessionsDir: string;
  private readonly eventsDir: string;

  constructor(options?: SessionRegistryOptions) {
    const namespace = options?.namespace ?? "runtime";
    this.stateRoot = path.join(resolveStateDir(options), namespace);
    this.sessionsDir = path.join(this.stateRoot, "sessions");
    this.eventsDir = path.join(this.stateRoot, "events");
  }

  async create(title: string, provider?: string, model?: string): Promise<KernelSession> {
    const session = createDefaultSession(randomUUID(), title, provider, model);
    await this.save(session);
    return session;
  }

  async save(session: KernelSession): Promise<void> {
    session.updatedAt = Date.now();
    await ensurePrivateDirectory(path.dirname(this.stateRoot));
    await ensurePrivateDirectory(this.stateRoot);
    await ensurePrivateDirectory(this.sessionsDir);
    const filePath = this.getFilePath(session.id);
    const tmpPath = `${filePath}.${randomUUID()}.tmp`;

    // Messages are event-sourced. Everything else is snapshotted, with
    // credential-shaped metadata recursively redacted before it reaches disk.
    const metadataSession = sanitizeForPersistence({
      ...session,
      messages: [],
    });

    await fs.writeFile(tmpPath, JSON.stringify(metadataSession, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.chmod(tmpPath, 0o600);
    await fs.rename(tmpPath, filePath);
    await fs.chmod(filePath, 0o600);
  }

  async load(sessionId: string): Promise<KernelSession | null> {
    try {
      const filePath = this.getFilePath(sessionId);
      await fs.chmod(filePath, 0o600);
      const raw = await fs.readFile(filePath, "utf8");
      const metadata = JSON.parse(raw) as KernelSession;
      
      // Reconstruct state from JSONL events
      const events = await this.readEventLog(sessionId);
      
      // Replay events to rebuild messages
      for (const event of events) {
        if (event.type === 'message.created') {
           const payload = event.payload as { message: any };
           if (payload.message) metadata.messages.push(payload.message);
        } else if (event.type === 'session.compacted') {
           // Handle compaction event
           const payload = event.payload as { messages: any[] };
           if (payload.messages) metadata.messages = payload.messages;
        }
      }
      
      return metadata;
    } catch {
      return null;
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      await fs.unlink(this.getFilePath(sessionId));
      await fs.rm(this.getEventLogPath(sessionId), { force: true });
      return true;
    } catch {
      return false;
    }
  }

  async list(filter: SessionListFilter = {}): Promise<KernelSession[]> {
    try {
      const query = filter.query?.trim().toLowerCase();
      const entries = await fs.readdir(this.sessionsDir);
      const sessions = await Promise.all(
        entries
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => {
            const filePath = path.join(this.sessionsDir, entry);
            await fs.chmod(filePath, 0o600);
            const raw = await fs.readFile(filePath, "utf8");
            const snapshot = JSON.parse(raw) as KernelSession;
            return query ? (await this.load(snapshot.id)) ?? snapshot : snapshot;
          })
      );

      return sessions
        .filter((session) => {
          if (filter.provider && session.provider !== filter.provider) {
            return false;
          }
          if (filter.mode && session.mode !== filter.mode) {
            return false;
          }
          if (query) {
            const haystack = JSON.stringify({
              title: session.title,
              messages: session.messages.map((message) => message.content),
            }).toLowerCase();
            return haystack.includes(query);
          }
          return true;
        })
        .map((session) => query ? { ...session, messages: [] } : session)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  async exportSession(
    sessionId: string,
    options: SessionExportOptions = {}
  ): Promise<string> {
    const session = await this.load(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const payload: Record<string, unknown> = {
      id: session.id,
      title: session.title,
      provider: session.provider,
      model: session.model,
      mode: session.mode,
      messages: session.messages,
      artifacts: session.artifacts,
      background: session.background,
      worktree: session.worktree,
    };

    if (options.includeMetadata !== false) {
      payload.metadata = session.metadata;
      payload.createdAt = session.createdAt;
      payload.updatedAt = session.updatedAt;
      payload.compactedAt = session.compactedAt;
    }

    if (options.includeTasks !== false) {
      payload.tasks = session.tasks;
    }

    if (options.includeApprovals !== false) {
      payload.approvals = session.approvals;
    }

    return JSON.stringify(sanitizeForPersistence(payload), null, 2);
  }

  async appendEvent(
    sessionId: string,
    type: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: KernelSessionEventRecord = sanitizeForPersistence({
      id: randomUUID(),
      sessionId,
      type,
      createdAt: Date.now(),
      payload,
    }) as KernelSessionEventRecord;

    await ensurePrivateDirectory(path.dirname(this.stateRoot));
    await ensurePrivateDirectory(this.stateRoot);
    await ensurePrivateDirectory(this.eventsDir);
    const eventPath = this.getEventLogPath(sessionId);
    await fs.appendFile(eventPath, `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.chmod(eventPath, 0o600);
  }

  async readEventLog(sessionId: string): Promise<KernelSessionEventRecord[]> {
    try {
      const eventPath = this.getEventLogPath(sessionId);
      await fs.chmod(eventPath, 0o600);
      const raw = await fs.readFile(eventPath, "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as KernelSessionEventRecord);
    } catch {
      return [];
    }
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${requireSafeSessionId(sessionId)}.json`);
  }

  private getEventLogPath(sessionId: string): string {
    return path.join(this.eventsDir, `${requireSafeSessionId(sessionId)}.jsonl`);
  }
}

function requireSafeSessionId(sessionId: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(sessionId)) {
    throw new Error("Invalid session ID");
  }
  return sessionId;
}

const SENSITIVE_PERSISTENCE_KEYS = new Set([
  "authorization",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "password",
  "secret",
  "clientsecret",
  "privatekey",
  "cookie",
  "setcookie",
  "headers",
  "env",
]);

async function ensurePrivateDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
}

function sanitizeForPersistence(value: unknown, key?: string): unknown {
  if (key && isSensitivePersistenceKey(key)) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForPersistence(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[entryKey] = sanitizeForPersistence(entryValue, entryKey);
  }
  return sanitized;
}

function isSensitivePersistenceKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SENSITIVE_PERSISTENCE_KEYS.has(normalized)
    || normalized.endsWith("token")
    || normalized.endsWith("secret")
    || normalized.endsWith("password")
    || normalized.endsWith("apikey");
}
