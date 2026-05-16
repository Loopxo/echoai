import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { safeStorage } from 'electron';
import type {
  DesktopAccountAuditEvent,
  DesktopAccountStatus,
  DesktopDeviceLogin,
  DesktopSyncQueueItem,
  DesktopSyncSettings,
} from '@shared/ipc';

interface PersistedAuthState {
  encryptedToken: string | null;
  account: DesktopAccountStatus;
  syncSettings: DesktopSyncSettings;
  queue: DesktopSyncQueueItem[];
  audit: DesktopAccountAuditEvent[];
}

const defaultAccount: DesktopAccountStatus = {
  signedIn: false,
  email: null,
  plan: null,
  credits: null,
  syncState: 'offline',
  offlineMode: true,
  updatedAt: null,
};

const defaultSyncSettings: DesktopSyncSettings = {
  sessions: false,
  artifacts: false,
  memories: false,
  conflictPolicy: 'ask',
};

export class AuthStore {
  private readonly stateFile: string;

  constructor(dataDir: string) {
    this.stateFile = join(dataDir, 'account-state.json');
  }

  async getStatus(): Promise<DesktopAccountStatus> {
    return (await this.read()).account;
  }

  async startDeviceLogin(): Promise<DesktopDeviceLogin> {
    const login = {
      verificationUrl: 'https://echoai.ai/device',
      userCode: generateDeviceCode(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    await this.addAudit('login-started', `Device login started with code ${login.userCode}`);
    return login;
  }

  async completeHostedLogin(input: {
    token: string;
    email?: string | null;
    plan?: string | null;
    credits?: number | null;
  }): Promise<DesktopAccountStatus> {
    const state = await this.read();
    const account: DesktopAccountStatus = {
      signedIn: true,
      email: input.email ?? 'account@echoai.local',
      plan: input.plan ?? 'pro',
      credits: input.credits ?? 0,
      syncState: 'idle',
      offlineMode: false,
      updatedAt: new Date().toISOString(),
    };

    await this.write({
      ...state,
      encryptedToken: encryptToken(input.token),
      account,
      audit: prependAudit(state.audit, 'login-completed', 'Hosted account connected'),
    });
    return account;
  }

  async refresh(): Promise<DesktopAccountStatus> {
    const state = await this.read();
    if (!state.account.signedIn || !state.encryptedToken) {
      return state.account;
    }

    decryptToken(state.encryptedToken);
    const account: DesktopAccountStatus = {
      ...state.account,
      syncState: state.account.offlineMode ? 'offline' : 'idle',
      updatedAt: new Date().toISOString(),
    };
    await this.write({
      ...state,
      account,
      audit: prependAudit(state.audit, 'refresh', 'Hosted account refreshed'),
    });
    return account;
  }

  async logout(): Promise<DesktopAccountStatus> {
    const state = await this.read();
    await this.write({
      ...state,
      encryptedToken: null,
      account: { ...defaultAccount, updatedAt: new Date().toISOString() },
      audit: prependAudit(state.audit, 'logout', 'Hosted account disconnected'),
    });
    return { ...defaultAccount, updatedAt: new Date().toISOString() };
  }

  async getSyncSettings(): Promise<DesktopSyncSettings> {
    return (await this.read()).syncSettings;
  }

  async updateSyncSettings(patch: Partial<DesktopSyncSettings>): Promise<DesktopSyncSettings> {
    const state = await this.read();
    const syncSettings = sanitizeSyncSettings({ ...state.syncSettings, ...patch });
    const account = {
      ...state.account,
      offlineMode: !syncSettings.sessions && !syncSettings.artifacts && !syncSettings.memories,
      syncState:
        !syncSettings.sessions && !syncSettings.artifacts && !syncSettings.memories
          ? ('offline' as const)
          : state.account.signedIn
            ? ('idle' as const)
            : ('offline' as const),
      updatedAt: new Date().toISOString(),
    };

    await this.write({
      ...state,
      account,
      syncSettings,
      audit: prependAudit(state.audit, 'sync-settings', 'Sync settings updated'),
    });
    return syncSettings;
  }

  async listQueue(): Promise<DesktopSyncQueueItem[]> {
    return (await this.read()).queue;
  }

  async listAudit(): Promise<DesktopAccountAuditEvent[]> {
    return (await this.read()).audit;
  }

  private async addAudit(
    type: DesktopAccountAuditEvent['type'],
    message: string
  ): Promise<void> {
    const state = await this.read();
    await this.write({ ...state, audit: prependAudit(state.audit, type, message) });
  }

  private async read(): Promise<PersistedAuthState> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      return sanitizeAuthState(JSON.parse(content));
    } catch {
      return {
        encryptedToken: null,
        account: { ...defaultAccount },
        syncSettings: { ...defaultSyncSettings },
        queue: [],
        audit: [],
      };
    }
  }

  private async write(state: PersistedAuthState): Promise<void> {
    await mkdir(dirname(this.stateFile), { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
}

function sanitizeAuthState(value: unknown): PersistedAuthState {
  if (!isRecord(value)) {
    return {
      encryptedToken: null,
      account: { ...defaultAccount },
      syncSettings: { ...defaultSyncSettings },
      queue: [],
      audit: [],
    };
  }

  return {
    encryptedToken: typeof value.encryptedToken === 'string' ? value.encryptedToken : null,
    account: sanitizeAccount(value.account),
    syncSettings: sanitizeSyncSettings(value.syncSettings),
    queue: Array.isArray(value.queue) ? value.queue.filter(isQueueItem).slice(0, 100) : [],
    audit: Array.isArray(value.audit) ? value.audit.filter(isAuditEvent).slice(0, 200) : [],
  };
}

function sanitizeAccount(value: unknown): DesktopAccountStatus {
  if (!isRecord(value)) {
    return { ...defaultAccount };
  }

  return {
    signedIn: value.signedIn === true,
    email: typeof value.email === 'string' ? value.email : null,
    plan: typeof value.plan === 'string' ? value.plan : null,
    credits: typeof value.credits === 'number' ? value.credits : null,
    syncState:
      value.syncState === 'idle' || value.syncState === 'syncing' || value.syncState === 'error'
        ? value.syncState
        : 'offline',
    offlineMode: value.offlineMode !== false,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  };
}

function sanitizeSyncSettings(value: unknown): DesktopSyncSettings {
  if (!isRecord(value)) {
    return { ...defaultSyncSettings };
  }

  return {
    sessions: value.sessions === true,
    artifacts: value.artifacts === true,
    memories: value.memories === true,
    conflictPolicy:
      value.conflictPolicy === 'local-wins' ||
      value.conflictPolicy === 'cloud-wins' ||
      value.conflictPolicy === 'ask'
        ? value.conflictPolicy
        : 'ask',
  };
}

function encryptToken(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `safe:${safeStorage.encryptString(token).toString('base64')}`;
  }

  return `plain:${Buffer.from(token, 'utf8').toString('base64')}`;
}

function decryptToken(value: string): string {
  if (value.startsWith('safe:') && safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(value.slice(5), 'base64'));
  }

  if (value.startsWith('plain:')) {
    return Buffer.from(value.slice(6), 'base64').toString('utf8');
  }

  return '';
}

function prependAudit(
  audit: DesktopAccountAuditEvent[],
  type: DesktopAccountAuditEvent['type'],
  message: string
): DesktopAccountAuditEvent[] {
  return [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      createdAt: new Date().toISOString(),
    },
    ...audit,
  ].slice(0, 200);
}

function generateDeviceCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isQueueItem(value: unknown): value is DesktopSyncQueueItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.reason === 'string';
}

function isAuditEvent(value: unknown): value is DesktopAccountAuditEvent {
  return isRecord(value) && typeof value.id === 'string' && typeof value.message === 'string';
}
