import { Command } from 'commander';
import { MCPManager } from '../mcp/manager.js';
import { MCPServer } from '../types/mcp.js';

const mcpManager = new MCPManager();

export const mcpCommand = new Command()
  .name('mcp')
  .description('Manage Model Context Protocol (MCP) servers and tools')
  .hook('preAction', async () => {
    await mcpManager.initialize();
  });

mcpCommand
  .command('list')
  .description('List configured MCP servers')
  .action(async () => {
    const servers = mcpManager.listServers();
    if (servers.length === 0) {
      console.log('No MCP servers configured');
      return;
    }

    console.log('\nConfigured MCP servers:');
    servers.forEach(server => {
      const status = server.connected ? '✅' : '❌';
      console.log(`  ${status} ${server.id} (${server.name}) - ${server.transport}`);
    });
  });

mcpCommand
  .command('tools')
  .description('List available tools from all MCP servers')
  .action(async () => {
    const tools = mcpManager.getAvailableTools();
    if (tools.length === 0) {
      console.log('No tools available from MCP servers');
      return;
    }

    console.log(`\nAvailable MCP tools (${tools.length}):`);
    tools.forEach(tool => {
      console.log(`  📋 ${tool.name} - ${tool.description}`);
    });
  });

mcpCommand
  .command('add')
  .description('Add a new MCP server')
  .requiredOption('-i, --id <id>', 'Server ID')
  .requiredOption('-n, --name <name>', 'Server name')
  .requiredOption('-t, --transport <transport>', 'Transport type (stdio|http|sse)')
  .option('-c, --command <command>', 'Command for stdio transport')
  .option('-a, --args <args>', 'Command arguments (comma-separated)')
  .option('-u, --url <url>', 'URL for http/sse transport')
  .action(async (options) => {
    const server: Omit<MCPServer, 'tools' | 'connected' | 'lastError'> = {
      id: options.id,
      name: options.name,
      transport: options.transport,
    };

    if (options.transport === 'stdio') {
      if (!options.command) {
        console.error('Command is required for stdio transport');
        process.exit(1);
      }
      server.command = options.command;
      server.args = options.args ? options.args.split(',').map((arg: string) => arg.trim()) : [];
    } else if (options.transport === 'http' || options.transport === 'sse') {
      if (!options.url) {
        console.error('URL is required for http/sse transport');
        process.exit(1);
      }
      server.url = options.url;
    }

    try {
      await mcpManager.addServer(server);
      console.log(`✅ MCP server ${server.id} added successfully`);
    } catch (error) {
      console.error(`❌ Failed to add MCP server:`, error);
      process.exit(1);
    }
  });

mcpCommand
  .command('remove')
  .description('Remove an MCP server')
  .argument('<id>', 'Server ID to remove')
  .action(async (id) => {
    try {
      await mcpManager.removeServer(id);
      console.log(`✅ MCP server ${id} removed`);
    } catch (error) {
      console.error(`❌ Failed to remove MCP server:`, error);
      process.exit(1);
    }
  });

mcpCommand
  .command('call')
  .description('Call an MCP tool')
  .argument('<tool>', 'Tool name to call')
  .argument('[args...]', 'Tool arguments as key=value pairs')
  .action(async (tool, argPairs) => {
    const args: Record<string, any> = {};
    
    for (const pair of argPairs) {
      const [key, ...valueParts] = pair.split('=');
      if (!key || valueParts.length === 0) {
        console.error(`Invalid argument format: ${pair}. Use key=value`);
        process.exit(1);
      }
      
      const value = valueParts.join('=');
      try {
        args[key] = JSON.parse(value);
      } catch {
        args[key] = value;
      }
    }

    try {
      const result = await mcpManager.callTool(tool, args);
      console.log('Tool result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`❌ Failed to call tool ${tool}:`, error);
      process.exit(1);
    }
  });

process.on('SIGINT', async () => {
  await mcpManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mcpManager.shutdown();
  process.exit(0);
});