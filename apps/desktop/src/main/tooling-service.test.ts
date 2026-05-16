import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopToolingService } from './tooling-service';

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('desktop tooling service', () => {
  it('summarizes large tool output', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'echoai-tooling-'));
    const service = new DesktopToolingService(tempDir, join(tempDir, 'skills'), join(tempDir, 'cache'));

    const summary = service.summarizeToolOutput(Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n'));

    expect(summary.lineCount).toBe(40);
    expect(summary.truncated).toBe(true);
    expect(summary.preview).toContain('line 0');
  });
});
