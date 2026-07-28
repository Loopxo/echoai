import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MCPClient } from "../../src/mcp/client.js";
import type { MCPServer } from "../../src/types/mcp.js";

/**
 * A minimal, spec-strict MCP server used as a conformance fixture.
 *
 * It behaves the way a server built on the official MCP SDK behaves: it
 * rejects any frame missing `jsonrpc: "2.0"`, refuses requests received before
 * `notifications/initialized`, and records everything it received so the test
 * can assert on the exact handshake sequence.
 */
const STRICT_SERVER = String.raw`
const fs = require('node:fs');
const logPath = process.env.MCP_FIXTURE_LOG;
const received = [];

function log() {
  fs.writeFileSync(logPath, JSON.stringify(received, null, 2));
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

let initialized = false;
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let index = buffer.indexOf('\n');
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) handle(line);
    index = buffer.indexOf('\n');
  }
});

function handle(line) {
  let frame;
  try {
    frame = JSON.parse(line);
  } catch {
    received.push({ error: 'parse', line });
    log();
    return;
  }

  received.push(frame);
  log();

  // Strict SDK behaviour: no jsonrpc field means the frame is invalid.
  if (frame.jsonrpc !== '2.0') {
    fail(frame.id ?? null, -32600, 'Invalid Request: missing jsonrpc "2.0"');
    return;
  }

  if (frame.method === 'notifications/initialized') {
    initialized = true;
    return;
  }

  if (frame.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: frame.id,
      result: {
        protocolVersion: frame.params && frame.params.protocolVersion,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'fixture', version: '1.0.0' },
      },
    });
    return;
  }

  if (!initialized) {
    fail(frame.id, -32002, 'Server not initialized');
    return;
  }

  if (frame.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: frame.id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Echo the input back',
            inputSchema: {
              type: 'object',
              properties: { text: { type: 'string' } },
              required: ['text'],
            },
          },
        ],
      },
    });
    return;
  }

  if (frame.method === 'tools/call') {
    send({
      jsonrpc: '2.0',
      id: frame.id,
      result: {
        content: [{ type: 'text', text: 'echo: ' + frame.params.arguments.text }],
        isError: false,
      },
    });
    return;
  }

  fail(frame.id, -32601, 'Method not found: ' + frame.method);
}
`;

let client: MCPClient | undefined;

afterEach(async () => {
  await client?.disconnect();
  client = undefined;
});

describe("MCP protocol compliance", () => {
  function createFixture(): { server: MCPServer; logPath: string } {
    const dir = mkdtempSync(path.join(os.tmpdir(), "echoai-mcp-"));
    const serverPath = path.join(dir, "server.cjs");
    const logPath = path.join(dir, "received.json");
    writeFileSync(serverPath, STRICT_SERVER, "utf8");
    process.env.MCP_FIXTURE_LOG = logPath;

    return {
      logPath,
      server: {
        id: "fixture",
        name: "Fixture",
        command: process.execPath,
        args: [serverPath],
        transport: "stdio",
        tools: [],
        connected: false,
      },
    };
  }

  it("completes the handshake against a server that rejects non-JSON-RPC-2.0 frames", async () => {
    const { server, logPath } = createFixture();
    client = new MCPClient({ startupTimeoutMs: 15_000, requestTimeoutMs: 15_000 });

    await client.addServer(server);

    expect(client.isServerConnected("fixture")).toBe(true);
    expect(existsSync(logPath)).toBe(true);

    const received = JSON.parse(readFileSync(logPath, "utf8")) as Array<Record<string, unknown>>;

    // Every frame we send must carry the JSON-RPC version. This is the bug that
    // made EchoAI's MCP client unusable against any SDK-based server.
    for (const frame of received) {
      expect(frame.jsonrpc, `frame ${JSON.stringify(frame)} must declare jsonrpc`).toBe("2.0");
    }

    const methods = received.map((frame) => frame.method);
    expect(methods[0]).toBe("initialize");
    // The initialized notification is mandatory and must precede tools/list,
    // otherwise a compliant server refuses every subsequent request.
    expect(methods).toContain("notifications/initialized");
    expect(methods.indexOf("notifications/initialized")).toBeLessThan(
      methods.indexOf("tools/list")
    );

    const initializeFrame = received.find((frame) => frame.method === "initialize");
    expect((initializeFrame?.params as Record<string, unknown>)?.protocolVersion).toBeTruthy();

    // Notifications must not carry an id.
    const notification = received.find((frame) => frame.method === "notifications/initialized");
    expect(notification && "id" in notification).toBe(false);
  });

  it("namespaces discovered tools by server id and round-trips a call", async () => {
    const { server } = createFixture();
    client = new MCPClient({ startupTimeoutMs: 15_000, requestTimeoutMs: 15_000 });

    await client.addServer(server);

    const tools = client.getAvailableTools();
    expect(tools.map((tool) => tool.name)).toEqual(["fixture__echo"]);

    const result = await client.callTool("fixture__echo", { text: "hello" });
    expect(result).toMatchObject({
      isError: false,
      content: [{ type: "text", text: "echo: hello" }],
    });
  });

  it("removes a server's tools when it is removed", async () => {
    const { server } = createFixture();
    client = new MCPClient({ startupTimeoutMs: 15_000, requestTimeoutMs: 15_000 });

    await client.addServer(server);
    expect(client.getAvailableTools()).toHaveLength(1);

    await client.removeServer("fixture");
    expect(client.getAvailableTools()).toHaveLength(0);
    expect(client.isServerConnected("fixture")).toBe(false);
  });
});
