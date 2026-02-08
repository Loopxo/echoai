/**
 * Core Types for EchoAI
 *
 * Shared type definitions used across all packages.
 */

// =============================================================================
// Message Types
// =============================================================================

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
    role: MessageRole;
    content: string;
    name?: string;
    toolCallId?: string;
    timestamp?: number;
}

export interface ChatMessage extends Message {
    id: string;
    sessionKey: string;
    channelId?: string;
    senderId?: string;
    attachments?: Attachment[];
}

export interface Attachment {
    type: "image" | "audio" | "video" | "file";
    mimeType: string;
    data?: string; // base64 or URL
    path?: string;
    name?: string;
    size?: number;
}

// =============================================================================
// Session Types
// =============================================================================

export interface Session {
    key: string;
    agentId: string;
    channelId?: string;
    peerId?: string;
    createdAt: number;
    lastActiveAt: number;
    messages: ChatMessage[];
    metadata?: Record<string, unknown>;
}

export interface SessionSummary {
    key: string;
    agentId: string;
    messageCount: number;
    lastActiveAt: number;
}

// =============================================================================
// Agent Types
// =============================================================================

export interface AgentCapability {
    id: string;
    name: string;
    description: string;
    intents: string[];
    contexts: string[];
    tools?: string[];
    priority: number;
}

export interface AgentRun {
    id: string;
    sessionKey: string;
    agentId: string;
    status: "pending" | "running" | "completed" | "error";
    startedAt: number;
    endedAt?: number;
    error?: string;
}

// =============================================================================
// Channel Types
// =============================================================================

export type ChannelId =
    | "cli"
    | "web"
    | "whatsapp"
    | "telegram"
    | "discord"
    | "slack"
    | "signal"
    | "imessage";

export interface ChannelMeta {
    id: ChannelId;
    label: string;
    description?: string;
    systemImage?: string;
}

export interface OutgoingMessage {
    text?: string;
    attachments?: Attachment[];
    replyTo?: string;
    metadata?: Record<string, unknown>;
}

export interface IncomingMessage {
    id: string;
    channelId: ChannelId;
    senderId: string;
    senderName?: string;
    text?: string;
    attachments?: Attachment[];
    replyTo?: string;
    timestamp: number;
    isGroup?: boolean;
    groupId?: string;
    groupName?: string;
    raw?: unknown;
}

// =============================================================================
// Gateway Types
// =============================================================================

export interface GatewayClient {
    id: string;
    type: "cli" | "canvas" | "node" | "channel";
    connectedAt: number;
    metadata?: Record<string, unknown>;
}

export interface GatewayEvent {
    type: string;
    runId?: string;
    sessionKey?: string;
    data: unknown;
    timestamp: number;
}

// =============================================================================
// Tool Types
// =============================================================================

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResult {
    callId: string;
    name: string;
    result: unknown;
    error?: string;
}

// =============================================================================
// Provider Types
// =============================================================================

export type ProviderId =
    | "anthropic"
    | "openai"
    | "google"
    | "groq"
    | "meta"
    | "openrouter"
    | "ollama";

export interface ProviderOptions {
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: ToolDefinition[];
}

export interface StreamChunk {
    type: "text" | "tool_call" | "thinking" | "error" | "done";
    text?: string;
    toolCall?: ToolCall;
    error?: string;
}
