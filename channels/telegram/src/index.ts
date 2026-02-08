/**
 * Telegram Channel for EchoAI
 *
 * Integrates with Telegram using the grammY Bot framework.
 */

import {
    type ChannelConfig,
    type ChannelContext,
    BaseChannel,
    CHANNEL_META,
} from "@echoai/core";
import type { IncomingMessage, OutgoingMessage, ChannelId } from "@echoai/core";
import { Bot, Context } from "grammy";

// =============================================================================
// Telegram Channel Configuration
// =============================================================================

export interface TelegramChannelConfig extends ChannelConfig {
    /** Telegram Bot token from @BotFather */
    botToken: string;

    /** Stream mode for responses */
    streamMode?: "off" | "partial" | "block";

    /** Allowed chat IDs (empty = all) */
    allowedChats?: string[];
}

// =============================================================================
// Telegram Channel Implementation
// =============================================================================

export class TelegramChannel extends BaseChannel {
    readonly id: ChannelId = "telegram";
    readonly meta = CHANNEL_META.telegram;

    private bot: Bot | null = null;
    private streamMode: "off" | "partial" | "block" = "partial";

    async start(config: TelegramChannelConfig): Promise<void> {
        if (!config.botToken) {
            throw new Error("Telegram botToken is required");
        }

        this.config = config;
        this.streamMode = config.streamMode ?? "partial";

        console.log(`[telegram] Starting Telegram bot...`);

        // Create bot instance
        this.bot = new Bot(config.botToken);

        // Handle all messages
        this.bot.on("message:text", async (ctx) => {
            await this.processMessage(ctx);
        });

        // Handle photos with captions
        this.bot.on("message:photo", async (ctx) => {
            await this.processMessage(ctx);
        });

        // Handle errors
        this.bot.catch((err) => {
            console.error(`[telegram] Bot error:`, err);
            this.status.error = err.message;
        });

        // Start the bot
        this.bot.start({
            onStart: () => {
                console.log(`[telegram] Bot connected successfully!`);
                this.status.connected = true;
                this.status.authenticated = true;
            },
        });
    }

    async stop(): Promise<void> {
        console.log(`[telegram] Stopping Telegram bot...`);

        if (this.bot) {
            await this.bot.stop();
            this.bot = null;
        }

        this.status.connected = false;
        this.status.authenticated = false;
    }

    async send(
        target: string,
        message: OutgoingMessage,
        context?: ChannelContext
    ): Promise<void> {
        if (!this.bot) {
            throw new Error("Telegram bot not connected");
        }

        const chatId = target;

        // Send text message
        if (message.text) {
            // For long messages, chunk them
            const chunks = this.chunkMessage(message.text, 4096);

            for (const chunk of chunks) {
                await this.bot.api.sendMessage(chatId, chunk, {
                    parse_mode: "Markdown",
                });
            }
        }

        // Send attachments
        if (message.attachments) {
            for (const attachment of message.attachments) {
                if (attachment.type === "image" && attachment.data) {
                    await this.bot.api.sendPhoto(chatId, attachment.data);
                }
                // Add more attachment types as needed
            }
        }

        this.status.lastActivity = Date.now();
    }

    private async processMessage(ctx: Context): Promise<void> {
        const msg = ctx.message;
        if (!msg) return;

        const chatId = msg.chat.id.toString();
        const senderId = msg.from?.id.toString() || chatId;
        const senderName = msg.from
            ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ")
            : undefined;

        // Check if chat is allowed
        const allowedChats = (this.config as TelegramChannelConfig).allowedChats;
        if (allowedChats && allowedChats.length > 0) {
            if (!allowedChats.includes(chatId) && !allowedChats.includes(senderId)) {
                return;
            }
        }

        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        const text = msg.text || msg.caption || "";

        if (!text) return;

        // Create incoming message
        const incomingMessage: IncomingMessage = {
            id: msg.message_id.toString(),
            channelId: "telegram",
            senderId,
            senderName,
            text,
            timestamp: msg.date * 1000,
            isGroup,
            groupId: isGroup ? chatId : undefined,
            groupName: isGroup ? (msg.chat as { title?: string }).title : undefined,
            raw: msg,
        };

        await this.handleIncomingMessage(incomingMessage);
    }

    private chunkMessage(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        let remaining = text;

        while (remaining.length > 0) {
            if (remaining.length <= maxLength) {
                chunks.push(remaining);
                break;
            }

            // Find a good break point
            let breakPoint = remaining.lastIndexOf("\n", maxLength);
            if (breakPoint === -1 || breakPoint < maxLength / 2) {
                breakPoint = remaining.lastIndexOf(" ", maxLength);
            }
            if (breakPoint === -1 || breakPoint < maxLength / 2) {
                breakPoint = maxLength;
            }

            chunks.push(remaining.slice(0, breakPoint));
            remaining = remaining.slice(breakPoint).trim();
        }

        return chunks;
    }
}

export default TelegramChannel;
