import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KernelMessage, KernelSession, SessionRegistryOptions } from "./types.js";

export interface SessionMemoryRecord {
  sessionId: string;
  updatedAt: number;
  content: string;
}

export class SessionMemoryStore {
  private readonly memoryDir: string;

  constructor(options: SessionRegistryOptions = {}) {
    const root = options.stateDir ?? process.env.ECHOAI_STATE_DIR?.trim() ?? path.join(os.homedir(), ".echoai");
    const namespace = options.namespace ?? "runtime";
    this.memoryDir = path.join(root, namespace, "session-memory");
  }

  async read(sessionId: string): Promise<SessionMemoryRecord | null> {
    try {
      const raw = await fs.readFile(this.getPath(sessionId), "utf8");
      return JSON.parse(raw) as SessionMemoryRecord;
    } catch {
      return null;
    }
  }

  async write(session: KernelSession): Promise<SessionMemoryRecord> {
    const record: SessionMemoryRecord = {
      sessionId: session.id,
      updatedAt: Date.now(),
      content: buildSessionMemory(session),
    };

    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.getPath(session.id), JSON.stringify(record, null, 2), "utf8");
    return record;
  }

  private getPath(sessionId: string): string {
    return path.join(this.memoryDir, `${sessionId}.json`);
  }
}

export function buildSessionMemory(session: KernelSession): string {
  const latestUser = findLastMessage(session.messages, "user");
  const recentUsers = findRecentMessages(session.messages, "user", 3);
  const recentAssistants = findRecentMessages(session.messages, "assistant", 3);
  const recentTools = findRecentMessages(session.messages, "tool", 5);
  const workspaceRoot = readStringMetadata(session.metadata.workspaceRoot);
  const files = readStringArrayMetadata(session.metadata.files);

  const sections: string[] = [];
  sections.push(`Session: ${session.title}`);

  if (workspaceRoot) {
    sections.push(`Workspace: ${workspaceRoot}`);
  }

  if (session.provider || session.model) {
    sections.push(`Runtime: ${session.provider ?? "unknown"} / ${session.model ?? "unknown"}`);
  }

  if (latestUser) {
    sections.push(`Current objective: ${truncate(latestUser.content, 500)}`);
  }

  if (recentUsers.length > 0) {
    sections.push(
      `Recent user requests:\n${recentUsers.map((message) => `- ${truncate(message.content, 240)}`).join("\n")}`
    );
  }

  if (recentAssistants.length > 0) {
    sections.push(
      `Recent assistant responses:\n${recentAssistants.map((message) => `- ${truncate(message.content, 240)}`).join("\n")}`
    );
  }

  if (recentTools.length > 0) {
    sections.push(
      `Recent tool outcomes:\n${recentTools.map((message) => `- ${message.name ?? "tool"}: ${truncate(message.content, 180)}`).join("\n")}`
    );
  }

  if (files.length > 0) {
    sections.push(`Known files: ${files.slice(0, 20).join(", ")}`);
  }

  return sections.join("\n\n");
}

function findLastMessage(messages: KernelMessage[], role: KernelMessage["role"]): KernelMessage | undefined {
  return [...messages].reverse().find((message) => message.role === role);
}

function findRecentMessages(
  messages: KernelMessage[],
  role: KernelMessage["role"],
  limit: number
): KernelMessage[] {
  return messages
    .filter((message) => message.role === role && message.content.trim().length > 0)
    .slice(-limit);
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function readStringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringArrayMetadata(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}
