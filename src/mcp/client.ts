import { spawn, ChildProcess } from 'child_process';
import { EventSource } from 'eventsource';
import { MCPServer, MCPTool, MCPMessage, MCPInitializeParams, MCPCapabilities } from '../types/mcp.js';

export class MCPClient {
  private servers: Map<string, MCPServerConnection> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  async addServer(server: MCPServer): Promise<void> {
    try {
      const connection = new MCPServerConnection(server);
      await connection.connect();
      this.servers.set(server.id, connection);
      
      // Register tools from this server
      for (const tool of connection.getTools()) {
        this.tools.set(tool.name, tool);
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${server.id}:`, error);
      throw error;
    }
  }

  async removeServer(serverId: string): Promise<void> {
    const connection = this.servers.get(serverId);
    if (connection) {
      await connection.disconnect();
      this.servers.delete(serverId);
      
      // Remove tools from this server
      const serverTools = connection.getTools();
      for (const tool of serverTools) {
        this.tools.delete(tool.name);
      }
    }
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return await tool.handler(args);
  }

  async disconnect(): Promise<void> {
    await Promise.all(
      Array.from(this.servers.values()).map(connection => connection.disconnect())
    );
    this.servers.clear();
    this.tools.clear();
  }
}

class MCPServerConnection {
  private server: MCPServer;
  private process?: ChildProcess;
  private eventSource?: EventSource;
  private messageId = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>();
  private tools: MCPTool[] = [];

  constructor(server: MCPServer) {
    this.server = server;
  }

  async connect(): Promise<void> {
    switch (this.server.transport) {
      case 'stdio':
        await this.connectStdio();
        break;
      case 'http':
      case 'sse':
        await this.connectHttp();
        break;
      default:
        throw new Error(`Unsupported transport: ${this.server.transport}`);
    }

    await this.initialize();
    await this.listTools();
  }

  private async connectStdio(): Promise<void> {
    if (!this.server.command) {
      throw new Error('Command required for stdio transport');
    }

    this.process = spawn(this.server.command, this.server.args || [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.on('error', (error) => {
      console.error(`MCP server ${this.server.id} error:`, error);
    });

    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        try {
          const message: MCPMessage = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse MCP message:', error);
        }
      }
    });
  }

  private async connectHttp(): Promise<void> {
    if (!this.server.url) {
      throw new Error('URL required for HTTP/SSE transport');
    }

    if (this.server.transport === 'sse') {
      this.eventSource = new EventSource(this.server.url);
      this.eventSource.onmessage = (event: any) => {
        try {
          const message: MCPMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
    }
  }

  private async initialize(): Promise<void> {
    const capabilities: MCPCapabilities = {
      tools: { listChanged: true },
    };

    const params: MCPInitializeParams = {
      protocolVersion: '2024-11-05',
      capabilities,
      clientInfo: {
        name: 'echo-ai',
        version: '2.2.1',
      },
    };

    await this.sendRequest('initialize', params);
  }

  private async listTools(): Promise<void> {
    try {
      const response = await this.sendRequest('tools/list', {});
      if (response.tools) {
        this.tools = response.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          handler: async (args: Record<string, any>) => {
            return await this.sendRequest('tools/call', {
              name: tool.name,
              arguments: args,
            });
          },
        }));
      }
    } catch (error) {
      console.error(`Failed to list tools from ${this.server.id}:`, error);
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = (++this.messageId).toString();
      const message: MCPMessage = { id, method, params };

      this.pendingRequests.set(id, { resolve, reject });

      if (this.server.transport === 'stdio' && this.process?.stdin) {
        this.process.stdin.write(JSON.stringify(message) + '\n');
      } else if (this.server.transport === 'http' && this.server.url) {
        fetch(this.server.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })
          .then(response => response.json())
          .then(data => this.handleMessage(data))
          .catch(reject);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          pending.reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private handleMessage(message: MCPMessage): void {
    if (message.id) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    this.pendingRequests.clear();
  }
}