/**
 * Gateway Protocol Types
 *
 * JSON-RPC 2.0 based protocol for Gateway communication.
 */

// =============================================================================
// JSON-RPC 2.0 Base Types
// =============================================================================

export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

export interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: Record<string, unknown>;
}

// =============================================================================
// Error Codes
// =============================================================================

export const ErrorCodes = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    // Custom codes
    UNAUTHORIZED: -32000,
    SESSION_NOT_FOUND: -32001,
    AGENT_ERROR: -32002,
    CHANNEL_ERROR: -32003,
    TIMEOUT: -32004,
} as const;

// =============================================================================
// Gateway Methods
// =============================================================================

export const GatewayMethods = {
    // Chat methods
    CHAT_SEND: "chat.send",
    CHAT_ABORT: "chat.abort",
    CHAT_HISTORY: "chat.history",

    // Session methods
    SESSION_LIST: "session.list",
    SESSION_GET: "session.get",
    SESSION_DELETE: "session.delete",
    SESSION_CLEAR: "session.clear",

    // Agent methods
    AGENT_LIST: "agent.list",
    AGENT_RUN: "agent.run",
    AGENT_WAIT: "agent.wait",
    AGENT_STATUS: "agent.status",

    // Channel methods
    CHANNEL_LIST: "channel.list",
    CHANNEL_START: "channel.start",
    CHANNEL_STOP: "channel.stop",
    CHANNEL_STATUS: "channel.status",

    // Node methods
    NODE_LIST: "node.list",
    NODE_INVOKE: "node.invoke",
    NODE_SUBSCRIBE: "node.subscribe",

    // Config methods
    CONFIG_GET: "config.get",
    CONFIG_SET: "config.set",
    CONFIG_RELOAD: "config.reload",

    // Health methods
    HEALTH_CHECK: "health.check",
    HEALTH_VERSION: "health.version",
} as const;

// =============================================================================
// Gateway Events
// =============================================================================

export const GatewayEvents = {
    // Agent events
    AGENT_START: "agent.start",
    AGENT_DELTA: "agent.delta",
    AGENT_TOOL_CALL: "agent.tool.call",
    AGENT_TOOL_RESULT: "agent.tool.result",
    AGENT_THINKING: "agent.thinking",
    AGENT_END: "agent.end",
    AGENT_ERROR: "agent.error",

    // Channel events
    CHANNEL_MESSAGE: "channel.message",
    CHANNEL_STATUS: "channel.status",

    // Node events
    NODE_CONNECTED: "node.connected",
    NODE_DISCONNECTED: "node.disconnected",
    NODE_EVENT: "node.event",

    // System events
    CONFIG_CHANGED: "config.changed",
    HEARTBEAT: "heartbeat",
} as const;

// =============================================================================
// Request/Response Types
// =============================================================================

export interface ChatSendParams {
    sessionKey: string;
    message: string;
    attachments?: Array<{
        type: "image" | "audio" | "video" | "file";
        data: string;
        mimeType: string;
    }>;
    agentId?: string;
}

export interface ChatSendResult {
    runId: string;
    sessionKey: string;
}

export interface SessionListResult {
    sessions: Array<{
        key: string;
        agentId: string;
        messageCount: number;
        lastActiveAt: number;
    }>;
}

export interface AgentDeltaEvent {
    runId: string;
    sessionKey: string;
    text: string;
    isComplete: boolean;
}

export interface AgentToolCallEvent {
    runId: string;
    sessionKey: string;
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function createRequest(
    method: string,
    params?: Record<string, unknown>,
    id?: string | number
): JsonRpcRequest {
    return {
        jsonrpc: "2.0",
        id: id ?? crypto.randomUUID(),
        method,
        params,
    };
}

export function createResponse(
    id: string | number,
    result: unknown
): JsonRpcResponse {
    return {
        jsonrpc: "2.0",
        id,
        result,
    };
}

export function createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: unknown
): JsonRpcResponse {
    return {
        jsonrpc: "2.0",
        id,
        error: { code, message, data },
    };
}

export function createNotification(
    method: string,
    params?: Record<string, unknown>
): JsonRpcNotification {
    return {
        jsonrpc: "2.0",
        method,
        params,
    };
}

export function isRequest(msg: unknown): msg is JsonRpcRequest {
    return (
        typeof msg === "object" &&
        msg !== null &&
        "jsonrpc" in msg &&
        msg.jsonrpc === "2.0" &&
        "method" in msg &&
        "id" in msg
    );
}

export function isNotification(msg: unknown): msg is JsonRpcNotification {
    return (
        typeof msg === "object" &&
        msg !== null &&
        "jsonrpc" in msg &&
        msg.jsonrpc === "2.0" &&
        "method" in msg &&
        !("id" in msg)
    );
}
