import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { RecoveryStore } from './recovery-store';

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('recovery store', () => {
  it('returns defaults when no state exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'echoai-desktop-'));
    const store = new RecoveryStore(tempDir);

    await expect(store.read()).resolves.toMatchObject({
      lastWorkspacePath: null,
      lastRoute: '/',
      lastSessionId: null,
    });
  });

  it('persists partial updates with a timestamp', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'echoai-desktop-'));
    const store = new RecoveryStore(tempDir);

    const state = await store.update({ lastWorkspacePath: '/tmp/project', lastRoute: '/chat' });

    expect(state.lastWorkspacePath).toBe('/tmp/project');
    expect(state.lastRoute).toBe('/chat');
    expect(state.updatedAt).toEqual(expect.any(String));
    await expect(store.read()).resolves.toMatchObject({
      lastWorkspacePath: '/tmp/project',
      lastRoute: '/chat',
    });
  });
});
