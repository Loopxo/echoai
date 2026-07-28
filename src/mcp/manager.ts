import { MCPClient } from './client.js';
import { MCPServer, MCPConfig, MCPTool } from '../types/mcp.js';
import { chmod, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveStateDir } from '@echoai/core';

export class MCPManager {
  private client: MCPClient;
  private config: MCPConfig = { servers: {} };
  private configPath: string;

  constructor() {
    this.client = new MCPClient();
    this.configPath = join(resolveStateDir(), 'mcp.json');
  }

  async initialize(additionalServers: MCPServer[] = [], signal?: AbortSignal): Promise<void> {
    await this.loadConfig();
    await this.startConfiguredServers(additionalServers, signal);
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

  async callTool(name: string, args: Record<string, any>, signal?: AbortSignal): Promise<any> {
    return await this.client.callTool(name, args, signal);
  }

  listServers(): { id: string; name: string; transport: string; connected: boolean }[] {
    return Object.entries(this.config.servers).map(([id, server]) => ({
      id,
      name: server.name,
      transport: server.transport,
      connected: this.client.isServerConnected(id),
    }));
  }

  private async loadConfig(): Promise<void> {
    try {
      await chmod(this.configPath, 0o600);
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
      const stateDir = resolveStateDir();
      await mkdir(stateDir, { recursive: true, mode: 0o700 });
      await chmod(stateDir, 0o700);
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      await chmod(this.configPath, 0o600);
    } catch (error) {
      console.error('Failed to save MCP config:', error);
    }
  }

  private async startConfiguredServers(
    additionalServers: MCPServer[] = [],
    signal?: AbortSignal
  ): Promise<void> {
    const servers: MCPServer[] = [
      ...Object.entries(this.config.servers).map(([id, server]) => ({
        ...server,
        id,
        tools: [],
        connected: false,
      })),
      ...additionalServers,
    ];
    for (const server of servers) {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('MCP initialization cancelled');
      }
      try {
        await this.client.addServer(server, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        console.error(`Failed to start MCP server ${server.id}:`, error);
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.client.disconnect();
  }
}
