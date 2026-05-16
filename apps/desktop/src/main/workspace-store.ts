import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DesktopRecentWorkspace } from '@shared/ipc';

const maxRecentWorkspaces = 12;

export class WorkspaceStore {
  private readonly stateFile: string;

  constructor(dataDir: string) {
    this.stateFile = join(dataDir, 'recent-workspaces.json');
  }

  async list(): Promise<DesktopRecentWorkspace[]> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      const parsed = JSON.parse(content);
      return sanitizeRecentWorkspaces(parsed);
    } catch {
      return [];
    }
  }

  async touch(path: string): Promise<DesktopRecentWorkspace[]> {
    const now = new Date().toISOString();
    const current = await this.list();
    const existing = current.find((workspace) => workspace.path === path);
    const nextItem: DesktopRecentWorkspace = {
      path,
      lastActiveAt: now,
      sessionCount: existing?.sessionCount ?? 0,
    };
    const next = [nextItem, ...current.filter((workspace) => workspace.path !== path)].slice(
      0,
      maxRecentWorkspaces
    );

    await mkdir(dirname(this.stateFile), { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  }
}

function sanitizeRecentWorkspaces(value: unknown): DesktopRecentWorkspace[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecentWorkspace)
    .map((workspace) => ({
      path: workspace.path,
      lastActiveAt: workspace.lastActiveAt,
      sessionCount: workspace.sessionCount,
    }))
    .slice(0, maxRecentWorkspaces);
}

function isRecentWorkspace(value: unknown): value is DesktopRecentWorkspace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as DesktopRecentWorkspace;
  return (
    typeof candidate.path === 'string' &&
    typeof candidate.lastActiveAt === 'string' &&
    typeof candidate.sessionCount === 'number'
  );
}
