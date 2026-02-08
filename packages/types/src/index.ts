/**
 * EchoAI Types - Shared TypeScript Definitions
 */

// =============================================================================
// Core Types
// =============================================================================

export type ChannelType = "discord" | "telegram" | "slack" | "whatsapp" | "signal" | "imessage" | "line" | "web";
export type ProviderType = "anthropic" | "openai" | "google" | "ollama" | "bedrock" | "azure" | "groq" | "together" | "mistral" | "openrouter";
export type MessageRole = "system" | "user" | "assistant" | "tool";
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

// =============================================================================
// Message Types
// =============================================================================

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    channelId?: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
}

export interface IncomingMessage extends Message {
    channel: ChannelType;
    isGroup?: boolean;
    replyTo?: string;
    attachments?: Attachment[];
}

export interface OutgoingMessage {
    channel: ChannelType;
    recipientId: string;
    content: string;
    replyTo?: string;
    attachments?: Attachment[];
    metadata?: Record<string, unknown>;
}

export interface Attachment {
    id: string;
    type: "image" | "audio" | "video" | "file";
    url?: string;
    path?: string;
    mimeType: string;
    size?: number;
    name?: string;
}

// =============================================================================
// Channel Types
// =============================================================================

export interface Channel {
    type: ChannelType;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<{ messageId: string }>;
    isConnected(): boolean;
}

export interface ChannelConfig {
    type: ChannelType;
    enabled: boolean;
    credentials?: Record<string, string>;
    options?: Record<string, unknown>;
}

// =============================================================================
// Agent Types
// =============================================================================

export interface Tool {
    name: string;
    description: string;
    inputSchema: ToolSchema;
    execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}

export interface ToolSchema {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
}

export interface PropertySchema {
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    enum?: string[];
    items?: PropertySchema;
    default?: unknown;
}

export interface ToolContext {
    agentId: string;
    sessionId: string;
    workspaceRoot?: string;
    abortSignal?: AbortSignal;
}

export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    data?: unknown;
}

export interface ToolCall {
    id: string;
    name: string;
    input: unknown;
}

// =============================================================================
// Provider Types
// =============================================================================

export interface CompletionRequest {
    messages: Message[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: Tool[];
    stream?: boolean;
    systemPrompt?: string;
}

export interface CompletionResponse {
    id: string;
    content: string;
    toolCalls?: ToolCall[];
    usage?: TokenUsage;
    stopReason?: string;
    model?: string;
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

// =============================================================================
// Session Types
// =============================================================================

export interface Session {
    id: string;
    userId: string;
    channelId: string;
    messages: Message[];
    context: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
    expiresAt?: number;
}

// =============================================================================
// Config Types
// =============================================================================

export interface EchoAIConfig {
    provider: ProviderType;
    apiKey?: string;
    model?: string;
    channels: ChannelConfig[];
    debug?: boolean;
    stateDir?: string;
}

// =============================================================================
// Event Types
// =============================================================================

export type EventType =
    | "message:incoming"
    | "message:outgoing"
    | "session:start"
    | "session:end"
    | "tool:start"
    | "tool:end"
    | "channel:connect"
    | "channel:disconnect"
    | "error";

export interface Event<T = unknown> {
    type: EventType;
    timestamp: number;
    data: T;
}

// =============================================================================
// Utility Types
// =============================================================================

export type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };
export type Awaitable<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];
