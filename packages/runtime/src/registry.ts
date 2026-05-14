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
  private readonly sessionsDir: string;
  private readonly eventsDir: string;

  constructor(options?: SessionRegistryOptions) {
    const namespace = options?.namespace ?? "runtime";
    const stateRoot = path.join(resolveStateDir(options), namespace);
    this.sessionsDir = path.join(stateRoot, "sessions");
    this.eventsDir = path.join(stateRoot, "events");
  }

  async create(title: string, provider?: string, model?: string): Promise<KernelSession> {
    const session = createDefaultSession(randomUUID(), title, provider, model);
    await this.save(session);
    return session;
  }

  async save(session: KernelSession): Promise<void> {
    session.updatedAt = Date.now();
    await fs.mkdir(this.sessionsDir, { recursive: true });
    const filePath = this.getFilePath(session.id);
    const tmpPath = `${filePath}.${randomUUID()}.tmp`;
    
    // Extract metadata to save in JSON
    // We only strip messages because tasks, artifacts, and approvals are modified in-place
    // and aren't fully event-sourced in the current architecture. Messages are fully event-sourced.
    const metadataSession = {
      ...session,
      messages: [], 
    };
    
    await fs.writeFile(tmpPath, JSON.stringify(metadataSession, null, 2), "utf8");
    await fs.rename(tmpPath, filePath);
    
    // Sync full state to events (Snapshot pattern)
    // We could optimize this later by only appending new events instead of full state,
    // but for now we'll ensure the JSONL log has the complete event state.
    // In kernel.ts, message.created events are already appended.
  }

  async load(sessionId: string): Promise<KernelSession | null> {
    try {
      const raw = await fs.readFile(this.getFilePath(sessionId), "utf8");
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
      const entries = await fs.readdir(this.sessionsDir);
      const sessions = await Promise.all(
        entries
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => {
            const raw = await fs.readFile(path.join(this.sessionsDir, entry), "utf8");
            return JSON.parse(raw) as KernelSession;
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
          if (filter.query) {
            const query = filter.query.toLowerCase();
            const haystack = JSON.stringify({
              title: session.title,
              messages: session.messages.map((message) => message.content),
            }).toLowerCase();
            return haystack.includes(query);
          }
          return true;
        })
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

    return JSON.stringify(payload, null, 2);
  }

  async appendEvent(
    sessionId: string,
    type: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: KernelSessionEventRecord = {
      id: randomUUID(),
      sessionId,
      type,
      createdAt: Date.now(),
      payload,
    };

    await fs.mkdir(this.eventsDir, { recursive: true });
    await fs.appendFile(this.getEventLogPath(sessionId), `${JSON.stringify(event)}\n`, "utf8");
  }

  async readEventLog(sessionId: string): Promise<KernelSessionEventRecord[]> {
    try {
      const raw = await fs.readFile(this.getEventLogPath(sessionId), "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as KernelSessionEventRecord);
    } catch {
      return [];
    }
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private getEventLogPath(sessionId: string): string {
    return path.join(this.eventsDir, `${sessionId}.jsonl`);
  }
}
