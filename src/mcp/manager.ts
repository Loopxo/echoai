import { MCPClient } from './client.js';
import { MCPServer, MCPConfig, MCPTool } from '../types/mcp.js';
import { readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export class MCPManager {
  private client: MCPClient;
  private config: MCPConfig = { servers: {} };
  private configPath: string;

  constructor() {
    this.client = new MCPClient();
    this.configPath = join(homedir(), '.echo', 'mcp.json');
  }

  async initialize(): Promise<void> {
    await this.loadConfig();
    await this.startConfiguredServers();
  }

  async addServer(server: Omit<MCPServer, 'tools' | 'connected' | 'lastError'>): Promise<void> {
    const fullServer: MCPServer = {
      ...server,
      tools: [],
      connected: false,
    };

    try {
      await this.client.addServer(fullServer);
      this.config.servers[server.id] = server;
      await this.saveConfig();
      console.log(`MCP server ${server.id} added successfully`);
    } catch (error) {
      console.error(`Failed to add MCP server ${server.id}:`, error);
      throw error;
    }
  }

  async removeServer(serverId: string): Promise<void> {
    await this.client.removeServer(serverId);
    delete this.config.servers[serverId];
    await this.saveConfig();
    console.log(`MCP server ${serverId} removed`);
  }

  getAvailableTools(): MCPTool[] {
    return this.client.getAvailableTools();
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    return await this.client.callTool(name, args);
  }

  listServers(): { id: string; name: string; transport: string; connected: boolean }[] {
    return Object.entries(this.config.servers).map(([id, server]) => ({
      id,
      name: server.name,
      transport: server.transport,
      connected: true, // TODO: Track actual connection status
    }));
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Config file doesn't exist or is invalid, use default
      this.config = { servers: {} };
      await this.saveConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save MCP config:', error);
    }
  }

  private async startConfiguredServers(): Promise<void> {
    const serverEntries = Object.entries(this.config.servers);
    if (serverEntries.length === 0) {
      await this.createDefaultConfig();
      return;
    }

    for (const [id, server] of serverEntries) {
      try {
        const fullServer: MCPServer = {
          ...server,
          tools: [],
          connected: false,
        };
        await this.client.addServer(fullServer);
      } catch (error) {
        console.error(`Failed to start MCP server ${id}:`, error);
      }
    }
  }

  private async createDefaultConfig(): Promise<void> {
    // Add some common MCP servers as examples
    const defaultServers = {
      filesystem: {
        id: 'filesystem',
        name: 'File System Tools',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        transport: 'stdio' as const,
      },
      brave_search: {
        id: 'brave_search',
        name: 'Brave Search',
        command: 'npx',
        args: ['@modelcontextprotocol/server-brave-search'],
        transport: 'stdio' as const,
      },
    };

    this.config.servers = defaultServers;
    await this.saveConfig();
  }

  async shutdown(): Promise<void> {
    await this.client.disconnect();
  }
}