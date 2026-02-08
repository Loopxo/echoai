/**
 * EchoAI Signal Channel
 *
 * Secure messaging integration via Signal-CLI REST API.
 * Features:
 * - End-to-end encrypted messaging
 * - Group and individual chats
 * - Reactions
 * - Typing indicators and read receipts
 * - Media attachments
 */

import { BaseChannel, CHANNEL_META, type ChannelConfig, type ChannelContext, type OutgoingMessage, type ChannelMeta } from "@echoai/core";

// =============================================================================
// Types
// =============================================================================

export interface SignalChannelConfig extends ChannelConfig {
    baseUrl: string;
    account: string;
    accounts?: Record<string, SignalAccountConfig>;
    mediaMaxMb?: number;
}

export interface SignalAccountConfig {
    baseUrl: string;
    account: string;
    mediaMaxMb?: number;
}

export interface SignalSendOptions {
    accountId?: string;
    mediaUrl?: string;
    maxBytes?: number;
    timeoutMs?: number;
}

export interface SignalSendResult {
    messageId: string;
    timestamp?: number;
}

type SignalTarget =
    | { type: "recipient"; recipient: string }
    | { type: "group"; groupId: string }
    | { type: "username"; username: string };

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30000;

// =============================================================================
// Signal Channel Implementation
// =============================================================================

export class SignalChannel extends BaseChannel {
    readonly id = "signal" as const;
    readonly meta: ChannelMeta = CHANNEL_META.signal;

    private signalConfig: SignalChannelConfig | null = null;

    async start(config: ChannelConfig): Promise<void> {
        this.config = config;
        this.signalConfig = config as SignalChannelConfig;

        if (!this.signalConfig.baseUrl) {
            throw new Error("Signal base URL is required (set channels.signal.baseUrl)");
        }
        if (!this.signalConfig.account) {
            throw new Error("Signal account is required (set channels.signal.account)");
        }

        // Verify connection
        try {
            const healthy = await this.checkHealth();
            if (!healthy) {
                throw new Error("Signal API not responding");
            }
            console.log(`[signal] Connected to ${this.signalConfig.baseUrl} as ${this.signalConfig.account}`);
            this.status = { connected: true, authenticated: true, lastActivity: Date.now() };
        } catch (error) {
            console.error("[signal] Connection failed:", error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.signalConfig = null;
        this.status = { connected: false, authenticated: false };
        console.log("[signal] Disconnected");
    }

    async send(target: string, message: OutgoingMessage, context?: ChannelContext): Promise<void> {
        const options: SignalSendOptions = {
            accountId: (context as Record<string, unknown> & ChannelContext)?.accountId as string | undefined,
        };

        await this.sendMessage(target, message.text || "", options);
    }

    // =============================================================================
    // Core Messaging
    // =============================================================================

    async sendMessage(to: string, text: string, options: SignalSendOptions = {}): Promise<SignalSendResult> {
        const { baseUrl, account, maxBytes } = this.resolveContext(options);
        const target = this.parseTarget(to);

        let message = text?.trim() ?? "";

        // Handle attachments
        let attachments: string[] | undefined;
        if (options.mediaUrl?.trim()) {
            const resolved = await this.saveAttachment(options.mediaUrl.trim(), maxBytes);
            attachments = [resolved];

            if (!message) {
                message = "<media:attachment>";
            }
        }

        if (!message && (!attachments || attachments.length === 0)) {
            throw new Error("Signal send requires text or media");
        }

        const params: Record<string, unknown> = { message };
        if (account) {
            params.account = account;
        }
        if (attachments && attachments.length > 0) {
            params.attachments = attachments;
        }

        const targetParams = this.buildTargetParams(target);
        Object.assign(params, targetParams);

        const result = await this.rpcRequest<{ timestamp?: number }>("send", params, {
            baseUrl,
            timeoutMs: options.timeoutMs,
        });

        const timestamp = result?.timestamp;
        return {
            messageId: timestamp ? String(timestamp) : "unknown",
            timestamp,
        };
    }

    async sendTyping(to: string, stop = false, options: Pick<SignalSendOptions, "accountId"> = {}): Promise<boolean> {
        const { baseUrl, account } = this.resolveContext(options);
        const target = this.parseTarget(to);

        const targetParams = this.buildTargetParams(target, { recipient: true, group: true });
        if (!targetParams) {
            return false;
        }

        const params: Record<string, unknown> = { ...targetParams };
        if (account) {
            params.account = account;
        }
        if (stop) {
            params.stop = true;
        }

        await this.rpcRequest("sendTyping", params, { baseUrl });
        return true;
    }

    async sendReadReceipt(
        to: string,
        targetTimestamp: number,
        options: Pick<SignalSendOptions, "accountId"> & { type?: "read" | "viewed" } = {}
    ): Promise<boolean> {
        if (!Number.isFinite(targetTimestamp) || targetTimestamp <= 0) {
            return false;
        }

        const { baseUrl, account } = this.resolveContext(options);
        const target = this.parseTarget(to);

        const targetParams = this.buildTargetParams(target, { recipient: true });
        if (!targetParams) {
            return false;
        }

        const params: Record<string, unknown> = {
            ...targetParams,
            targetTimestamp,
            type: options.type ?? "read",
        };

        if (account) {
            params.account = account;
        }

        await this.rpcRequest("sendReceipt", params, { baseUrl });
        return true;
    }

    // =============================================================================
    // Health Check
    // =============================================================================

    async checkHealth(): Promise<boolean> {
        if (!this.signalConfig) {
            return false;
        }

        try {
            const response = await fetch(`${this.signalConfig.baseUrl}/v1/about`, {
                method: "GET",
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // =============================================================================
    // Internal Helpers
    // =============================================================================

    private resolveContext(options: Pick<SignalSendOptions, "accountId" | "maxBytes">) {
        if (!this.signalConfig) {
            throw new Error("Signal channel not initialized");
        }

        let accountConfig: SignalAccountConfig | undefined;
        if (options.accountId && this.signalConfig.accounts?.[options.accountId]) {
            accountConfig = this.signalConfig.accounts[options.accountId];
        }

        const baseUrl = accountConfig?.baseUrl || this.signalConfig.baseUrl;
        const account = accountConfig?.account || this.signalConfig.account;
        const maxBytes = options.maxBytes ??
            (accountConfig?.mediaMaxMb ?? this.signalConfig.mediaMaxMb ?? 8) * 1024 * 1024;

        return { baseUrl, account, maxBytes };
    }

    private parseTarget(raw: string): SignalTarget {
        let value = raw.trim();
        if (!value) {
            throw new Error("Signal recipient is required");
        }

        if (value.toLowerCase().startsWith("signal:")) {
            value = value.slice(7).trim();
        }

        const normalized = value.toLowerCase();

        if (normalized.startsWith("group:")) {
            return { type: "group", groupId: value.slice(6).trim() };
        }
        if (normalized.startsWith("username:") || normalized.startsWith("u:")) {
            const username = normalized.startsWith("username:")
                ? value.slice(9).trim()
                : value.slice(2).trim();
            return { type: "username", username };
        }

        return { type: "recipient", recipient: value };
    }

    private buildTargetParams(
        target: SignalTarget,
        allow: { recipient?: boolean; group?: boolean; username?: boolean } = { recipient: true, group: true, username: true }
    ): Record<string, unknown> | null {
        if (target.type === "recipient" && allow.recipient !== false) {
            return { recipient: [target.recipient] };
        }
        if (target.type === "group" && allow.group !== false) {
            return { groupId: target.groupId };
        }
        if (target.type === "username" && allow.username !== false) {
            return { username: [target.username] };
        }
        return null;
    }

    private async rpcRequest<T>(
        method: string,
        params: Record<string, unknown>,
        options: { baseUrl: string; timeoutMs?: number }
    ): Promise<T | null> {
        const url = `${options.baseUrl}/v1/rpc`;
        const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: Date.now(),
                method,
                params,
            }),
            signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Signal RPC error: ${error}`);
        }

        const result = await response.json() as { result?: T; error?: { message?: string } };
        if (result.error) {
            throw new Error(`Signal RPC error: ${result.error.message ?? "Unknown error"}`);
        }

        return result.result ?? null;
    }

    private async saveAttachment(mediaUrl: string, maxBytes: number): Promise<string> {
        const response = await fetch(mediaUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch media: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > maxBytes) {
            throw new Error(`Media too large: ${buffer.length} bytes (max ${maxBytes})`);
        }

        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const os = await import("node:os");

        const tempDir = os.tmpdir();
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
        const fileName = `echoai_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = path.join(tempDir, fileName);

        await fs.writeFile(filePath, buffer);

        // Schedule cleanup after 5 minutes
        setTimeout(async () => {
            try {
                await fs.unlink(filePath);
            } catch { /* ignore */ }
        }, 5 * 60 * 1000);

        return filePath;
    }
}

// =============================================================================
// Factory & Exports
// =============================================================================

export function createSignalChannel(): SignalChannel {
    return new SignalChannel();
}

export default SignalChannel;
