import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { McpRuntime } from './mcp-runtime';
import { DesktopToolingService } from './tooling-service';

let tempDir: string | null = null;
let scriptDir: string;
let fakeServerPath: string;
const runtimes: McpRuntime[] = [];

/**
 * Same approach as `mcp-runtime.test.ts`: a real child process speaking MCP over
 * stdio, so the tooling service is verified against the actual protocol.
 */
const FAKE_SERVER_SOURCE = `
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf('\\n');
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line.length > 0) {
      handle(JSON.parse(line));
    }
    index = buffer.indexOf('\\n');
  }
});

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function handle(message) {
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1.0.0' } },
    });
    return;
  }
  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          { name: 'search', description: 'Search the index', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
        ],
      },
    });
    return;
  }
  if (message.method === 'tools/call') {
    send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'ok' }] } });
  }
}
`;

beforeAll(async () => {
  scriptDir = await mkdtemp(join(tmpdir(), 'echoai-tooling-mcp-'));
  fakeServerPath = join(scriptDir, 'fake-mcp-server.cjs');
  await writeFile(fakeServerPath, FAKE_SERVER_SOURCE, 'utf8');
});

afterEach(async () => {
  while (runtimes.length > 0) {
    await runtimes.pop()?.stop();
  }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

async function createService(): Promise<DesktopToolingService> {
  tempDir = await mkdtemp(join(tmpdir(), 'echoai-tooling-'));
  const runtime = new McpRuntime();
  runtimes.push(runtime);
  return new DesktopToolingService(tempDir, join(tempDir, 'skills'), join(tempDir, 'cache'), runtime);
}

describe('desktop tooling service', () => {
  it('summarizes large tool output', async () => {
    const service = await createService();

    const summary = service.summarizeToolOutput(Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n'));

    expect(summary.lineCount).toBe(40);
    expect(summary.truncated).toBe(true);
    expect(summary.preview).toContain('line 0');
  });
});

describe('desktop tooling service mcp wiring', () => {
  it('lists tools discovered from a real MCP server', async () => {
    const service = await createService();
    const server = await service.addMcpServer({
      name: 'Fake MCP',
      command: process.execPath,
      args: [fakeServerPath],
      enabled: true,
    });

    const tools = await service.listMcpTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].serverId).toBe(server.id);
    expect(tools[0].name).toBe(`mcp__${server.id}__search`);
    expect(tools[0].description).toBe('Search the index');
    expect(tools[0].schema).toMatchObject({ type: 'object' });
  }, 20_000);

  it('reports a live handshake from testMcpServer', async () => {
    const service = await createService();
    const server = await service.addMcpServer({
      name: 'Fake MCP',
      command: process.execPath,
      args: [fakeServerPath],
      enabled: true,
    });

    expect(await service.testMcpServer(server.id)).toBe(true);
    expect(await service.testMcpServer('unknown-server')).toBe(false);
  }, 20_000);

  it('fails testMcpServer when the command cannot start', async () => {
    const service = await createService();
    const server = await service.addMcpServer({
      name: 'Broken MCP',
      command: join(scriptDir, 'definitely-not-a-real-binary'),
      args: [],
      enabled: true,
    });

    expect(await service.testMcpServer(server.id)).toBe(false);
    const status = await service.listMcpRuntimeStatus();
    expect(status[0].status).toBe('failed');
    expect(status[0].failureReason).toBeTruthy();
  }, 20_000);

  it('skips disabled servers and drops tools when a server is removed', async () => {
    const service = await createService();
    const disabled = await service.addMcpServer({
      name: 'Disabled MCP',
      command: process.execPath,
      args: [fakeServerPath],
      enabled: false,
    });

    expect(await service.testMcpServer(disabled.id)).toBe(false);
    expect(await service.listMcpTools()).toHaveLength(0);

    const enabled = await service.addMcpServer({
      name: 'Fake MCP',
      command: process.execPath,
      args: [fakeServerPath],
      enabled: true,
    });
    expect(await service.listMcpTools()).toHaveLength(1);

    expect(await service.removeMcpServer(enabled.id)).toBe(true);
    expect(await service.listMcpTools()).toHaveLength(0);
  }, 20_000);

  it('keeps persistence behaviour for server records', async () => {
    const service = await createService();
    const server = await service.addMcpServer({
      name: 'Fake MCP',
      command: process.execPath,
      args: [fakeServerPath],
      enabled: true,
    });

    const servers = await service.listMcpServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({ id: server.id, name: 'Fake MCP', enabled: true });
    expect(Date.parse(servers[0].createdAt)).not.toBeNaN();
    expect(await service.removeMcpServer('missing-id')).toBe(false);
  }, 20_000);
});
