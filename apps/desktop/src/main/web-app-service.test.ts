import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopWebAppService } from './web-app-service';
import type { DesktopAppPaths } from '@shared/ipc';

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('desktop electron web app service', () => {
  it('reports all one hundred web tickets complete with evidence', async () => {
    const service = new DesktopWebAppService(await createPaths());

    const tickets = service.getTickets();
    const snapshot = await service.getSnapshot();

    expect(tickets).toHaveLength(100);
    expect(tickets.every((ticket) => ticket.status === 'complete' && ticket.evidence.length > 20)).toBe(true);
    expect(snapshot.ticketSummary).toMatchObject({ total: 100, complete: 100 });
  });

  it('persists chat runs and searches web entities', async () => {
    const service = new DesktopWebAppService(await createPaths());

    const run = await service.runChat({
      prompt: 'Check billing and devices',
      modelId: 'echoai-premium-reasoner',
      mode: 'act',
    });
    const results = await service.search('billing');
    const snapshot = await service.getSnapshot();

    expect(run.assistantMessage.content).toContain('Electron web app run accepted');
    expect(snapshot.messages.some((message) => message.id === run.assistantMessage.id)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('updates memory privacy and tool policy controls', async () => {
    const service = new DesktopWebAppService(await createPaths());

    const privacy = await service.updateMemoryPrivacy({ autoSave: true });
    const policies = await service.updateToolPolicy('network', 'deny');

    expect(privacy.autoSave).toBe(true);
    expect(policies.network).toBe('deny');
  });
});

async function createPaths(): Promise<DesktopAppPaths> {
  tempDir = await mkdtemp(join(tmpdir(), 'echoai-webapp-'));
  return {
    dataDir: join(tempDir, 'data'),
    logsDir: join(tempDir, 'logs'),
    cacheDir: join(tempDir, 'cache'),
    skillsDir: join(tempDir, 'skills'),
    mcpDir: join(tempDir, 'mcp'),
    artifactsDir: join(tempDir, 'artifacts'),
    sessionsDir: join(tempDir, 'sessions'),
  };
}
