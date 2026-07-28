export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: Record<string, any>, signal?: AbortSignal) => Promise<any>;
}

export interface MCPServer {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  transport: 'stdio' | 'http' | 'sse';
  tools: MCPTool[];
  connected: boolean;
  lastError?: string;
}

export interface MCPConfig {
  servers: {
    [id: string]: Omit<MCPServer, 'tools' | 'connected' | 'lastError'>;
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
  call_id: string;
}

export interface MCPToolResult {
  call_id: string;
  result?: any;
  error?: string;
}

/**
 * A JSON-RPC 2.0 envelope as used by the Model Context Protocol.
 *
 * The `jsonrpc` field is mandatory in both directions. Servers built on the
 * official MCP SDK validate it and reject any frame that omits it, so this is
 * not optional in practice even though earlier EchoAI builds left it out.
 *
 * `id` is absent on notifications, a string or number on requests and
 * responses. Notifications must never carry an `id`.
 */
export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/** Standard JSON-RPC 2.0 error codes plus the MCP-relevant subset. */
export const MCP_ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

export const MCP_PROTOCOL_VERSION = '2025-06-18';

/** Fallback versions offered when a server rejects the preferred one. */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}