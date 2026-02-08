/**
 * EchoAI Slack Channel
 *
 * Full-featured Slack integration supporting:
 * - Multiple workspaces via accounts
 * - Channel and DM messaging
 * - Threading with reply support
 * - File uploads with captions
 * - Message chunking for long responses
 */

import { WebClient, type RetryOptions, type WebClientOptions } from "@slack/web-api";
import { BaseChannel, CHANNEL_META, type ChannelConfig, type ChannelContext, type IncomingMessage, type OutgoingMessage, type ChannelMeta } from "@echoai/core";

// =============================================================================
// Types
// =============================================================================

export interface SlackChannelConfig extends ChannelConfig {
    botToken: string;
    appToken?: string;
    signingSecret?: string;
    defaultChannel?: string;
    accounts?: Record<string, SlackAccountConfig>;
}

export interface SlackAccountConfig {
    botToken: string;
    appToken?: string;
    allowedChannels?: string[];
    allowedUsers?: string[];
}

export interface SlackSendOptions {
    threadTs?: string;
    accountId?: string;
    mediaUrl?: string;
}

export interface SlackSendResult {
    messageId: string;
    channelId: string;
    threadTs?: string;
}

type SlackRecipient =
    | { kind: "user"; id: string }
    | { kind: "channel"; id: string };

// =============================================================================
// Constants
// =============================================================================

const SLACK_TEXT_LIMIT = 4000;

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    retries: 2,
    factor: 2,
    minTimeout: 500,
    maxTimeout: 3000,
    randomize: true,
};

// =============================================================================
// Slack Channel Implementation
// =============================================================================

export class SlackChannel extends BaseChannel {
    readonly id = "slack" as const;
    readonly meta: ChannelMeta = CHANNEL_META.slack;

    private client: WebClient | null = null;
    private accounts: Map<string, WebClient> = new Map();
    private slackConfig: SlackChannelConfig | null = null;

    async start(config: ChannelConfig): Promise<void> {
        this.config = config;
        this.slackConfig = config as SlackChannelConfig;

        if (!this.slackConfig.botToken) {
            throw new Error("Slack bot token is required (set channels.slack.botToken or SLACK_BOT_TOKEN)");
        }

        this.client = this.createClient(this.slackConfig.botToken);

        // Initialize account-specific clients
        if (this.slackConfig.accounts) {
            for (const [accountId, accountConfig] of Object.entries(this.slackConfig.accounts)) {
                this.accounts.set(accountId, this.createClient(accountConfig.botToken));
            }
        }

        // Verify authentication
        try {
            const auth = await this.client.auth.test();
            console.log(`[slack] Connected as @${auth.user} in workspace ${auth.team}`);
            this.status = { connected: true, authenticated: true, lastActivity: Date.now() };
        } catch (error) {
            console.error("[slack] Authentication failed:", error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.client = null;
        this.accounts.clear();
        this.status = { connected: false, authenticated: false };
        console.log("[slack] Disconnected");
    }

    async send(target: string, message: OutgoingMessage, context?: ChannelContext): Promise<void> {
        const options: SlackSendOptions = {
            threadTs: (context as Record<string, unknown> & ChannelContext)?.threadTs as string | undefined,
            accountId: (context as Record<string, unknown> & ChannelContext)?.accountId as string | undefined,
        };

        await this.sendMessage(target, message.text || "", options);
    }

    // =============================================================================
    // Core Messaging
    // =============================================================================

    async sendMessage(to: string, text: string, options: SlackSendOptions = {}): Promise<SlackSendResult> {
        const trimmedMessage = text?.trim() ?? "";
        if (!trimmedMessage && !options.mediaUrl) {
            throw new Error("Slack send requires text or media");
        }

        const client = this.getClient(options.accountId);
        const recipient = this.parseRecipient(to);
        const { channelId } = await this.resolveChannelId(client, recipient);

        // Chunk long messages
        const chunks = this.chunkText(trimmedMessage, SLACK_TEXT_LIMIT);

        let lastMessageId = "";
        let lastThreadTs = options.threadTs;

        // Handle media upload if present
        if (options.mediaUrl) {
            const [firstChunk, ...rest] = chunks.length ? chunks : [""];
            lastMessageId = await this.uploadFile({
                client,
                channelId,
                mediaUrl: options.mediaUrl,
                caption: firstChunk || undefined,
                threadTs: options.threadTs,
            });

            for (const chunk of rest) {
                const response = await client.chat.postMessage({
                    channel: channelId,
                    text: chunk,
                    thread_ts: lastThreadTs,
                });
                lastMessageId = response.ts ?? lastMessageId;
                lastThreadTs = response.ts ?? lastThreadTs;
            }
        } else {
            // Send text chunks
            for (const chunk of chunks.length ? chunks : [""]) {
                const response = await client.chat.postMessage({
                    channel: channelId,
                    text: chunk,
                    thread_ts: lastThreadTs,
                });
                lastMessageId = response.ts ?? lastMessageId;
                lastThreadTs = response.ts ?? lastThreadTs;
            }
        }

        return {
            messageId: lastMessageId || "unknown",
            channelId,
            threadTs: lastThreadTs,
        };
    }

    // =============================================================================
    // Message Actions
    // =============================================================================

    async deleteMessage(channelId: string, messageTs: string, accountId?: string): Promise<void> {
        const client = this.getClient(accountId);
        await client.chat.delete({ channel: channelId, ts: messageTs });
    }

    async editMessage(channelId: string, messageTs: string, text: string, accountId?: string): Promise<void> {
        const client = this.getClient(accountId);
        await client.chat.update({ channel: channelId, ts: messageTs, text });
    }

    async addReaction(channelId: string, messageTs: string, emoji: string, accountId?: string): Promise<void> {
        const client = this.getClient(accountId);
        await client.reactions.add({ channel: channelId, timestamp: messageTs, name: emoji.replace(/:/g, "") });
    }

    async removeReaction(channelId: string, messageTs: string, emoji: string, accountId?: string): Promise<void> {
        const client = this.getClient(accountId);
        await client.reactions.remove({ channel: channelId, timestamp: messageTs, name: emoji.replace(/:/g, "") });
    }

    // =============================================================================
    // User & Channel Info
    // =============================================================================

    async getMemberInfo(userId: string, accountId?: string): Promise<Record<string, unknown> | null> {
        const client = this.getClient(accountId);
        try {
            const response = await client.users.info({ user: userId });
            return response.user as Record<string, unknown>;
        } catch {
            return null;
        }
    }

    async listChannels(accountId?: string): Promise<Array<{ id: string; name: string }>> {
        const client = this.getClient(accountId);
        const response = await client.conversations.list({ types: "public_channel,private_channel" });
        return (response.channels ?? []).map((ch: { id?: string; name?: string }) => ({
            id: ch.id ?? "",
            name: ch.name ?? "",
        }));
    }

    // =============================================================================
    // Internal Helpers
    // =============================================================================

    private createClient(token: string, options: WebClientOptions = {}): WebClient {
        return new WebClient(token, {
            ...options,
            retryConfig: options.retryConfig ?? DEFAULT_RETRY_OPTIONS,
        });
    }

    private getClient(accountId?: string): WebClient {
        if (accountId && this.accounts.has(accountId)) {
            return this.accounts.get(accountId)!;
        }
        if (!this.client) {
            throw new Error("Slack client not initialized");
        }
        return this.client;
    }

    private parseRecipient(raw: string): SlackRecipient {
        let value = raw.trim();
        if (!value) {
            throw new Error("Recipient is required for Slack sends");
        }

        if (value.toLowerCase().startsWith("slack:")) {
            value = value.slice(6).trim();
        }

        if (value.startsWith("@") || value.startsWith("U")) {
            return { kind: "user", id: value.replace(/^@/, "") };
        }
        if (value.startsWith("#")) {
            return { kind: "channel", id: value.replace(/^#/, "") };
        }
        if (value.startsWith("C") || value.startsWith("G")) {
            return { kind: "channel", id: value };
        }

        return { kind: "channel", id: value };
    }

    private async resolveChannelId(
        client: WebClient,
        recipient: SlackRecipient
    ): Promise<{ channelId: string; isDm?: boolean }> {
        if (recipient.kind === "channel") {
            return { channelId: recipient.id };
        }

        const response = await client.conversations.open({ users: recipient.id });
        const channelId = response.channel?.id;
        if (!channelId) {
            throw new Error("Failed to open Slack DM channel");
        }
        return { channelId, isDm: true };
    }

    private chunkText(text: string, limit: number): string[] {
        if (!text || text.length <= limit) {
            return text ? [text] : [];
        }

        const chunks: string[] = [];
        let remaining = text;

        while (remaining.length > limit) {
            let breakPoint = remaining.lastIndexOf("\n", limit);
            if (breakPoint <= 0 || breakPoint < limit * 0.5) {
                breakPoint = remaining.lastIndexOf(" ", limit);
            }
            if (breakPoint <= 0 || breakPoint < limit * 0.5) {
                breakPoint = limit;
            }

            chunks.push(remaining.slice(0, breakPoint).trim());
            remaining = remaining.slice(breakPoint).trim();
        }

        if (remaining) {
            chunks.push(remaining);
        }

        return chunks;
    }

    private async uploadFile(params: {
        client: WebClient;
        channelId: string;
        mediaUrl: string;
        caption?: string;
        threadTs?: string;
    }): Promise<string> {
        const response = await fetch(params.mediaUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch media: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const fileName = this.extractFileName(params.mediaUrl, contentType);

        // Build upload arguments - use object spread for optional fields
        const baseArgs = {
            channel_id: params.channelId,
            file: buffer,
            filename: fileName,
        };

        const uploadArgs = params.threadTs
            ? { ...baseArgs, thread_ts: params.threadTs, initial_comment: params.caption }
            : params.caption
                ? { ...baseArgs, initial_comment: params.caption }
                : baseArgs;

        const uploadResponse = await params.client.files.uploadV2(uploadArgs as Parameters<typeof params.client.files.uploadV2>[0]);

        const parsed = uploadResponse as { files?: Array<{ id?: string }>; file?: { id?: string } };
        return parsed.files?.[0]?.id ?? parsed.file?.id ?? "unknown";
    }

    private extractFileName(url: string, contentType: string): string {
        try {
            const urlPath = new URL(url).pathname;
            const baseName = urlPath.split("/").pop();
            if (baseName && baseName.includes(".")) {
                return baseName;
            }
        } catch { /* ignore */ }

        const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
        return `file_${Date.now()}.${ext}`;
    }
}

// =============================================================================
// Factory & Exports
// =============================================================================

export function createSlackChannel(): SlackChannel {
    return new SlackChannel();
}

export default SlackChannel;
