import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { KernelSession, KernelTool, KernelToolContext } from '@echoai/runtime';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { McpRuntime, buildKernelToolName, isMcpKernelToolName, type McpServerConfig } from './mcp-runtime';

/**
 * A real MCP server implemented in ~60 lines of Node so the tests exercise the
 * actual newline-delimited JSON-RPC stdio path instead of a mocked transport.
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

const tools = [
  {
    name: 'echo',
    description: 'Echo text back',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  { name: 'boom', description: 'Always fails', inputSchema: { type: 'object', properties: {} } },
  { name: 'mixed', description: 'Returns mixed content', inputSchema: { type: 'object', properties: {} } },
  { name: 'envprobe', description: 'Reports visible env', inputSchema: { type: 'object', properties: {} } },
];

function handle(message) {
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'fake-mcp-server', version: '1.0.0' },
      },
    });
    return;
  }
  if (message.method === 'notifications/initialized') {
    process.stderr.write('handshake complete\\n');
    return;
  }
  if (message.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: message.id, result: { tools } });
    return;
  }
  if (message.method === 'tools/call') {
    const name = message.params && message.params.name;
    const args = (message.params && message.params.arguments) || {};
    if (name === 'echo') {
      send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'echo: ' + String(args.text) }] } });
      return;
    }
    if (name === 'boom') {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: { content: [{ type: 'text', text: 'tool exploded' }], isError: true },
      });
      return;
    }
    if (name === 'mixed') {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            { type: 'text', text: 'header' },
            { type: 'image', data: 'AAA', mimeType: 'image/png' },
            { type: 'audio', data: 'BBB', mimeType: 'audio/wav' },
            { type: 'resource', resource: { uri: 'file:///tmp/example.txt' } },
          ],
        },
      });
      return;
    }
    if (name === 'envprobe') {
      const payload = {
        leakedSecret: process.env.ECHOAI_TEST_LEAKED_SECRET || null,
        configuredToken: process.env.FAKE_SERVER_TOKEN || null,
        hasPath: typeof process.env.PATH === 'string',
      };
      send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] } });
      return;
    }
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: 'Unknown tool: ' + String(name) } });
    return;
  }
  if (typeof message.id === 'number') {
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } });
  }
}
`;

const CRASHING_SERVER_SOURCE = `
process.stderr.write('fatal: missing MCP_API_KEY=super-secret-value\\n');
process.exit(1);
`;

let tempDir: string;
let fakeServerPath: string;
let crashingServerPath: string;
const runtimes: McpRuntime[] = [];

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'echoai-mcp-'));
  fakeServerPath = join(tempDir, 'fake-mcp-server.cjs');
  crashingServerPath = join(tempDir, 'crashing-mcp-server.cjs');
  await writeFile(fakeServerPath, FAKE_SERVER_SOURCE, 'utf8');
  await writeFile(crashingServerPath, CRASHING_SERVER_SOURCE, 'utf8');
});

afterEach(async () => {
  while (runtimes.length > 0) {
    const runtime = runtimes.pop();
    await runtime?.stop();
  }
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function createRuntime(): McpRuntime {
  const runtime = new McpRuntime();
  runtimes.push(runtime);
  return runtime;
}

function fakeServer(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: 'server-1',
    name: 'Fake MCP',
    command: process.execPath,
    args: [fakeServerPath],
    enabled: true,
    ...overrides,
  };
}

// The MCP bridge only reads `abortSignal` from the context, so a stub session is enough.
function toolContext(abortSignal?: AbortSignal): KernelToolContext {
  return { session: {} as KernelSession, abortSignal };
}

function findTool(tools: KernelTool[], suffix: string): KernelTool {
  const tool = tools.find((entry) => entry.name.endsWith(`__${suffix}`));
  if (!tool) {
    throw new Error(`tool ${suffix} was not discovered`);
  }
  return tool;
}

describe('mcp runtime handshake and discovery', () => {
  it('spawns a server, handshakes, and discovers namespaced tools', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer()]);

    const status = runtime.listRuntimeStatus();
    expect(status).toHaveLength(1);
    expect(status[0].status).toBe('ready');
    expect(status[0].toolCount).toBe(4);
    expect(status[0].failureReason).toBeNull();
    expect(status[0].transport).toBe('stdio');
    expect(Date.parse(status[0].lastHealthCheckAt)).not.toBeNaN();

    const discovered = runtime.listTools();
    expect(discovered.map((tool) => tool.toolName).sort()).toEqual(['boom', 'echo', 'envprobe', 'mixed']);
    expect(discovered.map((tool) => tool.kernelToolName)).toContain('mcp__server-1__echo');

    const echo = findTool(runtime.listKernelTools(), 'echo');
    expect(isMcpKernelToolName(echo.name)).toBe(true);
    expect(echo.description).toBe('Echo text back');
    expect(echo.inputSchema).toMatchObject({ type: 'object', required: ['text'] });
    // Third-party code must not be auto-approved.
    expect(echo.permission).toEqual({ network: 'ask', process: 'ask', write: 'ask' });
  }, 20_000);

  it('reports disabled servers without spawning them', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer({ enabled: false })]);

    expect(runtime.listRuntimeStatus()[0].status).toBe('disabled');
    expect(runtime.listTools()).toHaveLength(0);
    expect(await runtime.ensureServer(fakeServer({ enabled: false }))).toBe(false);
  }, 20_000);
});

describe('mcp runtime tool calls', () => {
  it('executes a tool and maps text content to output', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer()]);

    const echo = findTool(runtime.listKernelTools(), 'echo');
    const result = await echo.execute({ text: 'hello' }, toolContext());

    expect(result.success).toBe(true);
    expect(result.output).toBe('echo: hello');
    expect(result.error).toBeUndefined();
  }, 20_000);

  it('maps isError results to a failed tool result', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer()]);

    const boom = findTool(runtime.listKernelTools(), 'boom');
    const result = await boom.execute({}, toolContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('tool exploded');
  }, 20_000);

  it('summarizes non-text content blocks', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer()]);

    const mixed = findTool(runtime.listKernelTools(), 'mixed');
    const result = await mixed.execute({}, toolContext());

    expect(result.success).toBe(true);
    expect(result.output).toBe('header\n<image content>\n<audio content>\n<resource content>');
  }, 20_000);

  it('rejects a call whose abort signal is already aborted', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer()]);

    const echo = findTool(runtime.listKernelTools(), 'echo');
    const result = await echo.execute({ text: 'hello' }, toolContext(AbortSignal.abort()));

    expect(result.success).toBe(false);
    expect(result.error).toContain('aborted');
  }, 20_000);
});

describe('mcp runtime failure handling', () => {
  it('marks a server that exits immediately as failed with a redacted reason', async () => {
    const runtime = createRuntime();
    await runtime.sync([
      fakeServer({ id: 'crasher', name: 'Crashing MCP', args: [crashingServerPath] }),
    ]);

    const status = runtime.listRuntimeStatus();
    expect(status[0].status).toBe('failed');
    expect(status[0].toolCount).toBe(0);
    expect(status[0].failureReason).toContain('exited');
    expect(runtime.listKernelTools()).toHaveLength(0);

    // stderr is kept for diagnostics but secrets are masked.
    const diagnostics = runtime.readServerDiagnostics('crasher').join('\n');
    expect(diagnostics).toContain('fatal');
    expect(diagnostics).not.toContain('super-secret-value');
    expect(status[0].failureReason).not.toContain('super-secret-value');
  }, 20_000);

  it('marks a missing command as failed instead of throwing', async () => {
    const runtime = createRuntime();
    await runtime.sync([
      fakeServer({ id: 'missing', command: join(tempDir, 'definitely-not-a-real-binary'), args: [] }),
    ]);

    expect(runtime.listRuntimeStatus()[0].status).toBe('failed');
    expect(runtime.listRuntimeStatus()[0].failureReason).toBeTruthy();
  }, 20_000);
});

describe('mcp runtime lifecycle', () => {
  it('stops removed servers and notifies listeners on change', async () => {
    const runtime = createRuntime();
    let notifications = 0;
    const unsubscribe = runtime.onToolsChanged(() => {
      notifications += 1;
    });

    await runtime.sync([fakeServer()]);
    expect(runtime.listTools()).toHaveLength(4);

    await runtime.sync([]);
    expect(runtime.listTools()).toHaveLength(0);
    expect(runtime.listRuntimeStatus()).toHaveLength(0);
    expect(notifications).toBeGreaterThanOrEqual(2);

    unsubscribe();
  }, 20_000);

  it('reports tool failure once the server is stopped', async () => {
    const runtime = createRuntime();
    await runtime.sync([fakeServer()]);
    const echo = findTool(runtime.listKernelTools(), 'echo');

    await runtime.stop();
    const result = await echo.execute({ text: 'hello' }, toolContext());

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  }, 20_000);
});

describe('mcp runtime environment isolation', () => {
  it('passes only allowlisted plus per-server env to the child', async () => {
    process.env.ECHOAI_TEST_LEAKED_SECRET = 'must-not-be-visible';
    const runtime = createRuntime();
    await runtime.sync([fakeServer({ env: { FAKE_SERVER_TOKEN: 'configured-value' } })]);

    const probe = findTool(runtime.listKernelTools(), 'envprobe');
    const result = await probe.execute({}, toolContext());
    delete process.env.ECHOAI_TEST_LEAKED_SECRET;

    expect(result.success).toBe(true);
    const payload: unknown = JSON.parse(result.output ?? '{}');
    expect(payload).toEqual({ leakedSecret: null, configuredToken: 'configured-value', hasPath: true });
  }, 20_000);
});

describe('kernel tool naming', () => {
  it('keeps the double-underscore namespace separator the renderer relies on', () => {
    expect(buildKernelToolName('abc-123', 'read_file')).toBe('mcp__abc-123__read_file');
    expect(buildKernelToolName('with space', 'weird/name')).toBe('mcp__with_space__weird_name');
    expect(isMcpKernelToolName('mcp__abc__read_file')).toBe(true);
    expect(isMcpKernelToolName('read_file')).toBe(false);
  });
});
