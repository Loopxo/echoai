import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type {
  DesktopArtifactEntry,
  DesktopFilePreview,
  DesktopWorkspaceDiagnostic,
  DesktopWorkspaceEntry,
  DesktopWorkspaceIndex,
  DesktopWorkspaceSearchResult,
  DesktopWorkspaceSymbol,
} from '@shared/ipc';

const ignoredNames = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'dist-electron',
  'node_modules',
  'release',
]);
const textExtensions = new Set([
  '.astro',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const maxPreviewBytes = 128 * 1024;
const maxSearchFiles = 800;

export class WorkspaceFileService {
  async listFiles(rootPath: string): Promise<DesktopWorkspaceEntry[]> {
    const root = normalizeRoot(rootPath);
    const entries = await readdir(root, { withFileTypes: true });
    const result: DesktopWorkspaceEntry[] = [];

    for (const entry of entries) {
      if (shouldIgnoreName(entry.name)) {
        continue;
      }

      const absolutePath = join(root, entry.name);
      const fileStat = await stat(absolutePath).catch(() => null);
      if (!fileStat) {
        continue;
      }

      result.push({
        path: entry.name,
        name: entry.name,
        kind: entry.isDirectory() ? 'directory' : 'file',
        size: fileStat.size,
        modifiedAt: fileStat.mtimeMs,
      });
    }

    return result.sort(sortEntries);
  }

  async previewFile(rootPath: string, relativePath: string): Promise<DesktopFilePreview> {
    const root = normalizeRoot(rootPath);
    const absolutePath = resolveInside(root, relativePath);
    const fileStat = await stat(absolutePath).catch(() => null);
    const name = basename(absolutePath);
    if (!fileStat || !fileStat.isFile()) {
      return {
        path: relativePath,
        name,
        kind: 'missing',
        size: 0,
        modifiedAt: null,
        content: null,
        mediaPath: null,
      };
    }

    const extension = extname(name).toLowerCase();
    const kind = detectPreviewKind(extension);
    if (kind === 'image') {
      return createPreview(relativePath, name, kind, fileStat.size, fileStat.mtimeMs, null, absolutePath);
    }

    if (kind === 'binary') {
      return createPreview(relativePath, name, kind, fileStat.size, fileStat.mtimeMs, null, null);
    }

    if (kind === 'pdf') {
      return createPreview(
        relativePath,
        name,
        kind,
        fileStat.size,
        fileStat.mtimeMs,
        `PDF document, ${formatBytes(fileStat.size)}`,
        null
      );
    }

    const content = await readFile(absolutePath, 'utf8').catch(() => '');
    return createPreview(
      relativePath,
      name,
      kind,
      fileStat.size,
      fileStat.mtimeMs,
      content.slice(0, maxPreviewBytes),
      null
    );
  }

  async search(rootPath: string, query: string): Promise<DesktopWorkspaceSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const root = normalizeRoot(rootPath);
    const files = await walkFiles(root, maxSearchFiles);
    const results: DesktopWorkspaceSearchResult[] = [];

    for (const file of files) {
      const relativePath = toRelative(root, file);
      if (relativePath.toLowerCase().includes(normalizedQuery)) {
        results.push({ path: relativePath, line: null, preview: relativePath });
      }

      if (!textExtensions.has(extname(file).toLowerCase())) {
        continue;
      }

      const content = await readFile(file, 'utf8').catch(() => '');
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].toLowerCase().includes(normalizedQuery)) {
          results.push({
            path: relativePath,
            line: index + 1,
            preview: lines[index].trim().slice(0, 180),
          });
          break;
        }
      }

      if (results.length >= 100) {
        break;
      }
    }

    return results;
  }

  async listSymbols(rootPath: string, query = ''): Promise<DesktopWorkspaceSymbol[]> {
    const root = normalizeRoot(rootPath);
    const normalizedQuery = query.trim().toLowerCase();
    const files = await walkFiles(root, maxSearchFiles);
    const symbols: DesktopWorkspaceSymbol[] = [];

    for (const file of files) {
      if (!textExtensions.has(extname(file).toLowerCase())) {
        continue;
      }

      const relativePath = toRelative(root, file);
      const content = await readFile(file, 'utf8').catch(() => '');
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const symbol = parseSymbol(lines[index], relativePath, index + 1);
        if (!symbol) {
          continue;
        }
        if (normalizedQuery && !symbol.name.toLowerCase().includes(normalizedQuery)) {
          continue;
        }
        symbols.push(symbol);
      }
      if (symbols.length >= 200) {
        break;
      }
    }

    return symbols;
  }

  async listDiagnostics(rootPath: string): Promise<DesktopWorkspaceDiagnostic[]> {
    const root = normalizeRoot(rootPath);
    const files = await walkFiles(root, maxSearchFiles);
    const diagnostics: DesktopWorkspaceDiagnostic[] = [];

    for (const file of files) {
      const fileStat = await stat(file).catch(() => null);
      if (!fileStat) {
        continue;
      }
      const relativePath = toRelative(root, file);
      if (fileStat.size > 1024 * 1024) {
        diagnostics.push({
          path: relativePath,
          severity: 'warning',
          message: 'Large file is excluded from automatic context by default.',
          line: null,
        });
      }
      if (basename(file).toLowerCase().includes('secret') || basename(file).startsWith('.env')) {
        diagnostics.push({
          path: relativePath,
          severity: 'info',
          message: 'Sensitive-looking file should stay outside prompt context unless explicitly attached.',
          line: null,
        });
      }
    }

    return diagnostics.slice(0, 100);
  }

  async indexWorkspace(rootPath: string): Promise<DesktopWorkspaceIndex> {
    const root = normalizeRoot(rootPath);
    const entries = await walkEntries(root, 2000);
    return {
      root,
      fileCount: entries.filter((entry) => entry.kind === 'file').length,
      directoryCount: entries.filter((entry) => entry.kind === 'directory').length,
      indexedAt: new Date().toISOString(),
      ignoredPaths: [...ignoredNames].sort(),
    };
  }

  async listRecentFiles(rootPath: string): Promise<DesktopWorkspaceEntry[]> {
    const root = normalizeRoot(rootPath);
    const files = await walkFiles(root, maxSearchFiles);
    const entries = await Promise.all(
      files.map(async (file): Promise<DesktopWorkspaceEntry | null> => {
        const fileStat = await stat(file).catch(() => null);
        if (!fileStat) {
          return null;
        }
        return {
          path: toRelative(root, file),
          name: basename(file),
          kind: 'file',
          size: fileStat.size,
          modifiedAt: fileStat.mtimeMs,
        };
      })
    );

    return entries
      .filter((entry): entry is DesktopWorkspaceEntry => entry !== null)
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 50);
  }

  async listArtifacts(artifactsDir: string): Promise<DesktopArtifactEntry[]> {
    const root = normalizeRoot(artifactsDir);
    const files = await walkFiles(root, 500);
    const entries = await Promise.all(
      files.map(async (file): Promise<DesktopArtifactEntry | null> => {
        const fileStat = await stat(file).catch(() => null);
        if (!fileStat) {
          return null;
        }
        const extension = extname(file).toLowerCase();
        return {
          path: file,
          name: basename(file),
          type: extension === '.diff' || extension === '.patch' ? 'diff' : extension === '.log' ? 'log' : 'file',
          size: fileStat.size,
          modifiedAt: fileStat.mtimeMs,
        };
      })
    );

    return entries
      .filter((entry): entry is DesktopArtifactEntry => entry !== null)
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
}

function createPreview(
  path: string,
  name: string,
  kind: DesktopFilePreview['kind'],
  size: number,
  modifiedAt: number,
  content: string | null,
  mediaPath: string | null
): DesktopFilePreview {
  return { path, name, kind, size, modifiedAt, content, mediaPath };
}

function detectPreviewKind(extension: string): DesktopFilePreview['kind'] {
  if (imageExtensions.has(extension)) {
    return 'image';
  }
  if (extension === '.pdf') {
    return 'pdf';
  }
  if (extension === '.csv' || extension === '.tsv') {
    return 'csv';
  }
  if (extension === '.md' || extension === '.mdx') {
    return 'markdown';
  }
  if (textExtensions.has(extension)) {
    return 'code';
  }
  return 'binary';
}

async function walkFiles(root: string, limit: number): Promise<string[]> {
  const entries = await walkEntries(root, limit);
  return entries.filter((entry) => entry.kind === 'file').map((entry) => join(root, entry.path));
}

async function walkEntries(root: string, limit: number): Promise<DesktopWorkspaceEntry[]> {
  const result: DesktopWorkspaceEntry[] = [];
  const queue = [''];

  while (queue.length > 0 && result.length < limit) {
    const current = queue.shift() ?? '';
    const currentAbsolute = join(root, current);
    const entries = await readdir(currentAbsolute, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (shouldIgnoreName(entry.name)) {
        continue;
      }
      const relativePath = current ? join(current, entry.name) : entry.name;
      const absolutePath = join(root, relativePath);
      const fileStat = await stat(absolutePath).catch(() => null);
      if (!fileStat) {
        continue;
      }
      const item: DesktopWorkspaceEntry = {
        path: relativePath,
        name: entry.name,
        kind: entry.isDirectory() ? 'directory' : 'file',
        size: fileStat.size,
        modifiedAt: fileStat.mtimeMs,
      };
      result.push(item);
      if (entry.isDirectory()) {
        queue.push(relativePath);
      }
      if (result.length >= limit) {
        break;
      }
    }
  }

  return result;
}

function parseSymbol(line: string, path: string, lineNumber: number): DesktopWorkspaceSymbol | null {
  const trimmed = line.trim();
  const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    return { path, name: heading[2], kind: 'heading', line: lineNumber };
  }

  const declaration = trimmed.match(/^(export\s+)?(async\s+)?(function|class|type|interface|const|let|var)\s+([A-Za-z0-9_$]+)/);
  if (!declaration) {
    return null;
  }

  const keyword = declaration[3];
  const kind =
    keyword === 'function'
      ? 'function'
      : keyword === 'class'
        ? 'class'
        : keyword === 'type' || keyword === 'interface'
          ? 'type'
          : 'constant';
  return { path, name: declaration[4], kind, line: lineNumber };
}

function normalizeRoot(rootPath: string): string {
  return resolve(rootPath);
}

function resolveInside(root: string, relativePath: string): string {
  const absolutePath = resolve(root, relativePath);
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  if (absolutePath !== root && !absolutePath.startsWith(normalizedRoot)) {
    throw new Error('Path escapes workspace root');
  }
  return absolutePath;
}

function toRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath) || basename(absolutePath);
}

function shouldIgnoreName(name: string): boolean {
  return ignoredNames.has(name) || name.endsWith('.lock') || name.endsWith('.pem');
}

function sortEntries(a: DesktopWorkspaceEntry, b: DesktopWorkspaceEntry): number {
  if (a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
