import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceFileService } from './workspace-file-service';

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('workspace file service', () => {
  it('lists and previews files inside the workspace root', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'echoai-files-'));
    await writeFile(join(tempDir, 'index.ts'), 'export function hello() { return true; }\n');
    const service = new WorkspaceFileService();

    await expect(service.listFiles(tempDir)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'index.ts', kind: 'file' })])
    );
    await expect(service.previewFile(tempDir, 'index.ts')).resolves.toMatchObject({
      kind: 'code',
      content: expect.stringContaining('hello'),
    });
  });

  it('blocks path traversal outside the workspace root', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'echoai-files-'));
    const service = new WorkspaceFileService();

    await expect(service.previewFile(tempDir, '../outside.txt')).rejects.toThrow(
      'Path escapes workspace root'
    );
  });
});
