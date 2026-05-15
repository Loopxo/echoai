import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RecoveryState } from '@shared/ipc';

export const DEFAULT_RECOVERY_STATE: RecoveryState = {
  lastWorkspacePath: null,
  lastRoute: '/',
  lastSessionId: null,
  lastProtocolUrl: null,
  lastWindowBounds: null,
  updatedAt: null,
};

export class RecoveryStore {
  private readonly stateFile: string;

  constructor(dataDir: string) {
    this.stateFile = join(dataDir, 'recovery-state.json');
  }

  async read(): Promise<RecoveryState> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      return sanitizeRecoveryState(JSON.parse(content));
    } catch {
      return { ...DEFAULT_RECOVERY_STATE };
    }
  }

  async write(state: RecoveryState): Promise<void> {
    await mkdir(dirname(this.stateFile), { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  async update(patch: Partial<RecoveryState>): Promise<RecoveryState> {
    const state = await this.read();
    const next = sanitizeRecoveryState({
      ...state,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await this.write(next);
    return next;
  }
}

function sanitizeRecoveryState(value: unknown): RecoveryState {
  if (!isRecord(value)) {
    return { ...DEFAULT_RECOVERY_STATE };
  }

  const bounds = isRecord(value.lastWindowBounds)
    ? {
        x: typeof value.lastWindowBounds.x === 'number' ? value.lastWindowBounds.x : undefined,
        y: typeof value.lastWindowBounds.y === 'number' ? value.lastWindowBounds.y : undefined,
        width:
          typeof value.lastWindowBounds.width === 'number'
            ? value.lastWindowBounds.width
            : DEFAULT_RECOVERY_STATE.lastWindowBounds?.width ?? 1280,
        height:
          typeof value.lastWindowBounds.height === 'number'
            ? value.lastWindowBounds.height
            : DEFAULT_RECOVERY_STATE.lastWindowBounds?.height ?? 820,
      }
    : null;

  return {
    lastWorkspacePath:
      typeof value.lastWorkspacePath === 'string' ? value.lastWorkspacePath : null,
    lastRoute: typeof value.lastRoute === 'string' ? value.lastRoute : '/',
    lastSessionId: typeof value.lastSessionId === 'string' ? value.lastSessionId : null,
    lastProtocolUrl: typeof value.lastProtocolUrl === 'string' ? value.lastProtocolUrl : null,
    lastWindowBounds: bounds,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
