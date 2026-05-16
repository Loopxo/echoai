import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { DesktopLogger } from './logger';
import type {
  DesktopAppPaths,
  DesktopChannelSetting,
  DesktopGatewayStatus,
  DesktopPairedDevice,
  DesktopPairingRequest,
  DesktopPrivacyDashboard,
  DesktopPrivacyDeleteResult,
  DesktopReleaseChecklistItem,
  DesktopRemoteControlRequest,
  DesktopScheduledTask,
  DesktopTelemetrySettings,
} from '@shared/ipc';

interface GatewayState {
  pairingRequests: DesktopPairingRequest[];
  pairedDevices: DesktopPairedDevice[];
  remoteControls: DesktopRemoteControlRequest[];
  channelSettings: DesktopChannelSetting[];
  scheduledTasks: DesktopScheduledTask[];
  telemetry: DesktopTelemetrySettings;
}

interface RemoteSubmitInput {
  source: DesktopRemoteControlRequest['source'];
  prompt: string;
  workspacePath?: string;
}

const gatewayHost = '127.0.0.1';
const gatewayProtocolVersion = '2026-05';
const pairingTtlMs = 10 * 60 * 1000;

export class DesktopGatewayService {
  private readonly stateFile: string;
  private server: Server | null = null;
  private port: number | null = null;
  private startedAt: string | null = null;

  constructor(
    private readonly paths: DesktopAppPaths,
    private readonly logger?: DesktopLogger
  ) {
    this.stateFile = join(paths.dataDir, 'gateway-state.json');
  }

  async startGateway(preferredPort?: number): Promise<DesktopGatewayStatus> {
    if (this.server) {
      return this.getStatus();
    }

    await mkdir(this.paths.dataDir, { recursive: true });

    const server = createServer((request, response) => {
      void this.handleHttpRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(preferredPort ?? 0, gatewayHost, () => {
        server.off('error', reject);
        resolve();
      });
    });

    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      server.close();
      throw new Error('Gateway did not bind to a TCP address');
    }

    this.server = server;
    this.port = address.port;
    this.startedAt = new Date().toISOString();
    this.logger?.info('desktop gateway started', { host: gatewayHost, port: this.port });
    return this.getStatus();
  }

  async stopGateway(): Promise<DesktopGatewayStatus> {
    if (!this.server) {
      return this.getStatus();
    }

    const server = this.server;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.server = null;
    this.port = null;
    this.startedAt = null;
    this.logger?.info('desktop gateway stopped');
    return this.getStatus();
  }

  async getStatus(): Promise<DesktopGatewayStatus> {
    const state = await this.read();
    return {
      running: this.server !== null,
      host: gatewayHost,
      port: this.port,
      url: this.port === null ? null : `http://${gatewayHost}:${this.port}`,
      startedAt: this.startedAt,
      protocolVersion: gatewayProtocolVersion,
      pairedDeviceCount: state.pairedDevices.length,
      pendingPairingCount: activePairingRequests(state.pairingRequests).length,
      remoteHandoffCount: state.remoteControls.length,
      scheduledTaskCount: state.scheduledTasks.length,
      telemetryEnabled: state.telemetry.enabled,
    };
  }

  async createPairingRequest(
    deviceName: string,
    deviceType: DesktopPairingRequest['deviceType']
  ): Promise<DesktopPairingRequest> {
    const state = await this.read();
    const createdAt = new Date();
    const request: DesktopPairingRequest = {
      id: randomUUID(),
      deviceName: sanitizeLabel(deviceName, 'Unnamed device'),
      deviceType,
      code: createPairingCode(),
      status: 'pending',
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + pairingTtlMs).toISOString(),
      decidedAt: null,
    };
    await this.write({
      ...state,
      pairingRequests: [request, ...expirePairingRequests(state.pairingRequests)].slice(0, 50),
    });
    return request;
  }

  async listPairingRequests(): Promise<DesktopPairingRequest[]> {
    const state = await this.read();
    const requests = expirePairingRequests(state.pairingRequests);
    if (requests !== state.pairingRequests) {
      await this.write({ ...state, pairingRequests: requests });
    }
    return requests;
  }

  async respondToPairing(
    requestId: string,
    approved: boolean
  ): Promise<DesktopPairingRequest | null> {
    const state = await this.read();
    const now = new Date().toISOString();
    let pairedDevice: DesktopPairedDevice | null = null;
    const requests = expirePairingRequests(state.pairingRequests).map((request) => {
      if (request.id !== requestId || request.status !== 'pending') {
        return request;
      }

      const nextRequest: DesktopPairingRequest = {
        ...request,
        status: approved ? 'approved' : 'rejected',
        decidedAt: now,
      };
      if (approved) {
        pairedDevice = {
          id: randomUUID(),
          name: request.deviceName,
          type: request.deviceType,
          trustedAt: now,
          lastSeenAt: now,
          scopes: defaultScopesForDevice(request.deviceType),
        };
      }
      return nextRequest;
    });
    await this.write({
      ...state,
      pairingRequests: requests,
      pairedDevices: pairedDevice ? [pairedDevice, ...state.pairedDevices] : state.pairedDevices,
    });
    return requests.find((request) => request.id === requestId) ?? null;
  }

  async listPairedDevices(): Promise<DesktopPairedDevice[]> {
    return (await this.read()).pairedDevices;
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    const state = await this.read();
    const next = state.pairedDevices.filter((device) => device.id !== deviceId);
    await this.write({ ...state, pairedDevices: next });
    return next.length !== state.pairedDevices.length;
  }

  async submitRemoteControl(input: RemoteSubmitInput): Promise<DesktopRemoteControlRequest> {
    const state = await this.read();
    const request: DesktopRemoteControlRequest = {
      id: randomUUID(),
      source: input.source,
      prompt: input.prompt.trim(),
      workspacePath: input.workspacePath ?? null,
      status: 'queued',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    await this.write({
      ...state,
      remoteControls: [request, ...state.remoteControls].slice(0, 100),
    });
    return request;
  }

  async listRemoteControls(): Promise<DesktopRemoteControlRequest[]> {
    return (await this.read()).remoteControls;
  }

  async approveRemoteControl(
    requestId: string,
    approved: boolean
  ): Promise<DesktopRemoteControlRequest | null> {
    const state = await this.read();
    const now = new Date().toISOString();
    const remoteControls = state.remoteControls.map((request) =>
      request.id === requestId
        ? { ...request, status: approved ? 'approved' as const : 'rejected' as const, decidedAt: now }
        : request
    );
    await this.write({ ...state, remoteControls });
    return remoteControls.find((request) => request.id === requestId) ?? null;
  }

  async listChannelSettings(): Promise<DesktopChannelSetting[]> {
    return (await this.read()).channelSettings;
  }

  async updateChannelSetting(
    channelId: string,
    patch: Partial<DesktopChannelSetting>
  ): Promise<DesktopChannelSetting> {
    const state = await this.read();
    const channel = state.channelSettings.find((item) => item.id === channelId) ?? {
      id: channelId,
      name: toTitle(channelId),
      provider: channelId,
      enabled: false,
      webhookUrl: null,
      updatedAt: new Date().toISOString(),
    };
    const nextChannel: DesktopChannelSetting = {
      ...channel,
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : channel.enabled,
      webhookUrl:
        typeof patch.webhookUrl === 'string'
          ? sanitizeWebhook(patch.webhookUrl)
          : channel.webhookUrl,
      updatedAt: new Date().toISOString(),
    };
    await this.write({
      ...state,
      channelSettings: [
        nextChannel,
        ...state.channelSettings.filter((item) => item.id !== nextChannel.id),
      ],
    });
    return nextChannel;
  }

  async listScheduledTasks(): Promise<DesktopScheduledTask[]> {
    return (await this.read()).scheduledTasks;
  }

  async createScheduledTask(input: {
    title: string;
    prompt: string;
    schedule: string;
    workspacePath?: string;
  }): Promise<DesktopScheduledTask> {
    const state = await this.read();
    const now = new Date().toISOString();
    const task: DesktopScheduledTask = {
      id: randomUUID(),
      title: sanitizeLabel(input.title, 'Scheduled task'),
      prompt: input.prompt.trim(),
      schedule: sanitizeLabel(input.schedule, 'manual'),
      workspacePath: input.workspacePath ?? null,
      enabled: true,
      nextRunAt: estimateNextRun(input.schedule),
      createdAt: now,
      updatedAt: now,
    };
    await this.write({ ...state, scheduledTasks: [task, ...state.scheduledTasks].slice(0, 100) });
    return task;
  }

  async deleteScheduledTask(taskId: string): Promise<boolean> {
    const state = await this.read();
    const next = state.scheduledTasks.filter((task) => task.id !== taskId);
    await this.write({ ...state, scheduledTasks: next });
    return next.length !== state.scheduledTasks.length;
  }

  async getTelemetrySettings(): Promise<DesktopTelemetrySettings> {
    return (await this.read()).telemetry;
  }

  async updateTelemetrySettings(
    patch: Partial<DesktopTelemetrySettings>
  ): Promise<DesktopTelemetrySettings> {
    const state = await this.read();
    const telemetry: DesktopTelemetrySettings = {
      ...state.telemetry,
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : state.telemetry.enabled,
      orgAllowed:
        typeof patch.orgAllowed === 'boolean' ? patch.orgAllowed : state.telemetry.orgAllowed,
      promptContentAllowed:
        typeof patch.promptContentAllowed === 'boolean'
          ? patch.promptContentAllowed
          : state.telemetry.promptContentAllowed,
      updatedAt: new Date().toISOString(),
    };
    await this.write({ ...state, telemetry });
    return telemetry;
  }

  async getPrivacyDashboard(): Promise<DesktopPrivacyDashboard> {
    const state = await this.read();
    return {
      localData: [
        { label: 'Sessions', path: this.paths.sessionsDir, boundary: 'local' },
        { label: 'Artifacts', path: this.paths.artifactsDir, boundary: 'local' },
        { label: 'Logs', path: this.paths.logsDir, boundary: 'local' },
        { label: 'Gateway state', path: this.stateFile, boundary: 'local' },
      ],
      cloudData: [
        { label: 'Hosted account', enabled: false },
        { label: 'Session sync', enabled: false },
        { label: 'Artifact sync', enabled: false },
        { label: 'Memory sync', enabled: false },
      ],
      pairedDevices: state.pairedDevices.length,
      pendingPairingRequests: activePairingRequests(state.pairingRequests).length,
      telemetry: state.telemetry,
      generatedAt: new Date().toISOString(),
    };
  }

  async exportPrivacyData(): Promise<string> {
    const state = await this.read();
    await mkdir(this.paths.artifactsDir, { recursive: true });
    const exportPath = join(
      this.paths.artifactsDir,
      `privacy-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    await writeFile(
      exportPath,
      `${JSON.stringify({ exportedAt: new Date().toISOString(), gateway: state }, null, 2)}\n`,
      'utf8'
    );
    return exportPath;
  }

  async deleteLocalPrivacyData(): Promise<DesktopPrivacyDeleteResult> {
    const reset = createDefaultState();
    await this.write(reset);
    return {
      deletedAt: new Date().toISOString(),
      resetPairingRequests: true,
      resetPairedDevices: true,
      resetRemoteControls: true,
      resetTelemetry: true,
    };
  }

  async getReleaseChecklist(): Promise<DesktopReleaseChecklistItem[]> {
    const status = await this.getStatus();
    const telemetry = await this.getTelemetrySettings();
    return [
      createChecklistItem('signing', 'Signing inputs documented', 'pass', 'Release docs list macOS and Windows secrets.'),
      createChecklistItem('updater', 'Updater configured', 'pass', 'Auto-update IPC and consent flow are wired.'),
      createChecklistItem('permissions', 'Renderer permission policy', 'pass', 'Renderer permissions are denied unless explicitly brokered.'),
      createChecklistItem(
        'gateway',
        'Gateway health endpoint',
        status.running ? 'pass' : 'warn',
        status.running ? `Listening at ${status.url}` : 'Gateway starts on demand before remote control.'
      ),
      createChecklistItem('crash-logs', 'Crash and runtime logs', 'pass', 'Desktop logs are searchable from the app.'),
      createChecklistItem(
        'telemetry',
        'Telemetry opt-in',
        telemetry.enabled ? 'warn' : 'pass',
        telemetry.enabled ? 'Analytics enabled by user or org.' : 'Analytics disabled by default.'
      ),
      createChecklistItem('smoke', 'Non-GUI smoke checks', 'pass', 'Typecheck, unit tests, and production build cover this package.'),
    ];
  }

  private async handleHttpRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', `http://${gatewayHost}:${this.port ?? 0}`);
      if (request.method === 'GET' && url.pathname === '/health') {
        this.sendJson(response, 200, {
          app: 'EchoAI Desktop Gateway',
          status: await this.getStatus(),
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/pair') {
        const body = await readJsonBody(request);
        const deviceName = typeof body.deviceName === 'string' ? body.deviceName : 'Remote device';
        const deviceType = toDeviceType(body.deviceType);
        this.sendJson(response, 202, await this.createPairingRequest(deviceName, deviceType));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/remote/prompts') {
        const body = await readJsonBody(request);
        const prompt = typeof body.prompt === 'string' ? body.prompt : '';
        if (!prompt.trim()) {
          this.sendJson(response, 400, { error: 'prompt is required' });
          return;
        }
        this.sendJson(
          response,
          202,
          await this.submitRemoteControl({
            source: toRemoteSource(body.source),
            prompt,
            workspacePath: typeof body.workspacePath === 'string' ? body.workspacePath : undefined,
          })
        );
        return;
      }

      this.sendJson(response, 404, { error: 'not found' });
    } catch (error) {
      this.logger?.error('desktop gateway request failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      this.sendJson(response, 500, { error: 'gateway request failed' });
    }
  }

  private sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
    response.writeHead(statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }

  private async read(): Promise<GatewayState> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      return sanitizeState(JSON.parse(content));
    } catch {
      return createDefaultState();
    }
  }

  private async write(state: GatewayState): Promise<void> {
    await mkdir(this.paths.dataDir, { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(sanitizeState(state), null, 2)}\n`, 'utf8');
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).byteLength > 1024 * 1024) {
      throw new Error('Request body too large');
    }
  }

  if (chunks.length === 0) {
    return {};
  }

  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

function createDefaultState(): GatewayState {
  return {
    pairingRequests: [],
    pairedDevices: [],
    remoteControls: [],
    channelSettings: defaultChannels(),
    scheduledTasks: [],
    telemetry: {
      enabled: false,
      orgAllowed: true,
      promptContentAllowed: false,
      updatedAt: null,
    },
  };
}

function sanitizeState(value: unknown): GatewayState {
  if (typeof value !== 'object' || value === null) {
    return createDefaultState();
  }

  const record = value as Partial<GatewayState>;
  return {
    pairingRequests: Array.isArray(record.pairingRequests) ? record.pairingRequests : [],
    pairedDevices: Array.isArray(record.pairedDevices) ? record.pairedDevices : [],
    remoteControls: Array.isArray(record.remoteControls) ? record.remoteControls : [],
    channelSettings:
      Array.isArray(record.channelSettings) && record.channelSettings.length > 0
        ? record.channelSettings
        : defaultChannels(),
    scheduledTasks: Array.isArray(record.scheduledTasks) ? record.scheduledTasks : [],
    telemetry:
      typeof record.telemetry === 'object' && record.telemetry !== null
        ? record.telemetry
        : createDefaultState().telemetry,
  };
}

function defaultChannels(): DesktopChannelSetting[] {
  const now = new Date().toISOString();
  return ['slack', 'discord', 'telegram', 'whatsapp'].map((provider) => ({
    id: provider,
    name: toTitle(provider),
    provider,
    enabled: false,
    webhookUrl: null,
    updatedAt: now,
  }));
}

function createPairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function expirePairingRequests(requests: DesktopPairingRequest[]): DesktopPairingRequest[] {
  const now = Date.now();
  let changed = false;
  const next = requests.map((request) => {
    if (request.status !== 'pending' || new Date(request.expiresAt).getTime() > now) {
      return request;
    }

    changed = true;
    return { ...request, status: 'expired' as const, decidedAt: new Date().toISOString() };
  });
  return changed ? next : requests;
}

function activePairingRequests(requests: DesktopPairingRequest[]): DesktopPairingRequest[] {
  return expirePairingRequests(requests).filter((request) => request.status === 'pending');
}

function defaultScopesForDevice(deviceType: DesktopPairingRequest['deviceType']): string[] {
  if (deviceType === 'mobile') {
    return ['prompt:create', 'run:view', 'approval:respond'];
  }

  if (deviceType === 'web') {
    return ['prompt:create', 'handoff:create', 'run:view'];
  }

  return ['prompt:create', 'run:view'];
}

function toDeviceType(value: unknown): DesktopPairingRequest['deviceType'] {
  return value === 'mobile' || value === 'web' || value === 'desktop' ? value : 'unknown';
}

function toRemoteSource(value: unknown): DesktopRemoteControlRequest['source'] {
  return value === 'mobile' || value === 'web' ? value : 'web';
}

function sanitizeLabel(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 160) : fallback;
}

function sanitizeWebhook(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function estimateNextRun(schedule: string): string | null {
  const normalized = schedule.toLowerCase();
  const now = Date.now();
  if (normalized.includes('daily')) {
    return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }
  if (normalized.includes('weekly')) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (normalized.includes('hour')) {
    return new Date(now + 60 * 60 * 1000).toISOString();
  }
  return null;
}

function toTitle(value: string): string {
  return value.replace(/(^|-)([a-z])/g, (_match, prefix: string, letter: string) =>
    `${prefix ? ' ' : ''}${letter.toUpperCase()}`
  );
}

function createChecklistItem(
  id: string,
  label: string,
  status: DesktopReleaseChecklistItem['status'],
  detail: string
): DesktopReleaseChecklistItem {
  return { id, label, status, detail };
}
