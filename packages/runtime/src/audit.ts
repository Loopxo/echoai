import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { KernelApprovalRecord, KernelToolCall, KernelToolResult } from "./types.js";
import type { PermissionRequest } from "./permissions.js";

export interface AuditEvent {
  id: string;
  sessionId: string;
  type: "permission" | "approval" | "tool";
  createdAt: number;
  payload: Record<string, unknown>;
}

export interface AuditLogStoreOptions {
  stateDir?: string;
  namespace?: string;
}

export class AuditLogStore {
  private readonly filePath: string;

  constructor(options: AuditLogStoreOptions = {}) {
    const root = options.stateDir ?? process.env.ECHOAI_STATE_DIR?.trim() ?? path.join(os.homedir(), ".echoai");
    const namespace = options.namespace ?? "runtime";
    this.filePath = path.join(root, namespace, "audit-log.ndjson");
  }

  async logPermission(request: PermissionRequest): Promise<void> {
    await this.append({
      sessionId: request.sessionId,
      type: "permission",
      payload: request as unknown as Record<string, unknown>,
    });
  }

  async logApproval(sessionId: string, approval: KernelApprovalRecord): Promise<void> {
    await this.append({
      sessionId,
      type: "approval",
      payload: approval as unknown as Record<string, unknown>,
    });
  }

  async logToolResult(sessionId: string, call: KernelToolCall, result: KernelToolResult): Promise<void> {
    await this.append({
      sessionId,
      type: "tool",
      payload: {
        call,
        result,
      },
    });
  }

  async readAll(): Promise<AuditEvent[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }

  private async append(event: Omit<AuditEvent, "id" | "createdAt">): Promise<void> {
    const payload: AuditEvent = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...event,
    };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}
