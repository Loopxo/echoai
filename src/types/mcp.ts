export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: Record<string, any>) => Promise<any>;
}

export interface MCPServer {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  url?: string;
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

export interface MCPMessage {
  id: string;
  method: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

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