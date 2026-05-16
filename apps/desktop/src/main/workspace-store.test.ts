import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceStore } from './workspace-store';

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('workspace store', () => {
  it('keeps the most recently touched workspace first', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'echoai-workspaces-'));
    const store = new WorkspaceStore(tempDir);

    await store.touch('/tmp/alpha');
    await store.touch('/tmp/beta');
    await store.touch('/tmp/alpha');

    const workspaces = await store.list();
    expect(workspaces.map((workspace) => workspace.path)).toEqual(['/tmp/alpha', '/tmp/beta']);
    expect(workspaces[0].sessionCount).toBe(0);
  });
});
