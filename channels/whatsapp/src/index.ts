/**
 * WhatsApp Channel for EchoAI
 *
 * Integrates with WhatsApp using the Baileys library (WhatsApp Web API).
 */

import {
    type ChannelConfig,
    type ChannelContext,
    type ChannelStatus,
    BaseChannel,
    CHANNEL_META,
} from "@echoai/core";
import type { IncomingMessage, OutgoingMessage, ChannelId } from "@echoai/core";
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    proto,
    downloadMediaMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "node:path";
import os from "node:os";

// =============================================================================
// WhatsApp Channel Configuration
// =============================================================================

export interface WhatsAppChannelConfig extends ChannelConfig {
    /** Path to store auth state */
    authDir?: string;

    /** Self-chat mode: only respond to messages sent to yourself */
    selfChatMode?: boolean;

    /** Debounce delay for message processing (ms) */
    debounceMs?: number;

    /** Log level for pino */
    logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

    /** QR code print to terminal */
    printQR?: boolean;
}

// =============================================================================
// WhatsApp Channel Implementation
// =============================================================================

export class WhatsAppChannel extends BaseChannel {
    readonly id: ChannelId = "whatsapp";
    readonly meta = CHANNEL_META.whatsapp;

    private socket: WASocket | null = null;
    private authDir: string = "";
    private selfChatMode: boolean = false;
    private debounceMs: number = 1500;
    private ownJid: string = "";
    private messageDebounce = new Map<string, NodeJS.Timeout>();

    async start(config: WhatsAppChannelConfig): Promise<void> {
        this.config = config;
        this.selfChatMode = config.selfChatMode ?? false;
        this.debounceMs = config.debounceMs ?? 1500;

        // Resolve auth directory
        this.authDir = config.authDir
            ? path.resolve(config.authDir)
            : path.join(os.homedir(), ".echoai", "whatsapp-auth");

        console.log(`[whatsapp] Starting WhatsApp channel...`);
        console.log(`[whatsapp] Auth directory: ${this.authDir}`);

        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

        // Create logger
        const logger = pino({
            level: config.logLevel ?? "silent",
        });

        // Create socket
        this.socket = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: config.printQR ?? true,
            browser: ["EchoAI", "Chrome", "1.0.0"],
        });

        // Save credentials on update
        this.socket.ev.on("creds.update", saveCreds);

        // Handle connection updates
        this.socket.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`[whatsapp] Scan QR code to authenticate`);
            }

            if (connection === "close") {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(
                    `[whatsapp] Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`
                );

                this.status.connected = false;
                this.status.authenticated = false;

                if (shouldReconnect) {
                    // Retry connection
                    setTimeout(() => this.start(config), 5000);
                } else {
                    this.status.error = "Logged out from WhatsApp";
                }
            }

            if (connection === "open") {
                console.log(`[whatsapp] Connected successfully!`);
                this.status.connected = true;
                this.status.authenticated = true;
                this.status.error = undefined;

                // Store own JID
                if (this.socket?.user?.id) {
                    this.ownJid = this.socket.user.id.replace(/:\d+@/, "@");
                }
            }
        });

        // Handle incoming messages
        this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type !== "notify") return;

            for (const msg of messages) {
                await this.processMessage(msg);
            }
        });
    }

    async stop(): Promise<void> {
        console.log(`[whatsapp] Stopping WhatsApp channel...`);

        // Clear debounce timers
        for (const timer of this.messageDebounce.values()) {
            clearTimeout(timer);
        }
        this.messageDebounce.clear();

        // Close socket
        if (this.socket) {
            this.socket.end(undefined);
            this.socket = null;
        }

        this.status.connected = false;
        this.status.authenticated = false;
    }

    async send(
        target: string,
        message: OutgoingMessage,
        context?: ChannelContext
    ): Promise<void> {
        if (!this.socket) {
            throw new Error("WhatsApp not connected");
        }

        // Ensure target is a valid JID
        const jid = target.includes("@") ? target : `${target}@s.whatsapp.net`;

        // Send text message
        if (message.text) {
            await this.socket.sendMessage(jid, {
                text: message.text,
            });
        }

        // Send attachments
        if (message.attachments) {
            for (const attachment of message.attachments) {
                if (attachment.type === "image" && attachment.data) {
                    await this.socket.sendMessage(jid, {
                        image: Buffer.from(attachment.data, "base64"),
                        caption: message.text,
                    });
                }
                // Add more attachment types as needed
            }
        }

        this.status.lastActivity = Date.now();
    }

    private async processMessage(msg: proto.IWebMessageInfo): Promise<void> {
        if (!msg.message || !msg.key.remoteJid) return;

        // Ignore status broadcasts
        if (msg.key.remoteJid === "status@broadcast") return;

        // Self-chat mode: only process messages from self
        if (this.selfChatMode) {
            if (!msg.key.fromMe) return;
            if (msg.key.remoteJid !== this.ownJid) return;
        }

        // Extract message text
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            "";

        if (!text) return;

        const senderId = msg.key.remoteJid;
        const isGroup = senderId.endsWith("@g.us");
        const peerId = isGroup
            ? msg.key.participant || senderId
            : senderId;

        // Debounce to handle message bursts
        const debounceKey = `${senderId}-${peerId}`;
        const existingTimer = this.messageDebounce.get(debounceKey);

        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.messageDebounce.delete(debounceKey);

            // Create incoming message
            const incomingMessage: IncomingMessage = {
                id: msg.key.id || crypto.randomUUID(),
                channelId: "whatsapp",
                senderId: peerId.replace("@s.whatsapp.net", ""),
                text,
                timestamp: Date.now(),
                isGroup,
                groupId: isGroup ? senderId : undefined,
                raw: msg,
            };

            await this.handleIncomingMessage(incomingMessage);
        }, this.debounceMs);

        this.messageDebounce.set(debounceKey, timer);
    }
}

export default WhatsAppChannel;
