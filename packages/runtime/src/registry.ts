import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  KernelSession,
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

  constructor(options?: SessionRegistryOptions) {
    const namespace = options?.namespace ?? "runtime";
    this.sessionsDir = path.join(resolveStateDir(options), namespace, "sessions");
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
    await fs.writeFile(tmpPath, JSON.stringify(session, null, 2), "utf8");
    await fs.rename(tmpPath, filePath);
  }

  async load(sessionId: string): Promise<KernelSession | null> {
    try {
      const raw = await fs.readFile(this.getFilePath(sessionId), "utf8");
      return JSON.parse(raw) as KernelSession;
    } catch {
      return null;
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      await fs.unlink(this.getFilePath(sessionId));
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

  private getFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }
}
