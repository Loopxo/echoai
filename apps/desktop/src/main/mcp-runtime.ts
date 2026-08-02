import { spawn, type ChildProcess } from 'node:child_process';
import type { KernelTool, KernelToolContext, KernelToolResult } from '@echoai/runtime';
import type { DesktopMcpRuntimeStatus } from '@shared/ipc';

/**
 * Minimal MCP stdio client.
 *
 * The monorepo does not depend on `@modelcontextprotocol/sdk`, and pulling a new
 * runtime dependency into the Electron main bundle for a protocol this small is
 * not worth the packaging risk. MCP stdio is newline-delimited JSON-RPC 2.0, so
 * it is implemented directly here against `node:child_process`.
 */
const MCP_PROTOCOL_VERSION = '2024-11-05';
const CLIENT_NAME = 'echoai-desktop';
const CLIENT_VERSION = '0.1.0';
const STARTUP_TIMEOUT_MS = 10_000;
const CALL_TIMEOUT_MS = 60_000;
const STOP_GRACE_MS = 2_000;
const STDERR_RING_LINES = 40;
const STDERR_LINE_LIMIT = 400;
const FAILURE_REASON_LIMIT = 400;
/** Servers may page tool listings; bound the walk so a broken server cannot loop forever. */
const MAX_TOOL_LIST_PAGES = 20;
/** A server that never emits a newline would otherwise grow the read buffer without bound. */
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export type McpServerStatus = DesktopMcpRuntimeStatus['status'] | 'starting' | 'stopped';

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  /**
   * Extra environment for this server only (for example an API token). Spawned
   * servers never inherit the full parent environment.
   */
  env?: Record<string, string>;
}

export interface McpDiscoveredTool {
  serverId: string;
  serverName: string;
  /** Raw tool name as advertised by the server. */
  toolName: string;
  /** Namespaced name exposed to the agent harness. */
  kernelToolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpRuntimeLogger {
  info(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
}

interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * MCP tools are third-party code with an opaque blast radius, so every scope
 * that can reach outside the process is gated instead of auto-approved.
 */
const MCP_TOOL_PERMISSION: KernelTool['permission'] = {
  network: 'ask',
  process: 'ask',
  write: 'ask',
};

class McpServerConnection {
  private child: ChildProcess | null = null;
  private state: McpServerStatus = 'stopped';
  private failureReason: string | null = null;
  private lastHealthCheckAt = new Date().toISOString();
  private tools: McpDiscoveredTool[] = [];
  private readonly pending = new Map<number, PendingRequest>();
  private readonly stderrRing: string[] = [];
  private stdoutBuffer = '';
  private nextRequestId = 1;
  private stopping = false;
  private startPromise: Promise<void> | null = null;

  constructor(
    public readonly config: McpServerConfig,
    private readonly logger?: McpRuntimeLogger
  ) {}

  getStatus(): McpServerStatus {
    return this.state;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getLastHealthCheckAt(): string {
    return this.lastHealthCheckAt;
  }

  listTools(): McpDiscoveredTool[] {
    return this.tools;
  }

  /** Recent stderr lines, kept for diagnostics only. */
  readStderr(): string[] {
    return [...this.stderrRing];
  }

  start(): Promise<void> {
    if (!this.startPromise) {
      this.startPromise = this.runStartup();
    }
    return this.startPromise;
  }

  async restart(): Promise<void> {
    await this.stop();
    this.startPromise = null;
    this.tools = [];
    this.failureReason = null;
    this.stopping = false;
    await this.start();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const child = this.child;
    this.rejectAllPending(new Error('MCP server stopped'));

    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.child = null;
      this.markStopped();
      return;
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, STOP_GRACE_MS);
      timer.unref();
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });

    this.child = null;
    this.markStopped();
  }

  async callTool(toolName: string, args: Record<string, unknown>, abortSignal?: AbortSignal): Promise<KernelToolResult> {
    if (this.state !== 'ready') {
      return { success: false, error: this.failureReason ?? `MCP server ${this.config.name} is not ready` };
    }

    try {
      const raw = await this.request(
        'tools/call',
        { name: toolName, arguments: args },
        CALL_TIMEOUT_MS,
        abortSignal
      );
      return toKernelToolResult(raw);
    } catch (error) {
      return { success: false, error: describeError(error) };
    }
  }

  private async runStartup(): Promise<void> {
    this.state = 'starting';
    this.touchHealthCheck();

    try {
      this.spawnChild();
      const initResult = await this.request(
        'initialize',
        {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
        },
        STARTUP_TIMEOUT_MS
      );
      assertHandshake(initResult);
      this.notify('notifications/initialized');
      this.tools = await this.discoverTools();
      this.state = 'ready';
      this.failureReason = null;
      this.touchHealthCheck();
      // Command only: args and env may carry credentials.
      this.logger?.info('mcp server ready', {
        serverId: this.config.id,
        name: this.config.name,
        toolCount: this.tools.length,
      });
    } catch (error) {
      this.markFailed(describeError(error));
      await this.stop();
    }
  }

  private spawnChild(): void {
    const child = spawn(this.config.command, this.config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: buildServerEnv(this.config.env),
    });
    this.child = child;

    // A server that dies mid-write makes the pipes emit EPIPE. Without listeners
    // those become uncaught exceptions in the Electron main process, so swallow
    // them here and let the exit handler report the real failure.
    child.stdin?.on('error', (error: Error) => {
      this.logger?.warn('mcp server stdin error', { serverId: this.config.id, message: error.message });
    });
    child.stdout?.on('error', () => undefined);
    child.stderr?.on('error', () => undefined);

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      this.consumeStdout(chunk);
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      this.captureStderr(chunk);
    });

    child.on('error', (error: Error) => {
      this.markFailed(`spawn failed: ${error.message}`);
      this.rejectAllPending(error);
    });

    child.on('exit', (code, signal) => {
      const detail = signal ? `signal ${signal}` : `code ${String(code)}`;
      if (!this.stopping) {
        this.markFailed(`server exited (${detail})${this.formatStderrTail()}`);
      }
      this.rejectAllPending(new Error(`MCP server exited (${detail})`));
    });
  }

  private async discoverTools(): Promise<McpDiscoveredTool[]> {
    const discovered: McpDiscoveredTool[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_TOOL_LIST_PAGES; page += 1) {
      const raw = await this.request(
        'tools/list',
        cursor ? { cursor } : {},
        STARTUP_TIMEOUT_MS
      );
      const record = asRecord(raw);
      const entries = Array.isArray(record?.tools) ? record.tools : [];
      for (const entry of entries) {
        const tool = this.toDiscoveredTool(entry);
        if (tool) {
          discovered.push(tool);
        }
      }

      const nextCursor = record?.nextCursor;
      if (typeof nextCursor !== 'string' || nextCursor.length === 0) {
        break;
      }
      cursor = nextCursor;
    }

    return discovered;
  }

  private toDiscoveredTool(value: unknown): McpDiscoveredTool | null {
    const record = asRecord(value);
    const toolName = record?.name;
    if (typeof toolName !== 'string' || toolName.length === 0) {
      return null;
    }

    return {
      serverId: this.config.id,
      serverName: this.config.name,
      toolName,
      kernelToolName: buildKernelToolName(this.config.id, toolName),
      description:
        typeof record?.description === 'string' && record.description.length > 0
          ? record.description
          : `${toolName} (MCP tool from ${this.config.name})`,
      inputSchema: asRecord(record?.inputSchema) ?? { type: 'object', properties: {} },
    };
  }

  private consumeStdout(chunk: string): void {
    if (this.stdoutBuffer.length + chunk.length > MAX_BUFFER_BYTES) {
      this.stdoutBuffer = '';
      this.markFailed('server flooded stdout without a message delimiter');
      void this.stop();
      return;
    }

    this.stdoutBuffer += chunk;
    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        this.handleLine(line);
      }
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Some servers print banners on stdout; ignore anything that is not JSON-RPC.
      this.logger?.warn('mcp server emitted non-json stdout', { serverId: this.config.id });
      return;
    }

    const message = asRecord(parsed);
    if (!message) {
      return;
    }

    const id = message.id;
    if (typeof id === 'number' && (('result' in message) || ('error' in message))) {
      this.settle(id, message);
      return;
    }

    // Server-initiated request. Answering keeps the server from blocking on
    // capabilities this client does not implement (sampling, roots, elicitation).
    if (typeof id === 'number' && typeof message.method === 'string') {
      this.send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not supported: ${message.method}` },
      });
    }
  }

  private settle(id: number, message: Record<string, unknown>): void {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    this.pending.delete(id);
    clearTimeout(pending.timer);

    const errorBody = asRecord(message.error);
    if (errorBody) {
      const body: JsonRpcErrorBody = {
        code: typeof errorBody.code === 'number' ? errorBody.code : -1,
        message: typeof errorBody.message === 'string' ? errorBody.message : 'unknown JSON-RPC error',
      };
      pending.reject(new Error(`${body.message} (code ${body.code})`));
      return;
    }

    pending.resolve(message.result);
  }

  private request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
    abortSignal?: AbortSignal
  ): Promise<unknown> {
    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<unknown>((resolve, reject) => {
      if (abortSignal?.aborted) {
        reject(new Error('Tool call aborted'));
        return;
      }

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref();

      const onAbort = (): void => {
        const pending = this.pending.get(id);
        if (!pending) {
          return;
        }
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new Error('Tool call aborted'));
      };
      abortSignal?.addEventListener('abort', onAbort, { once: true });

      this.pending.set(id, {
        resolve: (value) => {
          abortSignal?.removeEventListener('abort', onAbort);
          resolve(value);
        },
        reject: (error) => {
          abortSignal?.removeEventListener('abort', onAbort);
          reject(error);
        },
        timer,
      });

      try {
        this.send({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private notify(method: string, params: Record<string, unknown> = {}): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private send(message: Record<string, unknown>): void {
    const stdin = this.child?.stdin;
    if (!stdin || stdin.destroyed) {
      throw new Error(`MCP server ${this.config.name} stdin is not writable`);
    }
    stdin.write(`${JSON.stringify(message)}\n`);
  }

  private captureStderr(chunk: string): void {
    for (const line of chunk.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      this.stderrRing.push(redactSecrets(trimmed).slice(0, STDERR_LINE_LIMIT));
      if (this.stderrRing.length > STDERR_RING_LINES) {
        this.stderrRing.shift();
      }
    }
  }

  private formatStderrTail(): string {
    const tail = this.stderrRing.slice(-3).join(' | ');
    return tail.length > 0 ? `: ${tail}` : '';
  }

  private markFailed(reason: string): void {
    // Keep the first failure: later exit noise is usually a consequence of it.
    if (this.state !== 'failed') {
      this.state = 'failed';
      this.failureReason = redactSecrets(reason).slice(0, FAILURE_REASON_LIMIT);
      this.tools = [];
      this.logger?.error('mcp server failed', {
        serverId: this.config.id,
        name: this.config.name,
        reason: this.failureReason,
      });
    }
    this.touchHealthCheck();
  }

  /** Shutting a child down must not erase a recorded failure the UI still needs. */
  private markStopped(): void {
    if (this.state !== 'failed') {
      this.state = 'stopped';
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }

  private touchHealthCheck(): void {
    this.lastHealthCheckAt = new Date().toISOString();
  }
}

export class McpRuntime {
  private readonly connections = new Map<string, McpServerConnection>();
  private readonly listeners = new Set<() => void>();
  private knownServers: McpServerConfig[] = [];
  private syncChain: Promise<void> = Promise.resolve();

  constructor(private readonly logger?: McpRuntimeLogger) {}

  /**
   * Brings running servers in line with the persisted configuration: starts
   * newly enabled servers, stops disabled or deleted ones, and restarts servers
   * whose command changed. Calls are serialized so overlapping settings edits
   * cannot leave orphaned children behind.
   */
  sync(servers: McpServerConfig[]): Promise<void> {
    this.syncChain = this.syncChain.then(() => this.applySync(servers)).catch(() => undefined);
    return this.syncChain;
  }

  /** Starts (or restarts) a single server and reports whether it handshook. */
  async ensureServer(server: McpServerConfig): Promise<boolean> {
    if (!server.enabled) {
      return false;
    }

    const existing = this.connections.get(server.id);
    if (existing && isSameCommand(existing.config, server)) {
      if (existing.getStatus() === 'ready') {
        return true;
      }
      await existing.restart();
    } else {
      if (existing) {
        await existing.stop();
      }
      const connection = new McpServerConnection(server, this.logger);
      this.connections.set(server.id, connection);
      await connection.start();
    }

    this.rememberServer(server);
    this.notifyListeners();
    return this.connections.get(server.id)?.getStatus() === 'ready';
  }

  listTools(): McpDiscoveredTool[] {
    return [...this.connections.values()].flatMap((connection) => connection.listTools());
  }

  listKernelTools(): KernelTool[] {
    return [...this.connections.values()].flatMap((connection) =>
      connection.listTools().map((tool) => this.toKernelTool(connection, tool))
    );
  }

  listRuntimeStatus(): DesktopMcpRuntimeStatus[] {
    return this.knownServers.map((server) => {
      const connection = this.connections.get(server.id);
      if (!server.enabled || !connection) {
        return {
          serverId: server.id,
          name: server.name,
          command: server.command,
          args: server.args,
          transport: 'stdio',
          status: 'disabled',
          toolCount: 0,
          lastHealthCheckAt: connection?.getLastHealthCheckAt() ?? new Date().toISOString(),
          failureReason: null,
        };
      }

      return {
        serverId: server.id,
        name: server.name,
        command: server.command,
        args: server.args,
        transport: 'stdio',
        status: connection.getStatus() === 'ready' ? 'ready' : 'failed',
        toolCount: connection.listTools().length,
        lastHealthCheckAt: connection.getLastHealthCheckAt(),
        failureReason: connection.getFailureReason(),
      };
    });
  }

  /** Recent stderr for one server. Diagnostics only; secrets are redacted. */
  readServerDiagnostics(serverId: string): string[] {
    return this.connections.get(serverId)?.readStderr() ?? [];
  }

  onToolsChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async stop(): Promise<void> {
    const connections = [...this.connections.values()];
    this.connections.clear();
    await Promise.all(connections.map((connection) => connection.stop()));
    this.notifyListeners();
  }

  private async applySync(servers: McpServerConfig[]): Promise<void> {
    this.knownServers = servers.map((server) => ({ ...server, args: server.args ?? [] }));
    const desired = new Map(this.knownServers.filter((server) => server.enabled).map((server) => [server.id, server]));

    for (const [serverId, connection] of [...this.connections]) {
      const next = desired.get(serverId);
      if (!next) {
        this.connections.delete(serverId);
        await connection.stop();
        continue;
      }
      if (!isSameCommand(connection.config, next)) {
        this.connections.delete(serverId);
        await connection.stop();
      }
    }

    const started: Promise<void>[] = [];
    for (const [serverId, server] of desired) {
      if (this.connections.has(serverId)) {
        continue;
      }
      const connection = new McpServerConnection(server, this.logger);
      this.connections.set(serverId, connection);
      started.push(connection.start());
    }

    await Promise.all(started);
    this.notifyListeners();
  }

  private rememberServer(server: McpServerConfig): void {
    const normalized: McpServerConfig = { ...server, args: server.args ?? [] };
    const index = this.knownServers.findIndex((known) => known.id === server.id);
    if (index === -1) {
      this.knownServers = [...this.knownServers, normalized];
      return;
    }
    this.knownServers = this.knownServers.map((known) => (known.id === server.id ? normalized : known));
  }

  private toKernelTool(connection: McpServerConnection, tool: McpDiscoveredTool): KernelTool {
    return {
      name: tool.kernelToolName,
      description: tool.description,
      inputSchema: tool.inputSchema,
      permission: MCP_TOOL_PERMISSION,
      renderer: { kind: 'text', collapsible: true },
      execute: (input: Record<string, unknown>, context: KernelToolContext): Promise<KernelToolResult> =>
        connection.callTool(tool.toolName, input, context.abortSignal),
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

let sharedRuntime: McpRuntime | null = null;

/**
 * The tooling service owns MCP configuration while the runtime service owns tool
 * registration, and `main/index.ts` constructs both independently. A shared
 * instance keeps them pointed at the same child processes without changing those
 * constructor call sites.
 */
export function getSharedMcpRuntime(logger?: McpRuntimeLogger): McpRuntime {
  if (!sharedRuntime) {
    sharedRuntime = new McpRuntime(logger);
  }
  return sharedRuntime;
}

export function buildKernelToolName(serverId: string, toolName: string): string {
  // The renderer activity model classifies any tool whose name contains `__` as
  // an MCP tool, so the separator is part of the contract.
  return `mcp__${sanitizeNameSegment(serverId)}__${sanitizeNameSegment(toolName)}`;
}

export function isMcpKernelToolName(name: string): boolean {
  return name.startsWith('mcp__');
}

/**
 * Spawned servers get an allowlist instead of `process.env`: the desktop
 * process holds provider API keys and session secrets that third-party servers
 * have no reason to read.
 */
function buildServerEnv(extra?: Record<string, string>): Record<string, string> {
  const allowlist = [
    'PATH',
    'HOME',
    'LANG',
    'LC_ALL',
    'TMPDIR',
    'TEMP',
    'TMP',
    'SystemRoot',
    'SYSTEMROOT',
    'COMSPEC',
    'PATHEXT',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
  ];

  const env: Record<string, string> = {};
  for (const key of allowlist) {
    const value = process.env[key];
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  return env;
}

function toKernelToolResult(raw: unknown): KernelToolResult {
  const record = asRecord(raw);
  if (!record) {
    return { success: false, error: 'MCP server returned a malformed tools/call result' };
  }

  const blocks = Array.isArray(record.content) ? record.content : [];
  const output = blocks.map(summarizeContentBlock).filter((part) => part.length > 0).join('\n');
  const isError = record.isError === true;

  if (isError) {
    return {
      success: false,
      error: output.length > 0 ? output : 'MCP tool reported an error',
      data: record.structuredContent,
    };
  }

  return {
    success: true,
    output,
    data: record.structuredContent,
  };
}

function summarizeContentBlock(block: unknown): string {
  const record = asRecord(block);
  if (!record) {
    return '';
  }

  switch (record.type) {
    case 'text':
      return typeof record.text === 'string' ? record.text : '';
    case 'image':
      return '<image content>';
    case 'audio':
      return '<audio content>';
    case 'resource':
    case 'resource_link':
      return '<resource content>';
    default:
      return typeof record.type === 'string' ? `<${record.type} content>` : '';
  }
}

function assertHandshake(result: unknown): void {
  const record = asRecord(result);
  if (!record || typeof record.protocolVersion !== 'string') {
    throw new Error('invalid initialize response: missing protocolVersion');
  }
}

function isSameCommand(left: McpServerConfig, right: McpServerConfig): boolean {
  return (
    left.command === right.command &&
    JSON.stringify(left.args ?? []) === JSON.stringify(right.args ?? []) &&
    JSON.stringify(left.env ?? {}) === JSON.stringify(right.env ?? {})
  );
}

function sanitizeNameSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Best-effort masking so diagnostics never carry tokens into logs or the UI. */
function redactSecrets(value: string): string {
  return value
    .replace(/\b(sk|pk|rk|ghp|gho|ghu|ghs|xox[abps])[-_][A-Za-z0-9_-]{8,}/gi, '$1-***')
    .replace(
      /\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Za-z0-9_]*)\s*[:=]\s*\S+/gi,
      '$1=***'
    )
    .replace(/\bBearer\s+\S+/gi, 'Bearer ***');
}
