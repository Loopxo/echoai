/**
 * Discord Channel for EchoAI
 *
 * Integrates with Discord using discord.js v14.
 */

import {
    type ChannelConfig,
    type ChannelContext,
    BaseChannel,
    CHANNEL_META,
} from "@echoai/core";
import type { IncomingMessage, OutgoingMessage, ChannelId } from "@echoai/core";
import {
    Client,
    GatewayIntentBits,
    Partials,
    Message as DiscordMessage,
    TextChannel,
    DMChannel,
} from "discord.js";

// =============================================================================
// Discord Channel Configuration
// =============================================================================

export interface DiscordChannelConfig extends ChannelConfig {
    /** Discord Bot token */
    token: string;

    /** Application ID for slash commands */
    applicationId?: string;

    /** Allowed server IDs (empty = all) */
    allowedGuilds?: string[];

    /** Allowed channel IDs (empty = all) */
    allowedChannels?: string[];

    /** Respond to DMs */
    allowDMs?: boolean;

    /** Require bot mention in servers */
    requireMention?: boolean;
}

// =============================================================================
// Discord Channel Implementation
// =============================================================================

export class DiscordChannel extends BaseChannel {
    readonly id: ChannelId = "discord";
    readonly meta = CHANNEL_META.discord;

    private client: Client | null = null;
    private requireMention: boolean = true;

    async start(config: DiscordChannelConfig): Promise<void> {
        if (!config.token) {
            throw new Error("Discord token is required");
        }

        this.config = config;
        this.requireMention = config.requireMention ?? true;

        console.log(`[discord] Starting Discord bot...`);

        // Create client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
            ],
            partials: [Partials.Channel, Partials.Message],
        });

        // Ready event
        this.client.once("ready", (client) => {
            console.log(`[discord] Bot connected as ${client.user.tag}`);
            this.status.connected = true;
            this.status.authenticated = true;
            this.status.metadata = {
                username: client.user.tag,
                guilds: client.guilds.cache.size,
            };
        });

        // Message event
        this.client.on("messageCreate", async (msg) => {
            await this.processMessage(msg);
        });

        // Error handling
        this.client.on("error", (error) => {
            console.error(`[discord] Client error:`, error);
            this.status.error = error.message;
        });

        // Login
        await this.client.login(config.token);
    }

    async stop(): Promise<void> {
        console.log(`[discord] Stopping Discord bot...`);

        if (this.client) {
            await this.client.destroy();
            this.client = null;
        }

        this.status.connected = false;
        this.status.authenticated = false;
    }

    async send(
        target: string,
        message: OutgoingMessage,
        context?: ChannelContext
    ): Promise<void> {
        if (!this.client) {
            throw new Error("Discord client not connected");
        }

        // Find the channel
        const channel = await this.client.channels.fetch(target);
        if (!channel || !("send" in channel)) {
            throw new Error(`Cannot send to channel: ${target}`);
        }

        const textChannel = channel as TextChannel | DMChannel;

        // Send text message
        if (message.text) {
            // Discord has a 2000 character limit
            const chunks = this.chunkMessage(message.text, 2000);

            for (const chunk of chunks) {
                await textChannel.send(chunk);
            }
        }

        // Send attachments
        if (message.attachments) {
            for (const attachment of message.attachments) {
                if (attachment.data) {
                    await textChannel.send({
                        files: [
                            {
                                attachment: Buffer.from(attachment.data, "base64"),
                                name: attachment.name || "file",
                            },
                        ],
                    });
                }
            }
        }

        this.status.lastActivity = Date.now();
    }

    private async processMessage(msg: DiscordMessage): Promise<void> {
        // Ignore bot messages
        if (msg.author.bot) return;

        const config = this.config as DiscordChannelConfig;
        const isDM = !msg.guild;

        // Check DM permission
        if (isDM && config.allowDMs === false) {
            return;
        }

        // Check guild allowlist
        if (!isDM && config.allowedGuilds?.length) {
            if (!config.allowedGuilds.includes(msg.guild!.id)) {
                return;
            }
        }

        // Check channel allowlist
        if (config.allowedChannels?.length) {
            if (!config.allowedChannels.includes(msg.channel.id)) {
                return;
            }
        }

        // Check mention requirement for servers
        if (!isDM && this.requireMention) {
            if (!msg.mentions.has(this.client!.user!.id)) {
                return;
            }
        }

        // Extract text (remove bot mention)
        let text = msg.content;
        if (this.client?.user) {
            text = text.replace(new RegExp(`<@!?${this.client.user.id}>`, "g"), "").trim();
        }

        if (!text) return;

        // Create incoming message
        const incomingMessage: IncomingMessage = {
            id: msg.id,
            channelId: "discord",
            senderId: msg.author.id,
            senderName: msg.author.displayName || msg.author.username,
            text,
            timestamp: msg.createdTimestamp,
            isGroup: !isDM,
            groupId: msg.guild?.id,
            groupName: msg.guild?.name,
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

export default DiscordChannel;
