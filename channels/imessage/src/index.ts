/**
 * EchoAI iMessage Channel
 *
 * macOS iMessage integration via JSON-RPC subprocess.
 * Requires the `imsg` CLI tool to be installed.
 *
 * Features:
 * - Send/receive iMessages
 * - SMS fallback support
 * - Group messaging
 * - File attachments
 * - Chat history monitoring
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { EventEmitter } from "node:events";

// =============================================================================
// Types
// =============================================================================

export interface IMessageConfig {
    /** Path to imsg CLI (default: "imsg") */
    cliPath?: string;
    /** Path to Messages database */
    dbPath?: string;
    /** Default service: "iMessage" or "SMS" */
    service?: IMessageService;
    /** Region code (default: "US") */
    region?: string;
    /** Max media size in bytes */
    mediaMaxBytes?: number;
    /** Request timeout in ms */
    timeoutMs?: number;
}

export type IMessageService = "iMessage" | "SMS" | "auto";

export interface IMessageTarget {
    kind: "handle" | "chat_id" | "chat_guid" | "chat_identifier";
    to?: string;
    chatId?: number;
    chatGuid?: string;
    chatIdentifier?: string;
    service?: IMessageService;
}

export interface IMessageSendOptions {
    service?: IMessageService;
    mediaPath?: string;
    replyToGuid?: string;
    timeoutMs?: number;
}

export interface IMessageSendResult {
    messageId: string;
    success: boolean;
}

export interface IMessageIncoming {
    guid: string;
    text: string;
    sender: string;
    chatId: number;
    chatGuid: string;
    isGroup: boolean;
    timestamp: number;
    attachments?: IMessageAttachment[];
}

export interface IMessageAttachment {
    filename: string;
    path: string;
    mimeType: string;
    size: number;
}

export interface RpcError {
    code?: number;
    message?: string;
    data?: unknown;
}

export interface RpcResponse<T> {
    jsonrpc?: string;
    id?: string | number | null;
    result?: T;
    error?: RpcError;
    method?: string;
    params?: unknown;
}

export interface RpcNotification {
    method: string;
    params?: unknown;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CLI_PATH = "imsg";

// =============================================================================
// RPC Client
// =============================================================================

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer?: NodeJS.Timeout;
}

export class IMessageRpcClient extends EventEmitter {
    private readonly cliPath: string;
    private readonly dbPath?: string;
    private readonly pending = new Map<string, PendingRequest>();
    private child: ChildProcessWithoutNullStreams | null = null;
    private reader: Interface | null = null;
    private nextId = 1;
    private closePromise: Promise<void> | null = null;
    private closeResolve: (() => void) | null = null;

    constructor(config: IMessageConfig = {}) {
        super();
        this.cliPath = config.cliPath?.trim() || DEFAULT_CLI_PATH;
        this.dbPath = config.dbPath?.trim();
    }

    async start(): Promise<void> {
        if (this.child) return;

        const args = ["rpc"];
        if (this.dbPath) {
            args.push("--db", this.dbPath);
        }

        this.closePromise = new Promise((resolve) => {
            this.closeResolve = resolve;
        });

        const child = spawn(this.cliPath, args, {
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.child = child;
        this.reader = createInterface({ input: child.stdout });

        this.reader.on("line", (line) => {
            const trimmed = line.trim();
            if (trimmed) {
                this.handleLine(trimmed);
            }
        });

        child.stderr?.on("data", (chunk) => {
            const text = chunk.toString().trim();
            if (text) {
                this.emit("error", new Error(`imsg stderr: ${text}`));
            }
        });

        child.on("error", (err) => {
            this.failAll(err);
            this.closeResolve?.();
        });

        child.on("close", (code, signal) => {
            if (code !== 0 && code !== null) {
                const reason = signal ? `signal ${signal}` : `code ${code}`;
                this.failAll(new Error(`imsg exited (${reason})`));
            }
            this.closeResolve?.();
        });
    }

    async stop(): Promise<void> {
        if (!this.child) return;

        this.reader?.close();
        this.reader = null;
        this.child.stdin?.end();

        const child = this.child;
        this.child = null;

        await Promise.race([
            this.closePromise,
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    if (!child.killed) child.kill("SIGTERM");
                    resolve();
                }, 500);
            }),
        ]);
    }

    async request<T = unknown>(
        method: string,
        params: Record<string, unknown> = {},
        timeoutMs = DEFAULT_TIMEOUT_MS
    ): Promise<T> {
        if (!this.child?.stdin) {
            throw new Error("iMessage RPC not running");
        }

        const id = this.nextId++;
        const payload = {
            jsonrpc: "2.0",
            id,
            method,
            params,
        };

        return new Promise<T>((resolve, reject) => {
            const key = String(id);
            const timer = timeoutMs > 0
                ? setTimeout(() => {
                    this.pending.delete(key);
                    reject(new Error(`iMessage RPC timeout (${method})`));
                }, timeoutMs)
                : undefined;

            this.pending.set(key, {
                resolve: (value) => resolve(value as T),
                reject,
                timer,
            });

            this.child!.stdin!.write(JSON.stringify(payload) + "\n");
        });
    }

    private handleLine(line: string): void {
        let parsed: RpcResponse<unknown>;
        try {
            parsed = JSON.parse(line);
        } catch {
            this.emit("error", new Error(`Failed to parse RPC response: ${line}`));
            return;
        }

        // Handle response
        if (parsed.id !== undefined && parsed.id !== null) {
            const key = String(parsed.id);
            const pending = this.pending.get(key);
            if (!pending) return;

            if (pending.timer) clearTimeout(pending.timer);
            this.pending.delete(key);

            if (parsed.error) {
                pending.reject(new Error(parsed.error.message || "RPC error"));
            } else {
                pending.resolve(parsed.result);
            }
            return;
        }

        // Handle notification
        if (parsed.method) {
            this.emit("notification", {
                method: parsed.method,
                params: parsed.params,
            } as RpcNotification);
        }
    }

    private failAll(err: Error): void {
        for (const [key, pending] of this.pending.entries()) {
            if (pending.timer) clearTimeout(pending.timer);
            pending.reject(err);
            this.pending.delete(key);
        }
    }
}

// =============================================================================
// Target Parsing
// =============================================================================

export function parseIMessageTarget(target: string): IMessageTarget {
    const trimmed = target.trim();

    // chat_id://<number>
    if (trimmed.startsWith("chat_id://")) {
        const id = parseInt(trimmed.replace("chat_id://", ""), 10);
        return { kind: "chat_id", chatId: id };
    }

    // chat_guid://<guid>
    if (trimmed.startsWith("chat_guid://")) {
        return { kind: "chat_guid", chatGuid: trimmed.replace("chat_guid://", "") };
    }

    // chat://<identifier>
    if (trimmed.startsWith("chat://")) {
        return { kind: "chat_identifier", chatIdentifier: trimmed.replace("chat://", "") };
    }

    // Phone number or email
    let service: IMessageService | undefined;
    let to = trimmed;

    if (trimmed.startsWith("sms:")) {
        service = "SMS";
        to = trimmed.replace("sms:", "");
    } else if (trimmed.startsWith("imessage:")) {
        service = "iMessage";
        to = trimmed.replace("imessage:", "");
    }

    return { kind: "handle", to, service };
}

export function formatChatTarget(chatId: number): string {
    return `chat_id://${chatId}`;
}

// =============================================================================
// iMessage Channel
// =============================================================================

export class IMessageChannel extends EventEmitter {
    private config: IMessageConfig;
    private client: IMessageRpcClient | null = null;
    private running = false;

    constructor(config: IMessageConfig = {}) {
        super();
        this.config = {
            cliPath: config.cliPath || DEFAULT_CLI_PATH,
            dbPath: config.dbPath,
            service: config.service || "auto",
            region: config.region || "US",
            mediaMaxBytes: config.mediaMaxBytes || 16 * 1024 * 1024,
            timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS,
        };
    }

    async start(): Promise<void> {
        if (this.running) return;

        this.client = new IMessageRpcClient(this.config);

        this.client.on("notification", (notification: RpcNotification) => {
            this.handleNotification(notification);
        });

        this.client.on("error", (err: Error) => {
            this.emit("error", err);
        });

        await this.client.start();
        this.running = true;

        // Start monitoring for new messages
        await this.startMonitoring();
    }

    async stop(): Promise<void> {
        if (!this.running || !this.client) return;

        this.running = false;
        await this.client.stop();
        this.client = null;
    }

    async sendMessage(
        to: string,
        text: string,
        options: IMessageSendOptions = {}
    ): Promise<IMessageSendResult> {
        if (!this.client) {
            throw new Error("iMessage channel not started");
        }

        const target = parseIMessageTarget(to);
        const params: Record<string, unknown> = {
            text,
            service: options.service || this.config.service || "auto",
            region: this.config.region,
        };

        // Set target
        if (target.kind === "chat_id") {
            params.chat_id = target.chatId;
        } else if (target.kind === "chat_guid") {
            params.chat_guid = target.chatGuid;
        } else if (target.kind === "chat_identifier") {
            params.chat_identifier = target.chatIdentifier;
        } else {
            params.to = target.to;
        }

        // Add attachment if provided
        if (options.mediaPath) {
            params.file = options.mediaPath;
        }

        // Add reply reference
        if (options.replyToGuid) {
            params.reply_to = options.replyToGuid;
        }

        const result = await this.client.request<{ ok?: string; messageId?: string }>(
            "send",
            params,
            options.timeoutMs || this.config.timeoutMs
        );

        return {
            messageId: result?.messageId || result?.ok || "unknown",
            success: true,
        };
    }

    async getChats(): Promise<Array<{ chatId: number; chatGuid: string; displayName: string }>> {
        if (!this.client) {
            throw new Error("iMessage channel not started");
        }

        const result = await this.client.request<{ chats: unknown[] }>("list_chats");
        return (result?.chats || []).map((chat: unknown) => {
            const c = chat as Record<string, unknown>;
            return {
                chatId: Number(c.chat_id || c.id || 0),
                chatGuid: String(c.chat_guid || c.guid || ""),
                displayName: String(c.display_name || c.name || "Unknown"),
            };
        });
    }

    async getMessages(
        chatId: number,
        limit = 50
    ): Promise<Array<{ guid: string; text: string; sender: string; timestamp: number }>> {
        if (!this.client) {
            throw new Error("iMessage channel not started");
        }

        const result = await this.client.request<{ messages: unknown[] }>("get_messages", {
            chat_id: chatId,
            limit,
        });

        return (result?.messages || []).map((msg: unknown) => {
            const m = msg as Record<string, unknown>;
            return {
                guid: String(m.guid || ""),
                text: String(m.text || ""),
                sender: String(m.sender || m.handle_id || ""),
                timestamp: Number(m.timestamp || m.date || 0),
            };
        });
    }

    private async startMonitoring(): Promise<void> {
        if (!this.client) return;

        try {
            await this.client.request("monitor_start");
        } catch {
            // Monitor might not be available; continue without it
        }
    }

    private handleNotification(notification: RpcNotification): void {
        if (notification.method === "new_message") {
            const params = notification.params as Record<string, unknown>;
            const message: IMessageIncoming = {
                guid: String(params.guid || ""),
                text: String(params.text || ""),
                sender: String(params.sender || params.handle_id || ""),
                chatId: Number(params.chat_id || 0),
                chatGuid: String(params.chat_guid || ""),
                isGroup: Boolean(params.is_group),
                timestamp: Number(params.timestamp || Date.now()),
                attachments: this.parseAttachments(params.attachments),
            };

            this.emit("message", message);
        }
    }

    private parseAttachments(raw: unknown): IMessageAttachment[] | undefined {
        if (!Array.isArray(raw) || raw.length === 0) return undefined;

        return raw.map((att: unknown) => {
            const a = att as Record<string, unknown>;
            return {
                filename: String(a.filename || a.name || "attachment"),
                path: String(a.path || a.file_path || ""),
                mimeType: String(a.mime_type || a.content_type || "application/octet-stream"),
                size: Number(a.size || 0),
            };
        });
    }
}

// =============================================================================
// Exports
// =============================================================================

export async function createIMessageChannel(
    config: IMessageConfig = {}
): Promise<IMessageChannel> {
    const channel = new IMessageChannel(config);
    await channel.start();
    return channel;
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_CLI_PATH };
