import { spawn, ChildProcess } from 'child_process';
import { createWriteStream, mkdirSync, WriteStream } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { EventSource } from 'eventsource';
import {
  MCPServer,
  MCPTool,
  MCPMessage,
  MCPInitializeParams,
  MCPCapabilities,
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
} from '../types/mcp.js';

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

export interface MCPClientOptions {
  /** Startup/handshake timeout in ms. Cold-start `npx`/`uvx` servers need this. */
  startupTimeoutMs?: number;
  /** Per-tool-call timeout in ms. */
  requestTimeoutMs?: number;
}

export class MCPClient {
  private servers: Map<string, MCPServerConnection> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  constructor(private readonly options: MCPClientOptions = {}) {}

  async addServer(server: MCPServer, signal?: AbortSignal): Promise<void> {
    const connection = new MCPServerConnection(server, this.options);
    try {
      await connection.connect(signal);
      this.servers.set(server.id, connection);

      // Tools are namespaced `server__tool` so two servers exposing the same
      // tool name cannot shadow each other.
      for (const tool of connection.getTools()) {
        this.tools.set(tool.name, tool);
      }
    } catch (error) {
      await connection.disconnect();
      console.error(`Failed to connect to MCP server ${server.id}:`, error);
      throw error;
    }
  }

  async removeServer(serverId: string): Promise<void> {
    const connection = this.servers.get(serverId);
    if (connection) {
      const serverTools = connection.getTools();
      await connection.disconnect();
      this.servers.delete(serverId);

      for (const tool of serverTools) {
        this.tools.delete(tool.name);
      }
    }
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  isServerConnected(serverId: string): boolean {
    return this.servers.get(serverId)?.isConnected() ?? false;
  }

  async callTool(name: string, args: Record<string, any>, signal?: AbortSignal): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return await tool.handler(args, signal);
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
  private options: MCPClientOptions;
  private process?: ChildProcess;
  private eventSource?: EventSource;
  private stderrLog?: WriteStream;
  private messageId = 0;
  private stdoutBuffer = '';
  private connected = false;
  /** Endpoint the legacy HTTP+SSE transport tells us to POST to. */
  private ssePostEndpoint?: string;
  /** Session id issued by a Streamable HTTP server via `Mcp-Session-Id`. */
  private httpSessionId?: string;
  private negotiatedProtocolVersion = MCP_PROTOCOL_VERSION;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timer: NodeJS.Timeout;
      signal?: AbortSignal;
      abortListener?: () => void;
    }
  >();
  private tools: MCPTool[] = [];

  constructor(server: MCPServer, options: MCPClientOptions = {}) {
    this.server = server;
    this.options = options;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    switch (this.server.transport) {
      case 'stdio':
        await this.connectStdio();
        break;
      case 'http':
        // Streamable HTTP needs no pre-connection; the POST carries everything.
        break;
      case 'sse':
        await this.connectSse(signal);
        break;
      default:
        throw new Error(`Unsupported transport: ${this.server.transport}`);
    }

    await this.initialize(signal);
    await this.listTools(signal);
    this.connected = true;
  }

  private async connectStdio(): Promise<void> {
    if (!this.server.command) {
      throw new Error('Command required for stdio transport');
    }

    this.process = spawn(this.server.command, this.server.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.server.env },
      detached: process.platform !== 'win32',
    });

    this.process.on('error', (error) => {
      console.error(`MCP server ${this.server.id} error:`, error);
      this.failAllPending(error);
    });

    this.process.on('exit', (code, signal) => {
      this.connected = false;
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      this.failAllPending(
        new Error(
          `MCP server ${this.server.id} exited (${detail}). See ${this.stderrLogPath()} for its output.`
        )
      );
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      // Frames are newline-delimited but a single chunk may split one, so keep
      // a buffer rather than parsing per-chunk. The previous implementation
      // dropped any frame that straddled a chunk boundary.
      this.stdoutBuffer += chunk.toString('utf8');
      let newlineIndex = this.stdoutBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
        if (line) {
          this.ingestFrame(line);
        }
        newlineIndex = this.stdoutBuffer.indexOf('\n');
      }
    });

    // Servers write diagnostics to stderr. Swallowing it is why handshake
    // failures previously surfaced only as an opaque timeout.
    this.attachStderrLog();
  }

  private stderrLogPath(): string {
    return join(homedir(), '.echoai', 'logs', 'mcp', `${this.server.id}.stderr.log`);
  }

  private attachStderrLog(): void {
    try {
      const logPath = this.stderrLogPath();
      mkdirSync(join(homedir(), '.echoai', 'logs', 'mcp'), { recursive: true, mode: 0o700 });
      // Truncate per launch so the log reflects the current process.
      this.stderrLog = createWriteStream(logPath, { flags: 'w', mode: 0o600 });
      this.stderrLog.on('error', () => {
        // `createWriteStream` reports open/write failures asynchronously. The
        // log is diagnostic-only, so a read-only home or sandbox must not crash
        // an otherwise healthy MCP connection.
        this.stderrLog = undefined;
      });
      this.process?.stderr?.pipe(this.stderrLog);
    } catch {
      // Logging is best-effort; fall back to inheriting nothing.
    }
  }

  private async connectSse(signal?: AbortSignal): Promise<void> {
    if (!this.server.url) {
      throw new Error('URL required for SSE transport');
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let source: EventSource | undefined;
      let timer: NodeJS.Timeout | undefined;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const finishResolve = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => {
        source?.close();
        finishReject(abortError(signal));
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      try {
        source = new EventSource(this.server.url!, {
          fetch: (url, init) => fetch(url, {
            ...init,
            headers: { ...init.headers, ...this.server.headers },
          }),
        });
      } catch (error) {
        finishReject(error instanceof Error ? error : new Error('Failed to create SSE connection'));
        return;
      }

      this.eventSource = source;
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
        return;
      }

      timer = setTimeout(
        () => {
          source?.close();
          finishReject(new Error(`SSE handshake with ${this.server.id} timed out`));
        },
        this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS
      );

      // The legacy HTTP+SSE transport opens with an `endpoint` event naming the
      // URL the client must POST requests to. Without capturing it there is no
      // send path at all, which is why every SSE call used to hang.
      source.addEventListener('endpoint', (event: MessageEvent) => {
        this.ssePostEndpoint = new URL(String(event.data), this.server.url).toString();
        finishResolve();
      });

      source.onmessage = (event: MessageEvent) => {
        if (event.data) {
          this.ingestFrame(String(event.data));
        }
      };

      source.onerror = (error) => {
        this.failAllPending(new Error(`SSE stream error for ${this.server.id}`));
        finishReject(error instanceof Error ? error : new Error('SSE stream error'));
      };

      source.onopen = () => {
        // Some servers never emit `endpoint` and expect requests to go to the
        // same URL. Resolve on open so those still work.
        if (!this.ssePostEndpoint) {
          this.ssePostEndpoint = this.server.url;
        }
        finishResolve();
      };
    });
  }

  private async initialize(signal?: AbortSignal): Promise<void> {
    const capabilities: MCPCapabilities = {
      tools: { listChanged: true },
    };

    const params: MCPInitializeParams = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities,
      clientInfo: {
        name: 'EchoAI',
        version: '2.3.4',
      },
    };

    const result = await this.sendRequest(
      'initialize',
      params,
      this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
      signal
    );

    if (result?.protocolVersion) {
      this.negotiatedProtocolVersion = String(result.protocolVersion);
    }

    // Mandatory per spec. Omitting it leaves compliant servers in a
    // pre-initialized state where every subsequent request is refused.
    this.sendNotification('notifications/initialized');
  }

  private async listTools(signal?: AbortSignal): Promise<void> {
    const response = await this.sendRequest('tools/list', {}, undefined, signal);
    const discovered = Array.isArray(response?.tools) ? response.tools : [];

    this.tools = discovered.map((tool: any) => ({
      name: `${this.server.id}__${tool.name}`,
      description: tool.description ?? '',
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      handler: async (args: Record<string, any>, signal?: AbortSignal) => {
        return await this.sendRequest('tools/call', {
          name: tool.name,
          arguments: args ?? {},
        }, undefined, signal);
      },
    }));
  }

  private nextId(): string {
    this.messageId += 1;
    return String(this.messageId);
  }

  private sendNotification(method: string, params?: any): void {
    const message: MCPMessage = { jsonrpc: '2.0', method, params };
    void this.writeFrame(message).catch(() => {
      // Notifications are fire-and-forget by definition.
    });
  }

  private async sendRequest(
    method: string,
    params?: any,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<any> {
    throwIfAborted(signal);
    const id = this.nextId();
    const message: MCPMessage = { jsonrpc: '2.0', id, method, params };
    const effectiveTimeout =
      timeoutMs ?? this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.takePending(id);
        pending?.reject(
          new Error(
            `MCP request ${method} to ${this.server.id} timed out after ${effectiveTimeout}ms`
          )
        );
      }, effectiveTimeout);
      const abortListener = () => {
        const pending = this.takePending(id);
        pending?.reject(abortError(signal));
      };

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer,
        signal,
        abortListener,
      });
      signal?.addEventListener('abort', abortListener, { once: true });
      if (signal?.aborted) {
        abortListener();
        return;
      }

      this.writeFrame(message, signal).catch((error) => {
        this.takePending(id)?.reject(error);
      });
    });
  }

  private takePending(id: string) {
    const pending = this.pendingRequests.get(id);
    if (!pending) return undefined;
    clearTimeout(pending.timer);
    if (pending.abortListener) {
      pending.signal?.removeEventListener('abort', pending.abortListener);
    }
    this.pendingRequests.delete(id);
    return pending;
  }

  /** Transport-specific write. Every path emits a full JSON-RPC 2.0 envelope. */
  private async writeFrame(message: MCPMessage, signal?: AbortSignal): Promise<void> {
    if (this.server.transport === 'stdio') {
      const stdin = this.process?.stdin;
      if (!stdin || stdin.destroyed) {
        throw new Error(`MCP server ${this.server.id} stdin is not writable`);
      }
      stdin.write(`${JSON.stringify(message)}\n`);
      return;
    }

    const target =
      this.server.transport === 'sse' ? this.ssePostEndpoint ?? this.server.url : this.server.url;
    if (!target) {
      throw new Error(`No POST endpoint resolved for MCP server ${this.server.id}`);
    }

    const headers: Record<string, string> = {
      ...this.server.headers,
      'Content-Type': 'application/json',
      // Streamable HTTP servers may answer with either JSON or an SSE stream.
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': this.negotiatedProtocolVersion,
    };
    if (this.httpSessionId) {
      headers['Mcp-Session-Id'] = this.httpSessionId;
    }

    const response = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal,
    });

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      this.httpSessionId = sessionId;
    }

    if (!response.ok) {
      throw new Error(
        `MCP server ${this.server.id} returned HTTP ${response.status} for ${message.method}`
      );
    }

    // 202 Accepted is the correct response to a notification; there is no body.
    if (response.status === 204 || response.status === 202) {
      return;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    if (!body) {
      return;
    }

    if (contentType.includes('text/event-stream')) {
      for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          if (payload && payload !== '[DONE]') {
            this.ingestFrame(payload);
          }
        }
      }
      return;
    }

    // For the legacy SSE transport the reply arrives on the event stream, not
    // in the POST body, so an empty JSON body here is expected and fine.
    this.ingestFrame(body);
  }

  private ingestFrame(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error(`Failed to parse MCP frame from ${this.server.id}: ${raw.slice(0, 200)}`);
      return;
    }

    // Servers may batch responses into an array.
    const frames = Array.isArray(parsed) ? parsed : [parsed];
    for (const frame of frames) {
      this.handleMessage(frame as MCPMessage);
    }
  }

  private handleMessage(message: MCPMessage): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    // Server-to-client request. We advertise no sampling/roots capability, so
    // answer method-not-found rather than leaving the server waiting forever.
    if (message.method && message.id !== undefined) {
      void this.writeFrame({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: MCP_ERROR_CODES.methodNotFound,
          message: `EchoAI does not implement ${message.method}`,
        },
      }).catch(() => {
        // Best-effort; a server that cannot receive our reply will time out.
      });
      return;
    }

    // Server-to-client notification. Nothing to correlate.
    if (message.method && message.id === undefined) {
      return;
    }

    if (message.id === undefined) {
      return;
    }

    const key = String(message.id);
    const pending = this.takePending(key);
    if (!pending) {
      return;
    }

    if (message.error) {
      pending.reject(
        new Error(`${message.error.message} (code ${message.error.code})`)
      );
    } else {
      pending.resolve(message.result);
    }
  }

  private failAllPending(error: Error): void {
    for (const [id] of this.pendingRequests) {
      this.takePending(id)?.reject(error);
    }
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.failAllPending(new Error(`MCP server ${this.server.id} disconnected`));

    if (this.process) {
      this.process.stdin?.end();
      if (this.process.pid && process.platform !== 'win32') {
        try {
          process.kill(-this.process.pid, 'SIGTERM');
        } catch {
          this.process.kill();
        }
      } else {
        this.process.kill();
      }
      this.process = undefined;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    if (this.stderrLog) {
      this.stderrLog.end();
      this.stderrLog = undefined;
    }
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal);
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error('MCP operation was cancelled');
  error.name = 'AbortError';
  return error;
}
