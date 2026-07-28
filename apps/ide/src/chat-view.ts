import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import {
  EchoAcpClient,
  type EchoAcpEvent,
  type EchoContentBlock,
  type EchoSessionListItem,
} from './acp-client.js';

interface EditorContext {
  displayText: string;
  blocks: EchoContentBlock[];
}

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

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly client: EchoAcpClient,
  ) {
    this.disposables.push(
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
    view.webview.html = renderWebview(view.webview);
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
      case 'send':
        if (typeof message.text === 'string') {
          await this.sendPrompt(
            message.text,
            message.includeContext === true ? collectEditorContext(false) : undefined,
          );
        }
        break;
      case 'newSession':
        await this.newSession();
        break;
      case 'showSessions':
        await this.showSessionPicker();
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
    this.post(event);
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

function renderWebview(webview: vscode.Webview): string {
  const nonce = randomBytes(16).toString('base64');
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; height: 100vh; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); }
    button, select, textarea { font: inherit; }
    .shell { display: grid; grid-template-rows: auto 1fr auto; height: 100vh; }
    .topbar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 8px; min-height: 48px; padding: 7px 10px; border-bottom: 1px solid var(--vscode-panel-border); }
    .mark { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 7px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 700; }
    .identity { min-width: 0; }
    .title { font-size: 12px; font-weight: 650; }
    .status, .session-meta { overflow: hidden; color: var(--vscode-descriptionForeground); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .mode { width: 72px; padding: 3px 4px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); border-radius: 4px; font-size: 11px; }
    .icon-button { padding: 3px 5px; color: var(--vscode-foreground); background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; font-size: 11px; }
    .icon-button:hover { background: var(--vscode-toolbar-hoverBackground); }
    .conversation { overflow-y: auto; padding: 12px 10px 18px; }
    .empty { display: grid; place-items: center; min-height: 65%; padding: 28px 12px; color: var(--vscode-descriptionForeground); text-align: center; line-height: 1.5; }
    .empty strong { display: block; margin-bottom: 8px; color: var(--vscode-foreground); font-size: 15px; }
    .message { margin: 0 0 12px; }
    .message-label { margin-bottom: 4px; color: var(--vscode-descriptionForeground); font-size: 10px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
    .bubble { padding: 9px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
    .user .bubble { background: var(--vscode-input-background); }
    .assistant .bubble { border-color: transparent; background: transparent; padding-left: 2px; padding-right: 2px; }
    .context { margin-top: 5px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .tool { margin: 8px 0 12px; padding: 8px 9px; border-left: 2px solid var(--vscode-charts-blue); background: var(--vscode-textBlockQuote-background); border-radius: 3px; }
    .tool.failed { border-left-color: var(--vscode-errorForeground); }
    .tool-head { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; font-weight: 600; }
    .tool-state { color: var(--vscode-descriptionForeground); font-weight: 400; }
    .tool-section { margin-top: 7px; }
    .tool-caption { margin-bottom: 3px; color: var(--vscode-descriptionForeground); font-size: 9px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; }
    .tool-output, .tool-input { max-height: 220px; overflow: auto; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .tool-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
    .tool-link { padding: 2px 6px; color: var(--vscode-textLink-foreground); background: transparent; border: 1px solid var(--vscode-panel-border); border-radius: 3px; cursor: pointer; font-size: 10px; }
    .diff-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; padding: 5px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .plan { margin: 8px 0 12px; padding: 8px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; }
    .plan-item { margin: 5px 0; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .plan-item.done { text-decoration: line-through; opacity: .75; }
    .run-summary { margin: 8px 0 12px; color: var(--vscode-descriptionForeground); font-size: 10px; text-align: right; }
    .error { margin: 8px 0 12px; padding: 8px 10px; color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); border-radius: 6px; white-space: pre-wrap; }
    .composer { padding: 9px 10px 10px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); }
    .input-wrap { border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 8px; background: var(--vscode-input-background); }
    textarea { display: block; width: 100%; min-height: 64px; max-height: 180px; resize: vertical; padding: 9px 10px 5px; color: var(--vscode-input-foreground); background: transparent; border: 0; outline: none; }
    .actions { display: flex; align-items: center; gap: 8px; padding: 4px 6px 6px; }
    .context-toggle { display: flex; align-items: center; gap: 5px; min-width: 0; flex: 1; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .context-toggle input { margin: 0; }
    .button { padding: 4px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 4px; cursor: pointer; }
    .button:hover { background: var(--vscode-button-hoverBackground); }
    .button:disabled, .mode:disabled { cursor: default; opacity: .55; }
    .link { padding: 2px 0; color: var(--vscode-textLink-foreground); background: transparent; border: 0; cursor: pointer; font-size: 11px; }
    .empty-links { display: flex; justify-content: center; gap: 10px; margin-top: 8px; }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="mark">E</div>
      <div class="identity">
        <div class="title">Echo AI</div>
        <div class="status" id="status">Stopped</div>
        <div class="session-meta" id="sessionMeta"></div>
      </div>
      <button class="icon-button" id="sessions" title="Saved sessions" aria-label="Saved sessions">History</button>
      <select class="mode" id="mode" aria-label="Agent mode"><option value="default">Build</option><option value="plan">Plan</option></select>
    </header>
    <section class="conversation" id="conversation" aria-live="polite"></section>
    <footer class="composer">
      <div class="input-wrap">
        <textarea id="prompt" aria-label="Message Echo AI" placeholder="Ask Echo AI to build, fix, or explain…"></textarea>
        <div class="actions">
          <label class="context-toggle" title="Attach active editor content, open files, and diagnostics"><input id="includeContext" type="checkbox" checked> editor context</label>
          <button class="link" id="cancel" hidden>Cancel</button>
          <button class="button" id="send">Send</button>
        </div>
      </div>
    </footer>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const conversation = document.getElementById('conversation');
    const status = document.getElementById('status');
    const sessionMeta = document.getElementById('sessionMeta');
    const prompt = document.getElementById('prompt');
    const send = document.getElementById('send');
    const cancel = document.getElementById('cancel');
    const mode = document.getElementById('mode');
    const includeContext = document.getElementById('includeContext');
    const saved = vscode.getState();
    const restored = isPlainObject(saved) && saved.version === 1 ? saved : {};
    const restoredEntries = Array.isArray(restored.entries)
      ? restored.entries.map(normalizeEntry).filter(Boolean).slice(-200)
      : [];
    const ui = {
      version: 1,
      entries: restoredEntries,
      tools: restoreTools(restored.tools, restoredEntries),
      sessionId: typeof restored.sessionId === 'string' ? restored.sessionId : undefined,
      session: normalizeSession(restored.session),
      activeAssistantId: typeof restored.activeAssistantId === 'string' ? restored.activeAssistantId : undefined,
    };
    const nodes = new Map();
    let activeAssistantId = ui.activeAssistantId;
    let persistTimer;

    function isPlainObject(value) {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }
    function normalizeEntry(value) {
      if (!isPlainObject(value) || typeof value.id !== 'string') return undefined;
      if (value.type === 'message' && (value.role === 'user' || value.role === 'assistant')) {
        return {
          type: 'message',
          id: value.id,
          role: value.role,
          text: typeof value.text === 'string' ? value.text.slice(-262144) : '',
          context: typeof value.context === 'string' ? value.context.slice(0, 4000) : undefined,
        };
      }
      if (value.type === 'tool') return { type: 'tool', id: value.id };
      if (value.type === 'plan') {
        const entries = Array.isArray(value.entries)
          ? value.entries.filter(isPlainObject).filter((entry) => typeof entry.content === 'string').slice(-100).map((entry) => ({
              content: entry.content.slice(0, 1000),
              status: entry.status === 'completed' || entry.status === 'in_progress' ? entry.status : 'pending',
            }))
          : [];
        return { type: 'plan', id: value.id, entries };
      }
      if (value.type === 'error' && typeof value.message === 'string') {
        return { type: 'error', id: value.id, message: value.message.slice(0, 16000) };
      }
      if (value.type === 'turn' && typeof value.text === 'string') {
        return { type: 'turn', id: value.id, text: value.text.slice(0, 1000) };
      }
      return undefined;
    }
    function restoreTools(value, entries) {
      const tools = Object.create(null);
      if (!isPlainObject(value)) return tools;
      const ids = entries.filter((entry) => entry.type === 'tool').map((entry) => entry.id).slice(-100);
      for (const id of ids) {
        if (Object.prototype.hasOwnProperty.call(value, id) && isPlainObject(value[id])) {
          tools[id] = normalizeToolUpdate({ ...value[id], toolCallId: id });
        }
      }
      return tools;
    }
    function normalizeSession(value) {
      if (!isPlainObject(value) || typeof value.sessionId !== 'string') return undefined;
      return {
        sessionId: value.sessionId,
        mode: value.mode === 'plan' ? 'plan' : 'default',
        title: typeof value.title === 'string' ? value.title.slice(0, 1000) : undefined,
        provider: typeof value.provider === 'string' ? value.provider.slice(0, 500) : undefined,
        model: typeof value.model === 'string' ? value.model.slice(0, 500) : undefined,
      };
    }

    function persist() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        ui.activeAssistantId = activeAssistantId;
        const entries = ui.entries.slice(-200);
        const retainedToolIds = new Set(entries.filter((entry) => entry && entry.type === 'tool').map((entry) => entry.id));
        const tools = Object.create(null);
        for (const id of Array.from(retainedToolIds).slice(-100)) {
          if (ui.tools[id]) tools[id] = { ...ui.tools[id] };
        }
        const snapshot = {
          version: 1,
          entries,
          tools,
          sessionId: ui.sessionId,
          session: ui.session,
          activeAssistantId,
        };
        let serialized = JSON.stringify(snapshot);
        while (serialized.length > 262144 && snapshot.entries.length > 20) {
          const removed = snapshot.entries.shift();
          if (removed && removed.type === 'tool') delete snapshot.tools[removed.id];
          serialized = JSON.stringify(snapshot);
        }
        if (serialized.length > 262144) {
          for (const tool of Object.values(snapshot.tools)) {
            if (!tool || typeof tool !== 'object') continue;
            delete tool.rawOutput;
            delete tool.content;
          }
          serialized = JSON.stringify(snapshot);
        }
        vscode.setState(serialized.length <= 262144 ? JSON.parse(serialized) : {
          version: 1,
          entries: snapshot.entries.slice(-20).map((entry) => {
            if (entry.type === 'message') return { ...entry, text: String(entry.text || '').slice(-4000) };
            if (entry.type === 'plan') return {
              ...entry,
              entries: Array.isArray(entry.entries)
                ? entry.entries.slice(-20).map((item) => ({ ...item, content: String(item.content || '').slice(0, 500) }))
                : [],
            };
            if (entry.type === 'error') return { ...entry, message: String(entry.message || '').slice(0, 4000) };
            return entry;
          }),
          tools: {},
          sessionId: snapshot.sessionId,
          session: snapshot.session,
        });
      }, 80);
    }
    function makeEmpty() {
      const root = document.createElement('div');
      root.className = 'empty';
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = 'Build with Echo AI';
      content.append(title, document.createTextNode('Use the production EchoAI runtime for codebase work, edits, and review.'));
      const links = document.createElement('div');
      links.className = 'empty-links';
      for (const [label, type] of [['Configure', 'configureRuntime'], ['MCP', 'manageMcp'], ['Login', 'login']]) {
        const button = document.createElement('button');
        button.className = 'link';
        button.textContent = label;
        button.addEventListener('click', () => vscode.postMessage({ type }));
        links.append(button);
      }
      content.append(links);
      root.append(content);
      return root;
    }
    function ensureEmpty() {
      if (ui.entries.length === 0 && conversation.childElementCount === 0) conversation.append(makeEmpty());
    }
    function clearEmpty() {
      const empty = conversation.querySelector('.empty');
      if (empty) empty.remove();
    }
    function scrollToEnd() { conversation.scrollTop = conversation.scrollHeight; }
    function appendEntry(entry) {
      ui.entries.push(entry);
      if (ui.entries.length > 300) {
        ui.entries.splice(0, ui.entries.length - 300);
        const retainedTools = new Set(ui.entries.filter((candidate) => candidate.type === 'tool').map((candidate) => candidate.id));
        for (const id of Object.keys(ui.tools)) {
          if (!retainedTools.has(id)) delete ui.tools[id];
        }
        nodes.clear();
        conversation.replaceChildren();
        for (const retained of ui.entries) renderEntry(retained);
      } else {
        renderEntry(entry);
      }
      persist();
      scrollToEnd();
    }
    function renderEntry(entry) {
      clearEmpty();
      if (entry.type === 'message') renderMessage(entry);
      if (entry.type === 'tool') renderTool(entry.id);
      if (entry.type === 'plan') renderPlan(entry);
      if (entry.type === 'error') renderError(entry);
      if (entry.type === 'turn') renderTurn(entry);
    }
    function renderMessage(entry) {
      const item = document.createElement('article');
      item.className = 'message ' + entry.role;
      const label = document.createElement('div');
      label.className = 'message-label';
      label.textContent = entry.role === 'user' ? 'You' : 'Echo AI';
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = entry.text || '';
      item.append(label, bubble);
      if (entry.context) {
        const contextNode = document.createElement('div');
        contextNode.className = 'context';
        contextNode.textContent = 'Attached: ' + entry.context;
        item.append(contextNode);
      }
      conversation.append(item);
      nodes.set(entry.id, bubble);
    }
    function boundMessageText(value) {
      const text = String(value || '');
      if (text.length <= 262144) return text;
      return text.slice(0, 196608) + '\\n… message truncated in IDE history …\\n' + text.slice(-32768);
    }
    function addMessage(role, text, context, messageId) {
      activeAssistantId = undefined;
      const entry = {
        type: 'message',
        id: messageId || crypto.randomUUID(),
        role,
        text: boundMessageText(text),
        context: typeof context === 'string' ? context.slice(0, 4000) : undefined,
      };
      appendEntry(entry);
      return entry.id;
    }
    function appendAssistant(text, messageId) {
      const targetId = typeof messageId === 'string' ? messageId : activeAssistantId;
      let entry = ui.entries.find((candidate) => candidate.type === 'message' && candidate.id === targetId);
      if (!entry) {
        const id = targetId || crypto.randomUUID();
        entry = { type: 'message', id, role: 'assistant', text: '' };
        activeAssistantId = id;
        appendEntry(entry);
      } else {
        activeAssistantId = entry.id;
      }
      entry.text = boundMessageText(String(entry.text || '') + String(text || ''));
      const bubble = nodes.get(entry.id);
      if (bubble) bubble.textContent = entry.text;
      persist();
      scrollToEnd();
    }
    function boundedValue(value, maxLength = 32000) {
      if (value === undefined || value === null) return value;
      if (typeof value === 'string') return value.slice(0, maxLength);
      try {
        const serialized = JSON.stringify(value);
        return serialized.length <= maxLength ? value : serialized.slice(0, maxLength) + '…';
      } catch {
        return String(value).slice(0, maxLength);
      }
    }
    function normalizeToolContent(value) {
      if (!Array.isArray(value)) return [];
      const content = [];
      for (const item of value.slice(-50)) {
        if (!isPlainObject(item)) continue;
        if (item.type === 'content' && isPlainObject(item.content) && item.content.type === 'text' && typeof item.content.text === 'string') {
          content.push({ type: 'content', content: { type: 'text', text: item.content.text.slice(0, 32000) } });
          continue;
        }
        if (item.type === 'diff' && typeof item.path === 'string' && typeof item.newText === 'string') {
          content.push({
            type: 'diff',
            path: item.path.slice(0, 4000),
            oldText: typeof item.oldText === 'string' ? item.oldText.slice(0, 128000) : undefined,
            newText: item.newText.slice(0, 128000),
          });
        }
      }
      return content;
    }
    function normalizeToolUpdate(update) {
      const normalized = { toolCallId: update.toolCallId };
      if (typeof update.title === 'string') normalized.title = update.title.slice(0, 1000);
      if (['pending', 'in_progress', 'completed', 'failed'].includes(update.status)) normalized.status = update.status;
      if (typeof update.kind === 'string') normalized.kind = update.kind.slice(0, 100);
      if (Object.prototype.hasOwnProperty.call(update, 'rawInput')) normalized.rawInput = boundedValue(update.rawInput);
      if (Object.prototype.hasOwnProperty.call(update, 'rawOutput')) normalized.rawOutput = boundedValue(update.rawOutput);
      if (update.content === null) normalized.content = null;
      else if (Array.isArray(update.content)) normalized.content = normalizeToolContent(update.content);
      if (update.locations === null) normalized.locations = null;
      else if (Array.isArray(update.locations)) {
        normalized.locations = update.locations.filter(isPlainObject).filter((location) => typeof location.path === 'string').slice(-100).map((location) => ({
          path: location.path.slice(0, 4000),
          line: typeof location.line === 'number' && Number.isFinite(location.line) ? Math.floor(location.line) : undefined,
        }));
      }
      return normalized;
    }
    function formatJson(value) {
      if (value === undefined || value === null) return '';
      try {
        const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        return text.length > 16000 ? text.slice(0, 16000) + '\\n… output truncated in card' : text;
      } catch { return String(value); }
    }
    function toolText(content) {
      return (content || [])
        .filter((entry) => entry && entry.type === 'content' && entry.content && entry.content.type === 'text')
        .map((entry) => entry.content.text)
        .filter(Boolean)
        .join('\\n');
    }
    function mergeTool(update) {
      const boundedUpdate = normalizeToolUpdate(update);
      const previous = ui.tools[boundedUpdate.toolCallId] || {};
      const next = { ...previous, ...boundedUpdate };
      for (const key of ['content', 'locations']) {
        if (boundedUpdate[key] === null) next[key] = [];
        else if (boundedUpdate[key] === undefined && previous[key] !== undefined) next[key] = previous[key];
      }
      ui.tools[boundedUpdate.toolCallId] = next;
      return next;
    }
    function upsertTool(update) {
      activeAssistantId = undefined;
      const exists = Boolean(ui.tools[update.toolCallId]);
      mergeTool(update);
      if (!exists) {
        appendEntry({ type: 'tool', id: update.toolCallId });
      } else {
        const old = nodes.get('tool:' + update.toolCallId);
        const replacement = buildTool(update.toolCallId);
        if (old && replacement) old.replaceWith(replacement);
        persist();
        scrollToEnd();
      }
    }
    function renderTool(id) {
      const card = buildTool(id);
      if (card) conversation.append(card);
    }
    function buildTool(id) {
      const tool = ui.tools[id];
      if (!tool) return undefined;
      const root = document.createElement('section');
      root.className = 'tool' + (tool.status === 'failed' ? ' failed' : '');
      nodes.set('tool:' + id, root);
      const head = document.createElement('div');
      head.className = 'tool-head';
      const title = document.createElement('span');
      title.textContent = tool.title || 'Tool';
      const state = document.createElement('span');
      state.className = 'tool-state';
      state.textContent = (tool.status || '').replace('_', ' ');
      head.append(title, state);
      root.append(head);

      const input = formatJson(tool.rawInput);
      if (input) root.append(makeToolSection('Input', input, 'tool-input'));
      const output = toolText(tool.content) || formatJson(tool.rawOutput);
      if (output) root.append(makeToolSection('Result', output, 'tool-output'));

      const locations = Array.isArray(tool.locations) ? tool.locations : [];
      if (locations.length) {
        const actions = document.createElement('div');
        actions.className = 'tool-actions';
        for (const location of locations) {
          if (!location || typeof location.path !== 'string') continue;
          const button = document.createElement('button');
          button.className = 'tool-link';
          button.textContent = location.path + (location.line ? ':' + location.line : '');
          button.addEventListener('click', () => vscode.postMessage({ type: 'openLocation', path: location.path, line: location.line }));
          actions.append(button);
        }
        root.append(actions);
      }

      for (const item of Array.isArray(tool.content) ? tool.content : []) {
        if (!item || item.type !== 'diff' || typeof item.path !== 'string' || typeof item.newText !== 'string') continue;
        const row = document.createElement('div');
        row.className = 'diff-row';
        const label = document.createElement('span');
        label.textContent = item.path;
        const button = document.createElement('button');
        button.className = 'tool-link';
        button.textContent = 'Open Diff';
        button.addEventListener('click', () => vscode.postMessage({
          type: 'openDiff', path: item.path, oldText: item.oldText, newText: item.newText,
        }));
        row.append(label, button);
        root.append(row);
      }
      return root;
    }
    function makeToolSection(captionText, value, className) {
      const section = document.createElement('div');
      section.className = 'tool-section';
      const caption = document.createElement('div');
      caption.className = 'tool-caption';
      caption.textContent = captionText;
      const body = document.createElement('div');
      body.className = className;
      body.textContent = value;
      section.append(caption, body);
      return section;
    }
    function showPlan(entries) {
      activeAssistantId = undefined;
      const previous = ui.entries.find((entry) => entry.type === 'plan');
      const normalized = normalizeEntry({
        type: 'plan',
        id: previous?.id || crypto.randomUUID(),
        entries,
      });
      const normalizedEntries = normalized ? normalized.entries : [];
      if (previous) {
        previous.entries = normalizedEntries;
        const old = nodes.get(previous.id);
        const replacement = buildPlan(previous);
        if (old) old.replaceWith(replacement);
        persist();
        return;
      }
      appendEntry(normalized || { type: 'plan', id: crypto.randomUUID(), entries: [] });
    }
    function renderPlan(entry) { conversation.append(buildPlan(entry)); }
    function buildPlan(entry) {
      const root = document.createElement('section');
      root.className = 'plan';
      nodes.set(entry.id, root);
      const title = document.createElement('div');
      title.className = 'message-label';
      title.textContent = 'Plan';
      root.append(title);
      for (const planEntry of entry.entries || []) {
        const item = document.createElement('div');
        item.className = 'plan-item' + (planEntry.status === 'completed' ? ' done' : '');
        item.textContent = (planEntry.status === 'completed' ? '✓ ' : planEntry.status === 'in_progress' ? '→ ' : '• ') + planEntry.content;
        root.append(item);
      }
      return root;
    }
    function showError(message) {
      appendEntry({ type: 'error', id: crypto.randomUUID(), message: String(message || '').slice(0, 16000) });
    }
    function renderError(entry) {
      const item = document.createElement('div');
      item.className = 'error';
      item.textContent = entry.message;
      conversation.append(item);
    }
    function showTurn(data) {
      const usage = data.usage;
      const tokens = usage && typeof usage.totalTokens === 'number'
        ? usage.totalTokens.toLocaleString() + ' tokens'
        : undefined;
      const reason = String(data.stopReason || 'end_turn').replaceAll('_', ' ');
      appendEntry({ type: 'turn', id: crypto.randomUUID(), text: [reason, tokens].filter(Boolean).join(' · ') });
    }
    function renderTurn(entry) {
      const item = document.createElement('div');
      item.className = 'run-summary';
      item.textContent = entry.text;
      conversation.append(item);
    }
    function setStatus(value, detail) {
      const labels = { stopped: 'Stopped', connecting: 'Connecting…', ready: 'Ready', running: 'Working…', error: 'Needs attention' };
      status.textContent = detail || labels[value] || value;
      const running = value === 'running';
      const unavailable = running || value === 'connecting';
      send.disabled = unavailable;
      mode.disabled = unavailable;
      cancel.hidden = !running;
    }
    function setSession(data) {
      const nextSession = normalizeSession(data);
      if (!nextSession) return;
      if (ui.sessionId && ui.sessionId !== nextSession.sessionId) resetConversation();
      ui.sessionId = nextSession.sessionId;
      ui.session = nextSession;
      mode.value = nextSession.mode;
      sessionMeta.textContent = [nextSession.title, nextSession.provider && nextSession.model ? nextSession.provider + ' / ' + nextSession.model : nextSession.provider || nextSession.model]
        .filter(Boolean).join(' · ');
      persist();
    }
    function resetConversation() {
      ui.entries = [];
      ui.tools = Object.create(null);
      activeAssistantId = undefined;
      nodes.clear();
      conversation.replaceChildren();
      ensureEmpty();
      persist();
    }
    function submit() {
      const text = prompt.value.trim();
      if (!text || send.disabled) return;
      prompt.value = '';
      vscode.postMessage({ type: 'send', text, includeContext: includeContext.checked });
    }

    send.addEventListener('click', submit);
    cancel.addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));
    mode.addEventListener('change', () => vscode.postMessage({ type: 'setMode', mode: mode.value }));
    document.getElementById('sessions').addEventListener('click', () => vscode.postMessage({ type: 'showSessions' }));
    prompt.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
    });

    conversation.replaceChildren();
    for (const entry of ui.entries) renderEntry(entry);
    ensureEmpty();
    if (ui.session) setSession(ui.session);
    scrollToEnd();

    window.addEventListener('message', ({ data }) => {
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      if (data.type === 'localUser' && typeof data.text === 'string') addMessage('user', data.text, typeof data.context === 'string' ? data.context : undefined);
      if (data.type === 'status' && typeof data.status === 'string') setStatus(data.status, typeof data.message === 'string' ? data.message : undefined);
      if (data.type === 'error' && typeof data.message === 'string') showError(data.message);
      if (data.type === 'session' && typeof data.sessionId === 'string') setSession(data);
      if (data.type === 'turn' && typeof data.stopReason === 'string') showTurn(data);
      if (data.type === 'reset') resetConversation();
      if (data.type !== 'update' || !data.update || typeof data.update !== 'object') return;
      const update = data.update;
      if (typeof update.sessionUpdate !== 'string') return;
      if (update.sessionUpdate === 'user_message_chunk' && update.content?.type === 'text' && typeof update.content.text === 'string') addMessage('user', update.content.text, undefined, update.messageId);
      if (update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text' && typeof update.content.text === 'string') appendAssistant(update.content.text, update.messageId);
      if (update.sessionUpdate === 'agent_thought_chunk' && update.content?.type === 'text' && typeof update.content.text === 'string') appendAssistant(update.content.text, update.messageId);
      if ((update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') && typeof update.toolCallId === 'string') upsertTool(update);
      if (update.sessionUpdate === 'plan' && Array.isArray(update.entries)) showPlan(update.entries);
      if (update.sessionUpdate === 'current_mode_update' && (update.currentModeId === 'default' || update.currentModeId === 'plan')) mode.value = update.currentModeId;
      if (update.sessionUpdate === 'usage_update' && typeof update.used === 'number' && typeof update.size === 'number') sessionMeta.textContent = 'Context: ' + update.used.toLocaleString() + ' / ' + update.size.toLocaleString();
    });
  </script>
</body>
</html>`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
