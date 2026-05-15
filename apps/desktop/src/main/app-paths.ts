import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DesktopAppPaths } from '@shared/ipc';

export function buildDesktopAppPaths(userDataDir: string): DesktopAppPaths {
  return {
    dataDir: join(userDataDir, 'data'),
    logsDir: join(userDataDir, 'logs'),
    cacheDir: join(userDataDir, 'cache'),
    skillsDir: join(userDataDir, 'skills'),
    mcpDir: join(userDataDir, 'mcp'),
    artifactsDir: join(userDataDir, 'artifacts'),
    sessionsDir: join(userDataDir, 'sessions'),
  };
}

export async function ensureDesktopAppPaths(paths: DesktopAppPaths): Promise<void> {
  await Promise.all(Object.values(paths).map((dir) => mkdir(dir, { recursive: true })));
}
