/**
 * Channel Plugin Interface
 *
 * Defines the contract for messaging channel integrations.
 * Each channel (WhatsApp, Telegram, etc.) implements this interface.
 */

import type { IncomingMessage, OutgoingMessage, ChannelId, ChannelMeta } from "@echoai/core";

// =============================================================================
// Channel Plugin Types
// =============================================================================

export interface ChannelConfig {
    enabled?: boolean;
    dmPolicy?: "pairing" | "allowFrom" | "open";
    allowFrom?: string[];
    [key: string]: unknown;
}

export interface ChannelContext {
    sessionKey: string;
    agentId: string;
    peerId: string;
    isGroup: boolean;
    groupId?: string;
}

export interface ChannelPlugin {
    /** Unique channel identifier */
    id: ChannelId;

    /** Human-readable metadata */
    meta: ChannelMeta;

    /** Gateway methods this channel adds */
    gatewayMethods?: string[];

    /**
     * Initialize and start the channel.
     * Called when the gateway starts or when the channel is enabled.
     */
    start(config: ChannelConfig): Promise<void>;

    /**
     * Stop the channel gracefully.
     * Called when the gateway stops or when the channel is disabled.
     */
    stop(): Promise<void>;

    /**
     * Send a message through this channel.
     */
    send(target: string, message: OutgoingMessage, context?: ChannelContext): Promise<void>;

    /**
     * Set the message handler callback.
     * This is called by the gateway to receive messages from the channel.
     */
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;

    /**
     * Get the current connection status.
     */
    getStatus(): ChannelStatus;

    /**
     * Check if a sender is allowed based on DM policy.
     */
    isAllowed?(senderId: string, context?: ChannelContext): boolean;
}

export interface ChannelStatus {
    connected: boolean;
    authenticated: boolean;
    error?: string;
    lastActivity?: number;
    metadata?: Record<string, unknown>;
}

// =============================================================================
// Channel Registry
// =============================================================================

export const CHANNEL_ORDER: ChannelId[] = [
    "cli",
    "web",
    "whatsapp",
    "telegram",
    "discord",
    "slack",
    "signal",
    "imessage",
];

export const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
    cli: {
        id: "cli",
        label: "CLI",
        description: "Command-line interface",
    },
    web: {
        id: "web",
        label: "Web Canvas",
        description: "Browser-based chat interface",
    },
    whatsapp: {
        id: "whatsapp",
        label: "WhatsApp",
        description: "WhatsApp Web integration via Baileys",
    },
    telegram: {
        id: "telegram",
        label: "Telegram",
        description: "Telegram Bot API integration",
    },
    discord: {
        id: "discord",
        label: "Discord",
        description: "Discord Bot integration",
    },
    slack: {
        id: "slack",
        label: "Slack",
        description: "Slack Bot with Socket Mode",
    },
    signal: {
        id: "signal",
        label: "Signal",
        description: "Signal via signal-cli REST API",
    },
    imessage: {
        id: "imessage",
        label: "iMessage",
        description: "iMessage on macOS",
    },
};

// =============================================================================
// Base Channel Class
// =============================================================================

export abstract class BaseChannel implements ChannelPlugin {
    abstract id: ChannelId;
    abstract meta: ChannelMeta;

    protected config: ChannelConfig = {};
    protected messageHandler?: (message: IncomingMessage) => Promise<void>;
    protected status: ChannelStatus = {
        connected: false,
        authenticated: false,
    };

    abstract start(config: ChannelConfig): Promise<void>;
    abstract stop(): Promise<void>;
    abstract send(target: string, message: OutgoingMessage, context?: ChannelContext): Promise<void>;

    onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
        this.messageHandler = handler;
    }

    getStatus(): ChannelStatus {
        return { ...this.status };
    }

    isAllowed(senderId: string, context?: ChannelContext): boolean {
        const policy = this.config.dmPolicy ?? "pairing";

        switch (policy) {
            case "open":
                return true;

            case "allowFrom":
                const allowList = this.config.allowFrom ?? [];
                if (allowList.includes("*")) return true;
                return allowList.some((allowed) => {
                    // Support prefix matching (e.g., "+1" for US numbers)
                    if (allowed.endsWith("*")) {
                        return senderId.startsWith(allowed.slice(0, -1));
                    }
                    return senderId === allowed;
                });

            case "pairing":
            default:
                // Pairing mode requires explicit approval - handled by session system
                return false;
        }
    }

    protected async handleIncomingMessage(message: IncomingMessage): Promise<void> {
        if (!this.messageHandler) {
            console.warn(`[${this.id}] No message handler registered`);
            return;
        }

        // Update last activity
        this.status.lastActivity = Date.now();

        // Forward to handler
        await this.messageHandler(message);
    }
}
