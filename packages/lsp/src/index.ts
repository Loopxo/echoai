import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  createMessageConnection,
  DefinitionRequest,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DocumentSymbolRequest,
  ExitNotification,
  HoverRequest,
  InitializedNotification,
  InitializeRequest,
  PublishDiagnosticsNotification,
  ReferencesRequest,
  ShutdownRequest,
  StreamMessageReader,
  StreamMessageWriter,
  WorkspaceSymbolRequest,
  type Diagnostic,
  type DocumentSymbol,
  type InitializeParams,
  type Location,
  type LocationLink,
  type MessageConnection,
  type Position,
  type PublishDiagnosticsParams,
  type SymbolInformation,
  type WorkspaceSymbol,
} from "vscode-languageserver-protocol/node.js";
import { URI } from "vscode-uri";

export type EchoLanguageId = "typescript" | "javascript" | "python" | "go" | "rust";

export interface LanguageServerDescriptor {
  id: EchoLanguageId;
  name: string;
  command: string;
  args: string[];
  versionArgs: string[];
  languages: EchoLanguageId[];
  extensions: string[];
  markers: string[];
  install: string;
}

export interface LanguageServerReadiness {
  id: EchoLanguageId;
  name: string;
  available: boolean;
  command: string;
  args: string[];
  install: string;
  reason?: string;
}

export interface LspRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface LspDiagnostic {
  uri: string;
  path: string;
  range: LspRange;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

export interface LspLocation {
  uri: string;
  path: string;
  range: LspRange;
}

export interface LspSymbol {
  name: string;
  kind: number;
  uri?: string;
  path?: string;
  range?: LspRange;
  selectionRange?: LspRange;
  containerName?: string;
}

export interface LspResult<T> {
  available: boolean;
  server?: string;
  reason?: string;
  data: T;
}

interface ActiveServer {
  descriptor: LanguageServerDescriptor;
  readiness: LanguageServerReadiness;
  child: ChildProcessWithoutNullStreams;
  connection: MessageConnection;
  diagnostics: Map<string, LspDiagnostic[]>;
  openDocuments: Map<string, number>;
  stderr: string;
  ready: Promise<void>;
  disposed: boolean;
}

interface OpenDocumentResult {
  server: ActiveServer;
  uri: string;
}

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);

export const languageServers: LanguageServerDescriptor[] = [
  {
    id: "typescript",
    name: "TypeScript/JavaScript",
    command: "typescript-language-server",
    args: ["--stdio"],
    versionArgs: ["--version"],
    languages: ["typescript", "javascript"],
    extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
    markers: ["package.json", "tsconfig.json", "jsconfig.json"],
    install: "pnpm add -D typescript typescript-language-server",
  },
  {
    id: "python",
    name: "Python",
    command: "pyright-langserver",
    args: ["--stdio"],
    versionArgs: ["--version"],
    languages: ["python"],
    extensions: [".py", ".pyi"],
    markers: ["pyproject.toml", "setup.py", "pytest.ini", "requirements.txt"],
    install: "python3 -m pip install pyright",
  },
  {
    id: "go",
    name: "Go",
    command: "gopls",
    args: [],
    versionArgs: ["version"],
    languages: ["go"],
    extensions: [".go"],
    markers: ["go.mod"],
    install: "go install golang.org/x/tools/gopls@latest",
  },
  {
    id: "rust",
    name: "Rust",
    command: "rust-analyzer",
    args: [],
    versionArgs: ["--version"],
    languages: ["rust"],
    extensions: [".rs"],
    markers: ["Cargo.toml"],
    install: "rustup component add rust-analyzer",
  },
];

export function pathToFileUri(filePath: string): string {
  return URI.file(path.resolve(filePath)).toString();
}

export function fileUriToPath(uri: string): string {
  return URI.parse(uri).fsPath;
}

export function positionFromLineColumn(line: number, column: number): Position {
  return {
    line: Math.max(0, Math.floor(line) - 1),
    character: Math.max(0, Math.floor(column) - 1),
  };
}

export function detectLanguageForPath(filePath: string): EchoLanguageId | null {
  const ext = path.extname(filePath).toLowerCase();
  for (const descriptor of languageServers) {
    if (descriptor.extensions.includes(ext)) {
      if (descriptor.id === "typescript" && [".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
        return "javascript";
      }
      return descriptor.id;
    }
  }
  return null;
}

export async function detectLanguageServerReadiness(root: string): Promise<LanguageServerReadiness[]> {
  return Promise.all(languageServers.map((descriptor) => resolveLanguageServer(root, descriptor)));
}

export async function shutdownAllLspManagers(): Promise<void> {
  const managers = Array.from(sharedManagers.values());
  sharedManagers.clear();
  await Promise.all(managers.map((manager) => manager.dispose()));
}

const sharedManagers = new Map<string, LspManager>();

export function getSharedLspManager(root: string): LspManager {
  const normalized = path.resolve(root);
  const existing = sharedManagers.get(normalized);
  if (existing) return existing;
  const manager = new LspManager(normalized);
  sharedManagers.set(normalized, manager);
  return manager;
}

export class LspManager {
  private readonly root: string;
  private readonly servers = new Map<EchoLanguageId, ActiveServer>();

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async getDiagnostics(options: { path?: string; timeoutMs?: number; maxFiles?: number } = {}): Promise<LspResult<LspDiagnostic[]>> {
    const timeoutMs = options.timeoutMs ?? 1_500;
    if (options.path) {
      const opened = await this.openDocument(options.path);
      if (!opened.available) {
        return { available: false, reason: opened.reason, data: [] };
      }
      await delay(timeoutMs);
      const diagnostics = opened.server.diagnostics.get(opened.uri) ?? [];
      return {
        available: true,
        server: opened.server.descriptor.name,
        data: diagnostics,
      };
    }

    const openedServers = new Set<ActiveServer>();
    const files = await discoverWorkspaceFiles(this.root, options.maxFiles ?? 80);
    for (const filePath of files) {
      const opened = await this.openDocument(filePath);
      if (opened.available) openedServers.add(opened.server);
    }

    if (openedServers.size === 0) {
      const readiness = await detectLanguageServerReadiness(this.root);
      const missing = readiness.filter((entry) => !entry.available);
      return {
        available: false,
        reason: missing.length > 0
          ? missing.map((entry) => `${entry.name}: ${entry.reason ?? "not available"}`).join("; ")
          : "No supported language server found for this workspace",
        data: [],
      };
    }

    await delay(timeoutMs);
    const diagnostics = Array.from(openedServers)
      .flatMap((server) => Array.from(server.diagnostics.values()).flat());

    return {
      available: true,
      server: Array.from(openedServers).map((server) => server.descriptor.name).join(", "),
      data: diagnostics,
    };
  }

  async gotoDefinition(filePath: string, position: Position, timeoutMs = 8_000): Promise<LspResult<LspLocation[]>> {
    const opened = await this.openDocument(filePath);
    if (!opened.available) return { available: false, reason: opened.reason, data: [] };
    const result = await withTimeout(
      opened.server.connection.sendRequest(DefinitionRequest.type, {
        textDocument: { uri: opened.uri },
        position,
      }),
      timeoutMs,
      "definition request timed out"
    ) as Location | Location[] | LocationLink[] | null;
    return {
      available: true,
      server: opened.server.descriptor.name,
      data: normalizeLocations(result),
    };
  }

  async findReferences(filePath: string, position: Position, includeDeclaration = true, timeoutMs = 8_000): Promise<LspResult<LspLocation[]>> {
    const opened = await this.openDocument(filePath);
    if (!opened.available) return { available: false, reason: opened.reason, data: [] };
    const result = await withTimeout(
      opened.server.connection.sendRequest(ReferencesRequest.type, {
        textDocument: { uri: opened.uri },
        position,
        context: { includeDeclaration },
      }),
      timeoutMs,
      "references request timed out"
    ) as Location[] | null;
    return {
      available: true,
      server: opened.server.descriptor.name,
      data: normalizeLocations(result),
    };
  }

  async documentSymbols(filePath: string, timeoutMs = 8_000): Promise<LspResult<LspSymbol[]>> {
    const opened = await this.openDocument(filePath);
    if (!opened.available) return { available: false, reason: opened.reason, data: [] };
    const result = await withTimeout(
      opened.server.connection.sendRequest(DocumentSymbolRequest.type, {
        textDocument: { uri: opened.uri },
      }),
      timeoutMs,
      "document symbol request timed out"
    );
    return {
      available: true,
      server: opened.server.descriptor.name,
      data: normalizeDocumentSymbols(result, opened.uri),
    };
  }

  async workspaceSymbols(query: string, timeoutMs = 8_000): Promise<LspResult<LspSymbol[]>> {
    const servers = await this.getProjectServers();
    if (servers.length === 0) {
      return { available: false, reason: "No supported language server is available for this workspace", data: [] };
    }

    const results = await Promise.all(servers.map(async (server) => {
      const symbols = await withTimeout(
        server.connection.sendRequest(WorkspaceSymbolRequest.type, { query }),
        timeoutMs,
        "workspace symbol request timed out"
      ) as SymbolInformation[] | WorkspaceSymbol[] | null;
      return normalizeWorkspaceSymbols(symbols);
    }));

    return {
      available: true,
      server: servers.map((server) => server.descriptor.name).join(", "),
      data: results.flat(),
    };
  }

  async hover(filePath: string, position: Position, timeoutMs = 8_000): Promise<LspResult<unknown | null>> {
    const opened = await this.openDocument(filePath);
    if (!opened.available) return { available: false, reason: opened.reason, data: null };
    const result = await withTimeout(
      opened.server.connection.sendRequest(HoverRequest.type, {
        textDocument: { uri: opened.uri },
        position,
      }),
      timeoutMs,
      "hover request timed out"
    );
    return {
      available: true,
      server: opened.server.descriptor.name,
      data: result,
    };
  }

  async dispose(): Promise<void> {
    const servers = Array.from(this.servers.values());
    this.servers.clear();
    await Promise.all(servers.map(disposeServer));
  }

  private async openDocument(targetPath: string): Promise<
    | ({ available: true } & OpenDocumentResult)
    | { available: false; reason: string }
  > {
    const absolutePath = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(this.root, targetPath);
    const languageId = detectLanguageForPath(absolutePath);
    if (!languageId) {
      return { available: false, reason: `No supported language for ${path.relative(this.root, absolutePath)}` };
    }
    const descriptor = languageServers.find((server) => server.languages.includes(languageId));
    if (!descriptor) {
      return { available: false, reason: `No language server descriptor for ${languageId}` };
    }

    const server = await this.getServer(descriptor);
    if (!server.available) return server;

    const text = await readFile(absolutePath, "utf8");
    const uri = pathToFileUri(absolutePath);
    const existingVersion = server.server.openDocuments.get(uri);
    if (existingVersion === undefined) {
      server.server.openDocuments.set(uri, 1);
      server.server.connection.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          uri,
          languageId: toLspLanguageId(languageId),
          version: 1,
          text,
        },
      });
    } else {
      const version = existingVersion + 1;
      server.server.openDocuments.set(uri, version);
      server.server.connection.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });
    }
    return { available: true, server: server.server, uri };
  }

  private async getProjectServers(): Promise<ActiveServer[]> {
    const candidates: ActiveServer[] = [];
    for (const descriptor of languageServers) {
      if (!await hasAnyMarker(this.root, descriptor.markers)) continue;
      const server = await this.getServer(descriptor);
      if (server.available) candidates.push(server.server);
    }
    return candidates;
  }

  private async getServer(descriptor: LanguageServerDescriptor): Promise<
    | { available: true; server: ActiveServer }
    | { available: false; reason: string }
  > {
    const existing = this.servers.get(descriptor.id);
    if (existing && !existing.disposed) {
      await existing.ready;
      return { available: true, server: existing };
    }

    const readiness = await resolveLanguageServer(this.root, descriptor);
    if (!readiness.available) {
      return { available: false, reason: readiness.reason ?? `${descriptor.name} language server is not available` };
    }

    const child = spawn(readiness.command, readiness.args, {
      cwd: this.root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const connection = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin)
    );
    const active: ActiveServer = {
      descriptor,
      readiness,
      child,
      connection,
      diagnostics: new Map(),
      openDocuments: new Map(),
      stderr: "",
      disposed: false,
      ready: Promise.resolve(),
    };

    child.stderr.on("data", (chunk: Buffer) => {
      active.stderr = compact(`${active.stderr}${chunk.toString()}`, 8_000);
    });
    child.on("exit", () => {
      active.disposed = true;
      this.servers.delete(descriptor.id);
    });
    connection.onNotification(PublishDiagnosticsNotification.type, (params: PublishDiagnosticsParams) => {
      active.diagnostics.set(params.uri, params.diagnostics.map((diagnostic) => normalizeDiagnostic(params.uri, diagnostic)));
    });
    connection.listen();

    active.ready = initializeServer(active, this.root);
    this.servers.set(descriptor.id, active);
    await active.ready;
    return { available: true, server: active };
  }
}

async function initializeServer(server: ActiveServer, root: string): Promise<void> {
  const rootUri = pathToFileUri(root);
  const params: InitializeParams = {
    processId: process.pid,
    rootUri,
    capabilities: {
      textDocument: {
        synchronization: {
          didSave: true,
          dynamicRegistration: false,
        },
        definition: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        references: {
          dynamicRegistration: false,
        },
        documentSymbol: {
          dynamicRegistration: false,
          hierarchicalDocumentSymbolSupport: true,
        },
        publishDiagnostics: {
          relatedInformation: true,
        },
        hover: {
          dynamicRegistration: false,
          contentFormat: ["markdown", "plaintext"],
        },
      },
      workspace: {
        workspaceFolders: true,
        configuration: true,
        symbol: {
          dynamicRegistration: false,
        },
      },
    },
    workspaceFolders: [{ uri: rootUri, name: path.basename(root) || root }],
  };

  await server.connection.sendRequest(InitializeRequest.type, params);
  server.connection.sendNotification(InitializedNotification.type, {});
}

async function disposeServer(server: ActiveServer): Promise<void> {
  if (server.disposed) return;
  server.disposed = true;
  try {
    await withTimeout(server.connection.sendRequest(ShutdownRequest.type), 2_000, "shutdown timed out");
    server.connection.sendNotification(ExitNotification.type);
  } catch {
    server.child.kill("SIGTERM");
  }
  server.connection.dispose();
  if (!server.child.killed) {
    server.child.kill("SIGTERM");
  }
}

async function resolveLanguageServer(root: string, descriptor: LanguageServerDescriptor): Promise<LanguageServerReadiness> {
  const localCommand = path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${descriptor.command}.cmd` : descriptor.command);
  if (await isExecutable(localCommand)) {
    return {
      id: descriptor.id,
      name: descriptor.name,
      available: true,
      command: localCommand,
      args: descriptor.args,
      install: descriptor.install,
    };
  }

  const global = await commandWorks(descriptor.command, descriptor.versionArgs);
  if (global.available) {
    return {
      id: descriptor.id,
      name: descriptor.name,
      available: true,
      command: descriptor.command,
      args: descriptor.args,
      install: descriptor.install,
    };
  }

  return {
    id: descriptor.id,
    name: descriptor.name,
    available: false,
    command: descriptor.command,
    args: descriptor.args,
    install: descriptor.install,
    reason: global.reason ?? `${descriptor.command} not found`,
  };
}

async function commandWorks(command: string, args: string[]): Promise<{ available: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ available: false, reason: `${command} did not respond to ${args.join(" ")}` });
    }, 2_000);
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({
        available: false,
        reason: error.code === "ENOENT" ? `${command} not found` : error.message,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        available: code === 0,
        reason: code === 0 ? undefined : compact(stderr.trim() || `${command} exited with code ${code}`, 300),
      });
    });
  });
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasAnyMarker(root: string, markers: string[]): Promise<boolean> {
  for (const marker of markers) {
    if (await isExecutable(path.join(root, marker))) return true;
  }
  return false;
}

async function discoverWorkspaceFiles(root: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];
  await walk(root, files, maxFiles);
  return files;
}

async function walk(current: string, files: string[], maxFiles: number): Promise<void> {
  if (files.length >= maxFiles) return;
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) return;
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files, maxFiles);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!detectLanguageForPath(fullPath)) continue;
    try {
      const fileStat = await stat(fullPath);
      if (fileStat.size > 1_000_000) continue;
      files.push(fullPath);
    } catch {
      // Ignore files that disappear during traversal.
    }
  }
}

function normalizeDiagnostic(uri: string, diagnostic: Diagnostic): LspDiagnostic {
  return {
    uri,
    path: fileUriToPath(uri),
    range: normalizeRange(diagnostic.range),
    severity: diagnostic.severity,
    code: typeof diagnostic.code === "string" || typeof diagnostic.code === "number" ? diagnostic.code : undefined,
    source: diagnostic.source,
    message: diagnostic.message,
  };
}

function normalizeLocations(result: Location | Location[] | LocationLink[] | null | undefined): LspLocation[] {
  if (!result) return [];
  const values = Array.isArray(result) ? result : [result];
  return values.map((item) => {
    if ("targetUri" in item) {
      return {
        uri: item.targetUri,
        path: fileUriToPath(item.targetUri),
        range: normalizeRange(item.targetSelectionRange ?? item.targetRange),
      };
    }
    return {
      uri: item.uri,
      path: fileUriToPath(item.uri),
      range: normalizeRange(item.range),
    };
  });
}

function normalizeDocumentSymbols(result: DocumentSymbol[] | SymbolInformation[] | null | undefined, uri: string): LspSymbol[] {
  if (!result) return [];
  const symbols: LspSymbol[] = [];
  for (const item of result) {
    if ("location" in item) {
      symbols.push({
        name: item.name,
        kind: item.kind,
        uri: item.location.uri,
        path: fileUriToPath(item.location.uri),
        range: normalizeRange(item.location.range),
        containerName: item.containerName,
      });
    } else {
      collectDocumentSymbol(item, uri, undefined, symbols);
    }
  }
  return symbols;
}

function collectDocumentSymbol(symbol: DocumentSymbol, uri: string, containerName: string | undefined, output: LspSymbol[]): void {
  output.push({
    name: symbol.name,
    kind: symbol.kind,
    uri,
    path: fileUriToPath(uri),
    range: normalizeRange(symbol.range),
    selectionRange: normalizeRange(symbol.selectionRange),
    containerName,
  });
  for (const child of symbol.children ?? []) {
    collectDocumentSymbol(child, uri, symbol.name, output);
  }
}

function normalizeWorkspaceSymbols(result: Array<SymbolInformation | WorkspaceSymbol> | null | undefined): LspSymbol[] {
  if (!result) return [];
  return result.map((symbol) => {
    const location = symbol.location;
    const uri = location && "uri" in location ? location.uri : undefined;
    const range = location && "range" in location ? normalizeRange(location.range) : undefined;
    return {
      name: symbol.name,
      kind: symbol.kind,
      uri,
      path: uri ? fileUriToPath(uri) : undefined,
      range,
      containerName: "containerName" in symbol ? symbol.containerName : undefined,
    };
  });
}

function normalizeRange(range: { start: Position; end: Position }): LspRange {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  };
}

function toLspLanguageId(languageId: EchoLanguageId): string {
  switch (languageId) {
    case "typescript":
      return "typescript";
    case "javascript":
      return "javascript";
    case "python":
      return "python";
    case "go":
      return "go";
    case "rust":
      return "rust";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function compact(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}
