import * as acp from '@agentclientprotocol/sdk';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as vscode from 'vscode';

export type EchoAgentStatus = 'stopped' | 'connecting' | 'ready' | 'running' | 'error';
export type EchoContentBlock = acp.ContentBlock;

export interface EchoSessionState {
  sessionId: string;
  mode: 'default' | 'plan';
  title?: string;
  provider?: string;
  model?: string;
}

export interface EchoRouting {
  provider: string;
  model: string;
}

export interface EchoSessionListItem extends EchoSessionState {
  cwd: string;
  updatedAt?: string;
}

export type EchoAcpEvent =
  | { type: 'status'; status: EchoAgentStatus; message?: string }
  | ({ type: 'session' } & EchoSessionState)
  | { type: 'reset' }
  | { type: 'update'; update: acp.SessionNotification['update'] }
  | {
      type: 'turn';
      stopReason: acp.StopReason;
      usage?: acp.Usage;
    };

interface LaunchCommand {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

interface ActiveTurn {
  id: symbol;
  sessionId: string;
  completion: Promise<void>;
}

interface LoadingSession {
  sessionId: string;
  updates: acp.SessionNotification['update'][];
}

const activeSessionKey = 'echoai.activeSessionId';

export class EchoAcpClient implements vscode.Disposable {
  private readonly eventEmitter = new vscode.EventEmitter<EchoAcpEvent>();
  private readonly output = vscode.window.createOutputChannel('Echo AI');
  private child: ChildProcessWithoutNullStreams | undefined;
  private connection: acp.ClientSideConnection | undefined;
  private sessionId: string | undefined;
  private sessionState: EchoSessionState | undefined;
  private workspaceRoot: string | undefined;
  private starting: Promise<void> | undefined;
  private activeTurn: ActiveTurn | undefined;
  private loadingSession: LoadingSession | undefined;
  private cancelPendingPermission: (() => void) | undefined;
  private status: EchoAgentStatus = 'stopped';
  private requestedRouting: EchoRouting | undefined;

  readonly onDidEvent = this.eventEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Route subsequent turns to a provider/model chosen in the panel. The agent reads
   * this from request `_meta`, so the selection applies from the next prompt onward
   * without rewriting the user's global configuration.
   */
  setRouting(routing: EchoRouting | undefined): void {
    this.requestedRouting = routing;
    if (routing && this.sessionState) {
      this.sessionState = {
        ...this.sessionState,
        provider: routing.provider,
        model: routing.model,
      };
      this.emitSession();
    }
  }

  get currentRouting(): EchoRouting | undefined {
    return this.requestedRouting ? { ...this.requestedRouting } : undefined;
  }

  private routingMeta(): { _meta: { echoai: EchoRouting } } | Record<string, never> {
    return this.requestedRouting ? { _meta: { echoai: { ...this.requestedRouting } } } : {};
  }

  get currentStatus(): EchoAgentStatus {
    return this.status;
  }

  get currentSession(): EchoSessionState | undefined {
    return this.sessionState ? { ...this.sessionState } : undefined;
  }

  async start(): Promise<void> {
    if (this.connection && this.sessionId && this.status !== 'error' && this.status !== 'stopped') {
      return;
    }
    if (!this.starting) {
      this.starting = this.startInternal().finally(() => {
        this.starting = undefined;
      });
    }
    return this.starting;
  }

  async listSessions(): Promise<EchoSessionListItem[]> {
    await this.ensureConnected();
    const workspaceRoot = this.requireWorkspaceRoot();
    const sessions = await this.listAllSessions(this.requireConnection(), workspaceRoot);
    return sessions
      .map((session) => normalizeSessionInfo(session, this.sessionState))
      .sort((left, right) => Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? ''));
  }

  async loadSession(sessionId: string): Promise<void> {
    if (this.activeTurn) {
      throw new Error('Cancel the active Echo AI run before loading another session.');
    }
    await this.ensureConnected();
    const workspaceRoot = this.requireWorkspaceRoot();
    const listed = await this.listAllSessions(this.requireConnection(), workspaceRoot);
    const info = listed.find((session) => session.sessionId === sessionId);
    if (!info) {
      throw new Error('That Echo AI session is no longer available in this workspace.');
    }
    await this.activateLoadedSession(this.requireConnection(), info);
  }

  async newSession(): Promise<string> {
    if (this.activeTurn) {
      throw new Error('Cancel the active Echo AI run before starting a new session.');
    }
    await this.ensureConnected();
    const connection = this.requireConnection();
    const workspaceRoot = this.requireWorkspaceRoot();
    const result = await connection.newSession({
      cwd: workspaceRoot,
      mcpServers: [],
      ...this.routingMeta(),
    });
    this.sessionId = result.sessionId;

    let mode = normalizeMode(result.modes?.currentModeId) ?? 'default';
    const configuredMode = this.configuredMode();
    if (configuredMode !== mode) {
      await connection.setSessionMode({ sessionId: result.sessionId, modeId: configuredMode });
      mode = configuredMode;
    }

    const routing = readEchoRouting(result._meta);
    this.sessionState = {
      sessionId: result.sessionId,
      mode,
      ...routing,
    };
    await this.persistActiveSession(result.sessionId);
    this.emit({ type: 'reset' });
    this.emitSession();
    return result.sessionId;
  }

  async setMode(mode: 'default' | 'plan'): Promise<void> {
    if (this.activeTurn) {
      throw new Error('Cancel the active Echo AI run before changing modes.');
    }
    await this.ensureConnected();
    const sessionId = this.requireSessionId();
    await this.requireConnection().setSessionMode({ sessionId, modeId: mode });
    this.sessionState = {
      ...(this.sessionState ?? { sessionId }),
      sessionId,
      mode,
    };
    this.emitSession();
  }

  async prompt(text: string, editorContext: EchoContentBlock[] = []): Promise<void> {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    if (this.activeTurn) {
      throw new Error('Echo AI is already running a turn. Cancel it before sending another prompt.');
    }

    await this.ensureConnected();
    if (this.activeTurn) {
      throw new Error('Echo AI is already running a turn. Cancel it before sending another prompt.');
    }

    const connection = this.requireConnection();
    const sessionId = this.requireSessionId();
    const prompt: acp.ContentBlock[] = [{ type: 'text', text: normalized }, ...editorContext];
    const turnId = Symbol('echoai-turn');
    const activeTurn: ActiveTurn = {
      id: turnId,
      sessionId,
      completion: Promise.resolve(),
    };
    this.activeTurn = activeTurn;
    this.setStatus('running');

    const completion = (async () => {
      try {
        const result = await connection.prompt({
          sessionId,
          messageId: randomUUID(),
          prompt,
          ...this.routingMeta(),
        });
        if (
          this.activeTurn?.id === turnId &&
          this.connection === connection &&
          this.sessionId === sessionId
        ) {
          this.emit({
            type: 'turn',
            stopReason: result.stopReason,
            usage: result.usage ?? undefined,
          });
          this.setStatus('ready');
        }
      } catch (error) {
        if (
          this.activeTurn?.id === turnId &&
          this.connection === connection &&
          this.sessionId === sessionId
        ) {
          this.setStatus('error', toErrorMessage(error));
        }
        throw error;
      } finally {
        if (this.activeTurn?.id === turnId) {
          this.activeTurn = undefined;
        }
      }
    })();

    activeTurn.completion = completion;
    await completion;
  }

  async cancel(): Promise<void> {
    this.cancelPendingPermission?.();
    const activeTurn = this.activeTurn;
    const connection = this.connection;
    if (!connection || !activeTurn) {
      return;
    }

    try {
      await connection.cancel({ sessionId: activeTurn.sessionId });
    } finally {
      await activeTurn.completion.catch(() => undefined);
    }
  }

  async restart(): Promise<void> {
    if (this.activeTurn) {
      await this.cancel();
    }
    this.stopProcess();
    await this.start();
  }

  openRuntimeTerminal(args: string[], title = 'Echo AI'): vscode.Terminal {
    const launch = this.resolveRuntimeCommand(args);
    const terminal = vscode.window.createTerminal({
      name: title,
      shellPath: launch.command,
      shellArgs: launch.args,
      env: launch.env,
      isTransient: false,
    });
    terminal.show();
    return terminal;
  }

  dispose(): void {
    this.stopProcess();
    this.eventEmitter.dispose();
    this.output.dispose();
  }

  private async startInternal(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      const message = 'Open a folder before starting Echo AI.';
      this.setStatus('error', message);
      throw new Error(message);
    }
    if (!vscode.workspace.isTrusted) {
      const message = 'Trust this workspace before starting the Echo AI agent.';
      this.setStatus('error', message);
      throw new Error(message);
    }

    this.stopProcess(false);
    this.workspaceRoot = workspaceRoot;
    this.setStatus('connecting', 'Starting local Echo AI runtime…');

    const launch = this.resolveRuntimeCommand(['acp', '--stdio']);
    this.output.appendLine(`Starting: ${launch.command} ${launch.args.join(' ')}`);
    const child = spawn(launch.command, launch.args, {
      cwd: workspaceRoot,
      env: launch.env,
      stdio: 'pipe',
      detached: process.platform !== 'win32',
      windowsHide: true,
    });
    this.child = child;

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => this.output.append(chunk));
    child.on('error', (error) => this.output.appendLine(`Echo AI process error: ${error.message}`));
    child.on('exit', (code, signal) => {
      if (this.child !== child) {
        return;
      }
      this.child = undefined;
      this.connection = undefined;
      this.sessionId = undefined;
      this.sessionState = undefined;
      const detail = `Echo AI process exited (${signal ?? code ?? 'unknown'}).`;
      this.output.appendLine(detail);
      if (this.status !== 'stopped') {
        this.setStatus(code === 0 ? 'stopped' : 'error', detail);
      }
    });

    const input = Writable.toWeb(child.stdin) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
    const connection = new acp.ClientSideConnection(
      () => ({
        requestPermission: (params) => this.requestPermission(params),
        sessionUpdate: async (params) => this.handleSessionUpdate(params),
      }),
      acp.ndJsonStream(input, output),
    );
    this.connection = connection;

    void connection.closed.then(() => {
      if (this.connection === connection && this.status !== 'stopped') {
        this.setStatus('error', 'The Echo AI runtime connection closed.');
      }
    });

    try {
      const extensionVersion = String(this.context.extension.packageJSON.version ?? '0.0.0');
      const initialized = await withTimeout(
        connection.initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {
            auth: { terminal: true },
          },
          clientInfo: {
            name: 'echoai-ide',
            title: 'Echo AI IDE',
            version: extensionVersion,
          },
        }),
        15_000,
        'Timed out waiting for the Echo AI ACP runtime to initialize.',
      );
      this.output.appendLine(
        `Connected to ${initialized.agentInfo?.name ?? 'Echo AI'} ${initialized.agentInfo?.version ?? ''}`.trim(),
      );

      const listed = await withTimeout(
        this.listAllSessions(connection, workspaceRoot),
        15_000,
        'Timed out listing Echo AI sessions.',
      );
      const persistedId = this.context.workspaceState.get<string>(activeSessionKey);
      const persisted = persistedId
        ? listed.find((session) => session.sessionId === persistedId)
        : undefined;

      if (persisted) {
        try {
          await this.activateLoadedSession(connection, persisted);
        } catch (error) {
          this.output.appendLine(`Could not restore session ${persisted.sessionId}: ${toErrorMessage(error)}`);
          await this.createInitialSession(connection, workspaceRoot);
        }
      } else {
        await this.createInitialSession(connection, workspaceRoot);
      }
      this.setStatus('ready');
    } catch (error) {
      const message = toErrorMessage(error);
      this.output.appendLine(`Echo AI startup failed: ${message}`);
      this.stopProcess(false);
      this.setStatus('error', message);
      throw new Error(message, { cause: error });
    }
  }

  private async createInitialSession(
    connection: acp.ClientSideConnection,
    workspaceRoot: string,
  ): Promise<void> {
    const result = await withTimeout(
      connection.newSession({ cwd: workspaceRoot, mcpServers: [], ...this.routingMeta() }),
      15_000,
      'Timed out creating an Echo AI session.',
    );
    this.sessionId = result.sessionId;
    let mode = normalizeMode(result.modes?.currentModeId) ?? 'default';
    const configuredMode = this.configuredMode();
    if (configuredMode !== mode) {
      await connection.setSessionMode({ sessionId: result.sessionId, modeId: configuredMode });
      mode = configuredMode;
    }
    this.sessionState = {
      sessionId: result.sessionId,
      mode,
      ...readEchoRouting(result._meta),
    };
    await this.persistActiveSession(result.sessionId);
    this.emit({ type: 'reset' });
    this.emitSession();
  }

  private async activateLoadedSession(
    connection: acp.ClientSideConnection,
    info: acp.SessionInfo,
  ): Promise<void> {
    const workspaceRoot = this.requireWorkspaceRoot();
    const previousSessionId = this.sessionId;
    const previousState = this.sessionState;
    const loading: LoadingSession = {
      sessionId: info.sessionId,
      updates: [],
    };
    this.loadingSession = loading;
    this.sessionId = info.sessionId;

    try {
      const result = await connection.loadSession({
        sessionId: info.sessionId,
        cwd: workspaceRoot,
        mcpServers: [],
      });
      const routing = {
        ...readEchoRouting(info._meta),
        ...readEchoRouting(result._meta),
      };
      this.sessionState = {
        sessionId: info.sessionId,
        mode: normalizeMode(result.modes?.currentModeId) ?? 'default',
        title: info.title ?? undefined,
        ...routing,
      };
      await this.persistActiveSession(info.sessionId);
      this.emit({ type: 'reset' });
      this.emitSession();
      for (const update of loading.updates) {
        this.applySessionUpdate(update);
        this.emit({ type: 'update', update });
      }
    } catch (error) {
      this.sessionId = previousSessionId;
      this.sessionState = previousState;
      throw error;
    } finally {
      if (this.loadingSession === loading) {
        this.loadingSession = undefined;
      }
    }
  }

  private async handleSessionUpdate(params: acp.SessionNotification): Promise<void> {
    const loading = this.loadingSession;
    if (loading?.sessionId === params.sessionId) {
      loading.updates.push(params.update);
      return;
    }
    if (!this.sessionId || params.sessionId !== this.sessionId) {
      return;
    }
    if (params.update.sessionUpdate === 'user_message_chunk') {
      return;
    }
    const sessionChanged = this.applySessionUpdate(params.update);
    this.emit({ type: 'update', update: params.update });
    if (sessionChanged) {
      this.emitSession();
    }
  }

  private applySessionUpdate(update: acp.SessionNotification['update']): boolean {
    if (!this.sessionState) {
      return false;
    }
    if (update.sessionUpdate === 'current_mode_update') {
      const mode = normalizeMode(update.currentModeId);
      if (mode && this.sessionState.mode !== mode) {
        this.sessionState = { ...this.sessionState, mode };
        return true;
      }
    }
    if (update.sessionUpdate === 'session_info_update') {
      const routing = readEchoRouting(update._meta);
      const title = update.title === null ? undefined : update.title ?? this.sessionState.title;
      this.sessionState = {
        ...this.sessionState,
        title,
        ...routing,
      };
      return true;
    }
    return false;
  }

  private async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    interface PermissionChoice extends vscode.MessageItem {
      optionId: string;
    }

    const choices: PermissionChoice[] = params.options.map((option) => ({
      title: option.name,
      optionId: option.optionId,
    }));
    const rawInput = params.toolCall.rawInput
      ? JSON.stringify(params.toolCall.rawInput, null, 2).slice(0, 4000)
      : undefined;
    const locations = params.toolCall.locations
      ?.map((location) => `${location.path}${location.line ? `:${location.line}` : ''}`)
      .join(', ');
    const detail = [locations ? `Files: ${locations}` : undefined, rawInput]
      .filter(Boolean)
      .join('\n\n');
    let cancelPermission!: () => void;
    const cancelled = new Promise<undefined>((resolve) => {
      cancelPermission = () => resolve(undefined);
    });
    this.cancelPendingPermission = cancelPermission;

    let selected: PermissionChoice | undefined;
    try {
      selected = await Promise.race([
        vscode.window.showWarningMessage<PermissionChoice>(
          `Echo AI requests permission: ${params.toolCall.title}`,
          {
            modal: true,
            detail: detail || undefined,
          },
          ...choices,
        ),
        cancelled,
      ]);
    } finally {
      if (this.cancelPendingPermission === cancelPermission) {
        this.cancelPendingPermission = undefined;
      }
    }

    if (!selected) {
      return { outcome: { outcome: 'cancelled' } };
    }
    return {
      outcome: {
        outcome: 'selected',
        optionId: selected.optionId,
      },
    };
  }

  private async listAllSessions(
    connection: acp.ClientSideConnection,
    cwd: string,
  ): Promise<acp.SessionInfo[]> {
    const sessions: acp.SessionInfo[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await connection.listSessions({ cwd, cursor });
      sessions.push(...page.sessions);
      cursor = page.nextCursor;
    } while (cursor);
    return sessions;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection || !this.sessionId) {
      await this.start();
    }
  }

  private requireConnection(): acp.ClientSideConnection {
    if (!this.connection) {
      throw new Error('Echo AI is not connected.');
    }
    return this.connection;
  }

  private requireSessionId(): string {
    if (!this.sessionId) {
      throw new Error('Echo AI does not have an active session.');
    }
    return this.sessionId;
  }

  private requireWorkspaceRoot(): string {
    if (!this.workspaceRoot) {
      throw new Error('Echo AI does not have an active workspace.');
    }
    return this.workspaceRoot;
  }

  private configuredMode(): 'default' | 'plan' {
    return vscode.workspace.getConfiguration('echoAI').get<'default' | 'plan'>('defaultMode', 'default');
  }

  private resolveRuntimeCommand(args: string[]): LaunchCommand {
    const configuration = vscode.workspace.getConfiguration('echoAI');
    const inspected = configuration.inspect<string>('cliPath');
    const configured = (inspected?.globalValue ?? inspected?.defaultValue ?? 'echoai').trim();
    if (!configured) {
      throw new Error('Set echoAI.cliPath in your user settings to the Echo AI executable.');
    }

    const extensionVersion = String(this.context.extension.packageJSON.version ?? '0.0.0');
    const bundledRuntime = path.join(this.context.extensionPath, 'dist', 'acp-server.mjs');
    if (configured === 'echoai' && existsSync(bundledRuntime)) {
      return {
        command: process.execPath,
        args: [bundledRuntime, ...args],
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          ECHOAI_VERSION: extensionVersion,
        },
      };
    }

    const configuredExtension = path.extname(configured).toLowerCase();
    if (configuredExtension === '.js' || configuredExtension === '.mjs' || configuredExtension === '.cjs') {
      return {
        command: process.execPath,
        args: [path.resolve(configured), ...args],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      };
    }

    if (process.platform === 'win32' && (!configuredExtension || configuredExtension === '.cmd' || configuredExtension === '.bat')) {
      const shim = configuredExtension ? configured : `${configured}.cmd`;
      // A double quote needs no escape inside a character class, and `\"` is not a
      // legal identity escape under the `u` flag. Because regex literals are
      // validated when the script is parsed, the escaped form made the whole
      // extension fail to activate on every platform, not just Windows.
      if (/[&|<>^"]/u.test(shim)) {
        throw new Error('echoAI.cliPath contains characters that cannot be launched safely on Windows.');
      }
      const commandLine = [shim, ...args].map(quoteWindowsArgument).join(' ');
      return {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', `"${commandLine}"`],
        env: { ...process.env },
      };
    }

    return {
      command: configured,
      args,
      env: { ...process.env },
    };
  }

  private stopProcess(emitStatus = true): void {
    this.cancelPendingPermission?.();
    this.cancelPendingPermission = undefined;
    const child = this.child;
    this.child = undefined;
    this.connection = undefined;
    this.sessionId = undefined;
    this.sessionState = undefined;
    this.loadingSession = undefined;
    this.activeTurn = undefined;
    if (child && child.exitCode === null) {
      const pid = child.pid;
      if (process.platform !== 'win32' && typeof pid === 'number') {
        try {
          process.kill(-pid, 'SIGTERM');
          const escalation = setTimeout(() => {
            try {
              process.kill(-pid, 'SIGKILL');
            } catch {
              // The isolated process group has already exited.
            }
          }, 2_000);
          escalation.unref();
        } catch {
          if (!child.killed) child.kill();
        }
      } else if (!child.killed) {
        child.kill();
      }
    }
    if (emitStatus) {
      this.setStatus('stopped');
    }
  }

  private async persistActiveSession(sessionId: string): Promise<void> {
    try {
      await this.context.workspaceState.update(activeSessionKey, sessionId);
    } catch (error) {
      this.output.appendLine(`Could not persist active session: ${toErrorMessage(error)}`);
    }
  }

  private emitSession(): void {
    if (this.sessionState) {
      this.emit({ type: 'session', ...this.sessionState });
    }
  }

  private setStatus(status: EchoAgentStatus, message?: string): void {
    this.status = status;
    this.emit({ type: 'status', status, message });
  }

  private emit(event: EchoAcpEvent): void {
    this.eventEmitter.fire(event);
  }
}

function normalizeSessionInfo(
  info: acp.SessionInfo,
  active: EchoSessionState | undefined,
): EchoSessionListItem {
  const isActive = active?.sessionId === info.sessionId;
  return {
    sessionId: info.sessionId,
    cwd: info.cwd,
    title: info.title ?? undefined,
    updatedAt: info.updatedAt ?? undefined,
    mode: isActive ? active.mode : 'default',
    ...readEchoRouting(info._meta),
  };
}

function readEchoRouting(meta: { [key: string]: unknown } | null | undefined): Pick<EchoSessionState, 'provider' | 'model'> {
  const echoai = meta?.echoai;
  if (!isRecord(echoai)) {
    return {};
  }
  const provider = typeof echoai.provider === 'string' && echoai.provider.trim()
    ? echoai.provider
    : undefined;
  const model = typeof echoai.model === 'string' && echoai.model.trim()
    ? echoai.model
    : undefined;
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}

function normalizeMode(mode: string | null | undefined): 'default' | 'plan' | undefined {
  return mode === 'default' || mode === 'plan' ? mode : undefined;
}

function quoteWindowsArgument(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
