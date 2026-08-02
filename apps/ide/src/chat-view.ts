import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import {
  EchoAcpClient,
  type EchoAcpEvent,
  type EchoContentBlock,
  type EchoSessionListItem,
} from './acp-client.js';
import { renderChatWebview } from './chat-webview.js';
import type { EchoAccountService } from './echo-account.js';
import { isKnownRouting, listModelOptions } from './model-catalog.js';

const execFileAsync = promisify(execFile);

/** Context kinds offered by the composer's `#` picker. */
type ContextKind =
  | 'openFiles'
  | 'diagnostics'
  | 'gitDiff'
  | 'file'
  | 'folder'
  | 'spec'
  | 'steering'
  | 'mcp'
  | 'terminal';

interface ContextChip {
  kind: ContextKind;
  label: string;
  detail?: string;
  text: string;
}

interface EditorContext {
  displayText: string;
  blocks: EchoContentBlock[];
}

const sessionPreviewKey = 'echoai.sessionPreviews';
const openTabsKey = 'echoai.openTabs';
const MAX_PROMPT_CHARACTERS = 262_144;
const MAX_TOOL_PATH_CHARACTERS = 4_000;
const MAX_DIFF_CHARACTERS = 128_000;

class EchoDiffContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly documents = new Map<string, string>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.documents.get(uri.toString()) ?? '';
  }

  set(uri: vscode.Uri, content: string): void {
    this.documents.set(uri.toString(), content);
    while (this.documents.size > 100) {
      const oldest = this.documents.keys().next().value as string | undefined;
      if (!oldest) break;
      this.documents.delete(oldest);
    }
  }

  dispose(): void {
    this.documents.clear();
  }
}

export class EchoChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = 'echoai.chat';

  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly diffDocuments = new EchoDiffContentProvider();
  /** Workspace-relative paths the agent has edited in this session, for the change bar. */
  private readonly changedFiles = new Set<string>();
  private autopilot = true;
  private effortLevel = 'medium';

  private readonly extensionUri: vscode.Uri;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: EchoAcpClient,
    private readonly account: EchoAccountService,
  ) {
    this.extensionUri = context.extensionUri;
    this.disposables.push(
      this.account.onDidChange(() => {
        void this.postPanelState();
      }),
      this.client.onDidEvent((event) => this.handleClientEvent(event)),
      vscode.workspace.registerTextDocumentContentProvider('echoai-diff', this.diffDocuments),
      this.diffDocuments,
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    view.webview.html = renderChatWebview(view.webview);
    this.disposables.push(
      view.webview.onDidReceiveMessage((message: unknown) => {
        void this.handleWebviewMessage(message).catch((error: unknown) => this.reportError(error));
      }),
      view.onDidDispose(() => {
        if (this.view === view) {
          this.view = undefined;
        }
      }),
    );

    this.post({ type: 'status', status: this.client.currentStatus });
    const session = this.client.currentSession;
    if (session) {
      this.post({ type: 'session', ...session });
    }
    if (vscode.workspace.getConfiguration('echoAI').get<boolean>('autoStart', true)) {
      void this.client.start().catch((error: unknown) => this.reportError(error));
    }
  }

  async reveal(): Promise<void> {
    await vscode.commands.executeCommand(`${EchoChatViewProvider.viewType}.focus`);
  }

  async newSession(): Promise<void> {
    try {
      await this.client.newSession();
    } catch (error) {
      this.reportError(error);
    }
  }

  async showSessionPicker(): Promise<void> {
    try {
      const sessions = await this.client.listSessions();
      if (sessions.length === 0) {
        void vscode.window.showInformationMessage('No saved Echo AI sessions exist for this workspace.');
        return;
      }
      const activeId = this.client.currentSession?.sessionId;
      const items = sessions.map((session) => toSessionQuickPickItem(session, session.sessionId === activeId));
      const picked = await vscode.window.showQuickPick(items, {
        title: 'Echo AI Sessions',
        placeHolder: 'Load a persisted workspace session',
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (picked && picked.sessionId !== activeId) {
        await this.client.loadSession(picked.sessionId);
      }
    } catch (error) {
      this.reportError(error);
    }
  }

  async sendPrompt(text: string, editorContext?: EditorContext): Promise<void> {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    if (normalized.length > MAX_PROMPT_CHARACTERS) {
      this.reportError(new Error(`Echo AI prompts are limited to ${MAX_PROMPT_CHARACTERS.toLocaleString()} characters.`));
      return;
    }
    await this.reveal();
    try {
      await this.client.start();
      this.rememberSessionPreview(normalized);
      this.post({
        type: 'localUser',
        text: normalized,
        context: editorContext?.displayText,
      });
      await this.client.prompt(normalized, editorContext?.blocks);
    } catch (error) {
      this.reportError(error);
    }
  }

  /**
   * Label each tab with the words the conversation opened on.
   *
   * The agent titles every session "ACP Session", and ACP has no rename call, so the
   * opening prompt is kept per session on the IDE side. Only the first prompt counts,
   * so a tab keeps a stable name for the whole conversation.
   */
  private rememberSessionPreview(prompt: string): void {
    const sessionId = this.client.currentSession?.sessionId;
    if (!sessionId) return;
    const previews = this.readSessionPreviews();
    if (previews[sessionId]) return;
    const words = prompt.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!words) return;
    previews[sessionId] = words;
    const entries = Object.entries(previews).slice(-60);
    void this.context.workspaceState.update(sessionPreviewKey, Object.fromEntries(entries));
    void this.postPanelState();
  }

  private readSessionPreviews(): Record<string, string> {
    const stored = this.context.workspaceState.get<unknown>(sessionPreviewKey);
    if (!isRecord(stored)) return {};
    const previews: Record<string, string> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (typeof value === 'string' && value.trim()) {
        previews[key] = value.slice(0, 60);
      }
    }
    return previews;
  }

  async sendEditorInstruction(instruction: string): Promise<void> {
    const context = collectEditorContext(true);
    if (!context) {
      void vscode.window.showInformationMessage('Select code in an editor before using this command.');
      return;
    }
    await this.sendPrompt(instruction, context);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async handleWebviewMessage(message: unknown): Promise<void> {
    if (!isRecord(message) || typeof message.type !== 'string') {
      return;
    }

    switch (message.type) {
      case 'ready':
        await this.postPanelState();
        break;
      case 'send':
        if (typeof message.text === 'string') {
          await this.sendPrompt(
            message.text,
            this.buildPromptContext(message.context),
          );
        }
        break;
      case 'newSession':
        await this.newSession();
        await this.postPanelState();
        break;
      case 'switchSession':
        if (typeof message.sessionId === 'string') {
          await this.openSessionTab(message.sessionId);
        }
        break;
      case 'closeSession':
        if (typeof message.sessionId === 'string') {
          await this.closeSessionTab(message.sessionId);
        }
        break;
      case 'listHistory':
        await this.postHistory();
        break;
      case 'addContext':
        if (typeof message.kind === 'string') {
          await this.addContext(message.kind as ContextKind);
        }
        break;
      case 'setModel':
        if (typeof message.provider === 'string' && typeof message.model === 'string') {
          this.setRouting(message.provider, message.model);
          await this.postPanelState();
        }
        break;
      case 'setEffort':
        if (typeof message.level === 'string') {
          this.effortLevel = message.level;
        }
        break;
      case 'setAutopilot':
        this.autopilot = message.enabled === true;
        break;
      case 'viewChanges':
        await this.viewChanges();
        break;
      case 'revertChanges':
        await this.revertChanges();
        break;
      case 'signIn':
        try {
          await this.account.signIn();
          void vscode.window.showInformationMessage('Signed in to Echo AI.');
        } catch (error) {
          this.reportError(error);
        }
        await this.postPanelState();
        break;
      case 'showAccount':
        // Signed in, the row is a way into the full profile rather than a sign-out
        // shortcut, so plan and credit detail is one click away.
        await vscode.commands.executeCommand('echoai.showAccount');
        break;
      case 'showSessions':
        await this.showSessionPicker();
        await this.postPanelState();
        break;
      case 'cancel':
        await this.client.cancel();
        break;
      case 'setMode':
        if (message.mode === 'default' || message.mode === 'plan') {
          try {
            await this.client.setMode(message.mode);
          } catch (error) {
            this.reportError(error);
          }
        }
        break;
      case 'openLocation':
        if (typeof message.path === 'string') {
          await this.openLocation(message.path, typeof message.line === 'number' ? message.line : undefined);
        }
        break;
      case 'openDiff':
        if (
          typeof message.path === 'string' &&
          typeof message.newText === 'string' &&
          (message.oldText === undefined || typeof message.oldText === 'string')
        ) {
          await this.openDiff(message.path, message.oldText ?? '', message.newText);
        }
        break;
      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:LoopXo.echoai-ide');
        break;
      case 'configureRuntime':
        await vscode.commands.executeCommand('echoai.configure');
        break;
      case 'manageMcp':
        await vscode.commands.executeCommand('echoai.manageMcp');
        break;
      case 'login':
        await vscode.commands.executeCommand('echoai.login');
        break;
    }
  }

  private handleClientEvent(event: EchoAcpEvent): void {
    if (event.type === 'status') {
      void vscode.commands.executeCommand('setContext', 'echoai.running', event.status === 'running');
    }
    if (event.type === 'update') {
      this.trackChangedFiles(event.update);
    }
    this.post(event);
  }

  /**
   * Collect the files the agent actually edited, so the change bar reports a real
   * count instead of a guess. Structured diffs are the reliable signal: a tool that
   * only read a file never produces one.
   */
  private trackChangedFiles(update: unknown): void {
    if (!isRecord(update)) return;
    const kind = update.sessionUpdate;
    if (kind !== 'tool_call' && kind !== 'tool_call_update') return;
    if (!Array.isArray(update.content)) return;
    let added = false;
    for (const item of update.content) {
      if (!isRecord(item) || item.type !== 'diff' || typeof item.path !== 'string') continue;
      const relative = toWorkspaceRelative(item.path);
      if (relative && !this.changedFiles.has(relative)) {
        this.changedFiles.add(relative);
        added = true;
      }
    }
    if (added) {
      this.postChanges();
    }
  }

  private postChanges(): void {
    this.post({ type: 'changes', files: [...this.changedFiles].slice(0, 200) });
  }

  private setRouting(provider: string, model: string): void {
    if (!isKnownRouting(provider, model)) {
      this.reportError(new Error(`Unknown Echo model routing: ${provider} / ${model}`));
      return;
    }
    this.client.setRouting({ provider, model });
  }

  /**
   * Tabs are the sessions the user has open in the panel, which is deliberately not
   * the same as the sessions persisted on disk. Listing every persisted session made
   * old runs reappear as tabs that could not be dismissed, because closing one only
   * removed it from a list that was rebuilt from disk on the next refresh.
   */
  private readOpenTabs(): string[] {
    const stored = this.context.workspaceState.get<unknown>(openTabsKey);
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === 'string').slice(0, 20)
      : [];
  }

  private async writeOpenTabs(tabs: string[]): Promise<void> {
    const unique = [...new Set(tabs)].slice(-20);
    await this.context.workspaceState.update(openTabsKey, unique);
  }

  private async trackOpenTab(sessionId: string): Promise<void> {
    const tabs = this.readOpenTabs();
    if (!tabs.includes(sessionId)) {
      await this.writeOpenTabs([...tabs, sessionId]);
    }
  }

  private async openSessionTab(sessionId: string): Promise<void> {
    if (sessionId === this.client.currentSession?.sessionId) return;
    try {
      await this.client.loadSession(sessionId);
      await this.trackOpenTab(sessionId);
      this.changedFiles.clear();
      this.postChanges();
    } catch (error) {
      this.reportError(error);
    }
    await this.postPanelState();
  }

  /**
   * Close a tab. The persisted session is left on disk so it stays reachable from
   * history; only the panel's open list changes.
   */
  private async closeSessionTab(sessionId: string): Promise<void> {
    const tabs = this.readOpenTabs().filter((id) => id !== sessionId);
    await this.writeOpenTabs(tabs);

    if (sessionId === this.client.currentSession?.sessionId) {
      const next = tabs[tabs.length - 1];
      if (next) {
        try {
          await this.client.loadSession(next);
          this.changedFiles.clear();
          this.postChanges();
        } catch {
          await this.newSession();
        }
      } else {
        // Closing the last tab leaves a fresh one, so the panel is never empty.
        await this.newSession();
      }
    }
    await this.postPanelState();
  }

  /** Push tabs, model list, account and control state into the panel. */
  private async postPanelState(): Promise<void> {
    const session = this.client.currentSession;
    const previews = this.readSessionPreviews();

    if (session) {
      await this.trackOpenTab(session.sessionId);
    }

    let titles = new Map<string, string | undefined>();
    try {
      for (const item of await this.client.listSessions()) {
        titles.set(item.sessionId, item.title);
      }
    } catch {
      titles = new Map();
    }

    const openTabs = this.readOpenTabs();
    const sessions = openTabs.map((sessionId) => ({
      sessionId,
      title: titles.get(sessionId),
      preview: previews[sessionId],
    }));

    const routing = this.client.currentRouting
      ?? (session?.provider && session?.model
        ? { provider: session.provider, model: session.model }
        : undefined);

    this.post({
      type: 'panelState',
      sessions,
      activeSessionId: session?.sessionId,
      models: listModelOptions(),
      routing,
      mode: session?.mode ?? 'default',
      autopilot: this.autopilot,
      effort: this.effortLevel,
      account: await this.account.getState(),
    });
  }

  /** History renders inside the panel, so it never pulls focus to a top quick pick. */
  private async postHistory(): Promise<void> {
    const previews = this.readSessionPreviews();
    const openTabs = new Set(this.readOpenTabs());
    try {
      const listed = await this.client.listSessions();
      this.post({
        type: 'history',
        sessions: listed.slice(0, 60).map((item) => ({
          sessionId: item.sessionId,
          title: item.title,
          preview: previews[item.sessionId],
          updatedAt: item.updatedAt,
          provider: item.provider,
          model: item.model,
          open: openTabs.has(item.sessionId),
        })),
      });
    } catch (error) {
      this.post({ type: 'history', sessions: [], error: describeError(error) });
    }
  }

  /** Turn composer chips into ACP content blocks alongside the active editor context. */
  private buildPromptContext(rawChips: unknown): EditorContext | undefined {
    const chips = Array.isArray(rawChips)
      ? rawChips.filter((chip): chip is ContextChip =>
          isRecord(chip) && typeof chip.text === 'string' && typeof chip.label === 'string')
      : [];
    const editor = collectEditorContext(false);
    if (chips.length === 0) {
      return editor;
    }

    const chipText = chips
      .map((chip) => `## ${chip.label}\n${chip.text}`)
      .join('\n\n')
      .slice(0, 120_000);
    const blocks: EchoContentBlock[] = [
      { type: 'text', text: `Attached context:\n\n${chipText}` },
      ...(editor?.blocks ?? []),
    ];
    const label = chips.map((chip) => chip.label).join(', ');
    return {
      displayText: [label, editor?.displayText].filter(Boolean).join(' · '),
      blocks,
    };
  }

  private async addContext(kind: ContextKind): Promise<void> {
    try {
      const chip = await this.collectContext(kind);
      if (chip) {
        this.post({ type: 'contextAdded', chip });
      }
    } catch (error) {
      this.reportError(error);
    }
  }

  private async collectContext(kind: ContextKind): Promise<ContextChip | undefined> {
    const root = vscode.workspace.workspaceFolders?.[0];
    switch (kind) {
      case 'openFiles': {
        const files = openWorkspaceFiles();
        if (files.length === 0) {
          void vscode.window.showInformationMessage('No workspace files are open.');
          return undefined;
        }
        return {
          kind,
          label: `Open files (${files.length})`,
          detail: files.join('\n'),
          text: files.map((file) => `- ${file}`).join('\n'),
        };
      }
      case 'diagnostics': {
        const lines = workspaceDiagnosticLines();
        if (lines.length === 0) {
          void vscode.window.showInformationMessage('No diagnostics reported in this workspace.');
          return undefined;
        }
        return {
          kind,
          label: `Diagnostics (${lines.length})`,
          text: lines.join('\n'),
        };
      }
      case 'gitDiff': {
        if (!root) return undefined;
        const diff = await readGitDiff(root.uri.fsPath);
        if (!diff) {
          void vscode.window.showInformationMessage('No uncommitted git changes were found.');
          return undefined;
        }
        return { kind, label: 'Git diff', text: diff };
      }
      case 'file': {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: true,
          canSelectFolders: false,
          openLabel: 'Attach',
          defaultUri: root?.uri,
        });
        const first = picked?.[0];
        if (!picked?.length || !first) return undefined;
        const parts: string[] = [];
        for (const uri of picked.slice(0, 10)) {
          const relative = vscode.workspace.asRelativePath(uri, false);
          const bytes = await vscode.workspace.fs.readFile(uri);
          parts.push(`### ${relative}\n${Buffer.from(bytes).toString('utf8').slice(0, 40_000)}`);
        }
        return {
          kind,
          label: picked.length === 1
            ? vscode.workspace.asRelativePath(first, false)
            : `${picked.length} files`,
          text: parts.join('\n\n'),
        };
      }
      case 'folder': {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          canSelectFolders: true,
          canSelectFiles: false,
          openLabel: 'Attach',
          defaultUri: root?.uri,
        });
        const folder = picked?.[0];
        if (!folder) return undefined;
        const relative = vscode.workspace.asRelativePath(folder, false);
        const listing = await listFolderEntries(folder);
        return {
          kind,
          label: `${relative}/`,
          text: `Folder ${relative} contains:\n${listing.join('\n')}`,
        };
      }
      case 'spec':
      case 'steering': {
        if (!root) return undefined;
        const directory = vscode.Uri.joinPath(root.uri, '.echoai', kind === 'spec' ? 'specs' : 'steering');
        const documents = await readMarkdownTree(directory);
        if (documents.length === 0) {
          void vscode.window.showInformationMessage(
            `No ${kind} documents found in .echoai/${kind === 'spec' ? 'specs' : 'steering'}.`,
          );
          return undefined;
        }
        return {
          kind,
          label: `${kind === 'spec' ? 'Spec' : 'Steering'} (${documents.length})`,
          text: documents.join('\n\n'),
        };
      }
      case 'mcp': {
        return {
          kind,
          label: 'MCP servers',
          text: 'Use the configured MCP servers and their tools for this request.',
        };
      }
      case 'terminal': {
        const terminal = vscode.window.activeTerminal;
        if (!terminal) {
          void vscode.window.showInformationMessage('No terminal is open.');
          return undefined;
        }
        // The extension API exposes no terminal buffer, so the agent is pointed at the
        // shell instead of being handed output that cannot be read.
        return {
          kind,
          label: `Terminal: ${terminal.name}`,
          text: `The active terminal is "${terminal.name}". Re-run any command you need with the shell tool to read its output.`,
        };
      }
    }
  }

  private async viewChanges(): Promise<void> {
    if (this.changedFiles.size === 0) return;
    await vscode.commands.executeCommand('workbench.view.scm');
  }

  private async revertChanges(): Promise<void> {
    const files = [...this.changedFiles];
    if (files.length === 0) return;
    const confirmation = await vscode.window.showWarningMessage(
      `Discard Echo's edits to ${files.length} file${files.length === 1 ? '' : 's'}?`,
      { modal: true, detail: files.slice(0, 20).join('\n') },
      'Discard changes',
    );
    if (confirmation !== 'Discard changes') return;

    const root = vscode.workspace.workspaceFolders?.[0];
    if (!root) return;
    try {
      // Restore from git rather than reconstructing content, so the result matches the
      // last commit exactly. Paths are passed as argv entries, never interpolated.
      await execFileAsync('git', ['checkout', '--', ...files], {
        cwd: root.uri.fsPath,
        timeout: 30_000,
      });
      this.changedFiles.clear();
      this.postChanges();
      void vscode.window.showInformationMessage('Echo reverted its edits from git.');
    } catch (error) {
      this.reportError(
        new Error(
          `Could not revert with git: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  private async openLocation(toolPath: string, line?: number): Promise<void> {
    try {
      if (!toolPath || toolPath.length > MAX_TOOL_PATH_CHARACTERS) {
        throw new Error('Echo AI tool location has an invalid path.');
      }
      const uri = resolveWorkspaceToolUri(toolPath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, { preview: true });
      if (line !== undefined && Number.isFinite(line)) {
        const targetLine = Math.max(0, Math.min(document.lineCount - 1, Math.floor(line) - 1));
        const position = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      }
    } catch (error) {
      this.reportError(error);
    }
  }

  private async openDiff(toolPath: string, oldText: string, newText: string): Promise<void> {
    try {
      if (!toolPath || toolPath.length > MAX_TOOL_PATH_CHARACTERS) {
        throw new Error('Echo AI diff has an invalid path.');
      }
      if (oldText.length > MAX_DIFF_CHARACTERS || newText.length > MAX_DIFF_CHARACTERS) {
        throw new Error(`Echo AI diff sides are limited to ${MAX_DIFF_CHARACTERS.toLocaleString()} characters.`);
      }
      const target = resolveWorkspaceToolUri(toolPath);
      const fileName = path.basename(target.fsPath) || 'change';
      const id = randomUUID();
      const before = vscode.Uri.from({
        scheme: 'echoai-diff',
        authority: 'before',
        path: `/${fileName}`,
        query: id,
      });
      const after = vscode.Uri.from({
        scheme: 'echoai-diff',
        authority: 'after',
        path: `/${fileName}`,
        query: id,
      });
      this.diffDocuments.set(before, oldText);
      this.diffDocuments.set(after, newText);
      await vscode.commands.executeCommand('vscode.diff', before, after, `Echo AI: ${toolPath}`);
    } catch (error) {
      this.reportError(error);
    }
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.post({ type: 'error', message });
    void vscode.window.showErrorMessage(`Echo AI: ${message}`, 'Open Output').then((choice) => {
      if (choice === 'Open Output') {
        void vscode.commands.executeCommand('workbench.action.output.toggleOutput');
      }
    });
  }

  private post(message: unknown): void {
    void this.view?.webview.postMessage(message).then(undefined, (error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Echo AI webview post failed: ${detail}`);
    });
  }
}

interface SessionQuickPickItem extends vscode.QuickPickItem {
  sessionId: string;
}

function toSessionQuickPickItem(session: EchoSessionListItem, active: boolean): SessionQuickPickItem {
  const routing = [session.provider, session.model].filter(Boolean).join(' / ');
  const updated = session.updatedAt ? formatSessionDate(session.updatedAt) : undefined;
  return {
    sessionId: session.sessionId,
    label: `${active ? '$(check) ' : '$(comment-discussion) '}${session.title || 'Echo AI Session'}`,
    description: routing || undefined,
    detail: [updated, session.sessionId].filter(Boolean).join(' · '),
  };
}

function formatSessionDate(value: string): string | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : undefined;
}

function collectEditorContext(requireSelection: boolean): EditorContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || (requireSelection && editor.selection.isEmpty)) {
    return undefined;
  }

  const configuration = vscode.workspace.getConfiguration('echoAI');
  const configuredMaximum = configuration.get<number>('maxSelectionCharacters', 24000);
  const maximum = Number.isFinite(configuredMaximum)
    ? Math.max(1_000, Math.min(100_000, Math.floor(configuredMaximum)))
    : 24_000;
  const document = editor.document;
  const range = !editor.selection.isEmpty
    ? editor.selection
    : editor.visibleRanges[0] ?? new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
  const contextText = document.getText(range).slice(0, maximum);
  const file = vscode.workspace.asRelativePath(document.uri, false);
  const startLine = range.start.line + 1;
  const endLine = range.end.line + 1;
  const scope = editor.selection.isEmpty ? 'visible range' : 'selection';
  const label = `${file}:${startLine}-${endLine}`;

  const openFiles = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .map((tab) => tabInputUri(tab.input))
    .filter((uri): uri is vscode.Uri => Boolean(uri && uri.scheme === 'file' && vscode.workspace.getWorkspaceFolder(uri)))
    .map((uri) => vscode.workspace.asRelativePath(uri, false))
    .filter((candidate, index, values) => values.indexOf(candidate) === index)
    .slice(0, 20);
  const diagnostics = vscode.languages.getDiagnostics(document.uri).slice(0, 20);
  const diagnosticLines = diagnostics.map((diagnostic) => {
    const severity = diagnosticSeverityName(diagnostic.severity);
    return `- ${file}:${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1} [${severity}] ${diagnostic.message.slice(0, 1_000)}`;
  });
  const resourceUri = document.uri.with({ fragment: `L${startLine}-L${endLine}` }).toString();
  const metadata = [
    `Active editor: ${label} (${scope}, language: ${document.languageId})`,
    `Open workspace files (${openFiles.length}): ${openFiles.join(', ') || 'none'}`,
    diagnostics.length > 0
      ? `Active-file diagnostics (${diagnostics.length}):\n${diagnosticLines.join('\n')}`
      : 'Active-file diagnostics: none',
  ].join('\n').slice(0, 16_000);

  return {
    displayText: `${label} · ${scope} · ${diagnostics.length} diagnostic${diagnostics.length === 1 ? '' : 's'}`,
    blocks: [
      {
        type: 'text',
        text: metadata,
      },
      {
        type: 'resource',
        resource: {
          uri: resourceUri,
          mimeType: 'text/plain',
          text: contextText,
        },
      },
    ],
  };
}

function tabInputUri(input: unknown): vscode.Uri | undefined {
  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return input.modified;
  }
  return undefined;
}

function diagnosticSeverityName(severity: vscode.DiagnosticSeverity): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return 'error';
    case vscode.DiagnosticSeverity.Warning:
      return 'warning';
    case vscode.DiagnosticSeverity.Information:
      return 'information';
    case vscode.DiagnosticSeverity.Hint:
      return 'hint';
  }
}

function resolveWorkspaceToolUri(toolPath: string): vscode.Uri {
  const roots = vscode.workspace.workspaceFolders?.map((folder) => path.resolve(folder.uri.fsPath)) ?? [];
  if (roots.length === 0) {
    throw new Error('Open a workspace before navigating to tool results.');
  }

  const candidates = path.isAbsolute(toolPath)
    ? [path.resolve(toolPath)]
    : roots.map((root) => path.resolve(root, toolPath));
  for (const candidate of candidates) {
    for (const root of roots) {
      if (!isPathInside(candidate, root)) continue;
      const canonicalRoot = fs.realpathSync.native(root);
      const canonicalCandidate = canonicalizeFromExistingAncestor(candidate);
      if (isPathInside(canonicalCandidate, canonicalRoot)) {
        return vscode.Uri.file(candidate);
      }
    }
  }
  throw new Error(`Echo AI tool location resolves outside the open workspace: ${toolPath}`);
}

function canonicalizeFromExistingAncestor(candidate: string): string {
  let existing = candidate;
  const missingSegments: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      throw new Error(`No existing ancestor for ${candidate}`);
    }
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync.native(existing), ...missingSegments);
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Normalize a tool-reported path to a workspace-relative one, or drop it if outside. */
function toWorkspaceRelative(candidate: string): string | undefined {
  try {
    const uri = resolveWorkspaceToolUri(candidate);
    return vscode.workspace.asRelativePath(uri, false);
  } catch {
    return undefined;
  }
}

function openWorkspaceFiles(): string[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .map((tab) => tabInputUri(tab.input))
    .filter((uri): uri is vscode.Uri =>
      Boolean(uri && uri.scheme === 'file' && vscode.workspace.getWorkspaceFolder(uri)))
    .map((uri) => vscode.workspace.asRelativePath(uri, false))
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 60);
}

function workspaceDiagnosticLines(): string[] {
  const lines: string[] = [];
  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    if (uri.scheme !== 'file' || !vscode.workspace.getWorkspaceFolder(uri)) continue;
    const relative = vscode.workspace.asRelativePath(uri, false);
    for (const diagnostic of diagnostics.slice(0, 20)) {
      lines.push(
        `- ${relative}:${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1} ` +
        `[${diagnosticSeverityName(diagnostic.severity)}] ${diagnostic.message.slice(0, 600)}`,
      );
      if (lines.length >= 200) return lines;
    }
  }
  return lines;
}

async function readGitDiff(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--stat', 'HEAD'], { cwd, timeout: 20_000, maxBuffer: 4_000_000 });
    const { stdout: patch } = await execFileAsync('git', ['diff', 'HEAD'], { cwd, timeout: 20_000, maxBuffer: 8_000_000 });
    const combined = `${stdout.trim()}\n\n${patch}`.trim();
    return combined.length > 0 ? combined.slice(0, 120_000) : undefined;
  } catch {
    return undefined;
  }
}

/** `vscode.workspace.fs` returns Thenables, which have no `.catch`. */
async function tryReadDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return [];
  }
}

async function tryReadFile(uri: vscode.Uri): Promise<Uint8Array | undefined> {
  try {
    return await vscode.workspace.fs.readFile(uri);
  } catch {
    return undefined;
  }
}

async function listFolderEntries(folder: vscode.Uri): Promise<string[]> {
  const out: string[] = [];
  const walk = async (directory: vscode.Uri, depth: number): Promise<void> => {
    if (depth > 2 || out.length >= 200) return;
    const entries = await tryReadDirectory(directory);
    for (const [name, kind] of entries) {
      if (name.startsWith('.') || name === 'node_modules' || out.length >= 200) continue;
      const child = vscode.Uri.joinPath(directory, name);
      out.push(vscode.workspace.asRelativePath(child, false) + (kind === vscode.FileType.Directory ? '/' : ''));
      if (kind === vscode.FileType.Directory) {
        await walk(child, depth + 1);
      }
    }
  };
  await walk(folder, 0);
  return out;
}

async function readMarkdownTree(directory: vscode.Uri): Promise<string[]> {
  const entries = await tryReadDirectory(directory);
  const documents: string[] = [];
  for (const [name, kind] of entries) {
    if (documents.length >= 12) break;
    const child = vscode.Uri.joinPath(directory, name);
    if (kind === vscode.FileType.Directory) {
      documents.push(...(await readMarkdownTree(child)));
      continue;
    }
    if (!name.endsWith('.md')) continue;
    const bytes = await tryReadFile(child);
    if (!bytes) continue;
    const relative = vscode.workspace.asRelativePath(child, false);
    documents.push(`### ${relative}\n${Buffer.from(bytes).toString('utf8').slice(0, 20_000)}`);
  }
  return documents;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
