import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopGatewayService } from './gateway-service';
import type { DesktopAppPaths } from '@shared/ipc';

let tempDir: string | null = null;
let service: DesktopGatewayService | null = null;

afterEach(async () => {
  await service?.stopGateway();
  service = null;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('desktop gateway service', () => {
  it('starts a local health endpoint', async () => {
    service = new DesktopGatewayService(await createPaths());

    const status = await service.startGateway();
    expect(status.running).toBe(true);
    expect(status.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const response = await fetch(`${status.url}/health`);
    const body = await response.json() as { status: { protocolVersion: string } };
    expect(response.status).toBe(200);
    expect(body.status.protocolVersion).toBe('2026-05');
  });

  it('approves pairing requests into trusted devices', async () => {
    service = new DesktopGatewayService(await createPaths());

    const request = await service.createPairingRequest('Vijeet iPhone', 'mobile');
    const decided = await service.respondToPairing(request.id, true);
    const devices = await service.listPairedDevices();

    expect(decided?.status).toBe('approved');
    expect(devices).toHaveLength(1);
    expect(devices[0]?.scopes).toContain('approval:respond');
  });

  it('keeps telemetry disabled unless explicitly opted in', async () => {
    service = new DesktopGatewayService(await createPaths());

    expect(await service.getTelemetrySettings()).toMatchObject({ enabled: false });
    const telemetry = await service.updateTelemetrySettings({ enabled: true });

    expect(telemetry.enabled).toBe(true);
    expect(telemetry.promptContentAllowed).toBe(false);
  });
});

async function createPaths(): Promise<DesktopAppPaths> {
  tempDir = await mkdtemp(join(tmpdir(), 'echoai-gateway-'));
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
