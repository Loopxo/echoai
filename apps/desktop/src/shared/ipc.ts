export const IPC_INVOKE_CHANNELS = [
  'app:getSnapshot',
  'app:selectWorkspace',
  'app:openWorkspace',
  'app:setLastRoute',
  'auth:getStatus',
  'auth:startDeviceLogin',
  'auth:refresh',
  'auth:logout',
  'sync:getSettings',
  'sync:updateSettings',
  'sync:listQueue',
  'account:listAudit',
  'logs:search',
  'shell:openExternal',
  'updates:check',
  'updates:download',
  'updates:install',
  'window:minimize',
  'window:maximizeToggle',
  'window:close',
  'window:getState',
] as const;

export const IPC_EVENT_CHANNELS = [
  'protocol:url',
  'updates:status',
  'notifications:push',
  'window:state',
] as const;

export type DesktopIpcInvokeChannel = (typeof IPC_INVOKE_CHANNELS)[number];
export type DesktopIpcEventChannel = (typeof IPC_EVENT_CHANNELS)[number];

export interface DesktopAppPaths {
  dataDir: string;
  logsDir: string;
  cacheDir: string;
  skillsDir: string;
  mcpDir: string;
  artifactsDir: string;
  sessionsDir: string;
}

export interface RecoveryWindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface RecoveryState {
  lastWorkspacePath: string | null;
  lastRoute: string;
  lastSessionId: string | null;
  lastProtocolUrl: string | null;
  lastWindowBounds: RecoveryWindowBounds | null;
  updatedAt: string | null;
}

export interface DesktopSecuritySummary {
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  remoteModule: false;
  webSecurity: true;
}

export interface DesktopAppSnapshot {
  version: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  paths: DesktopAppPaths;
  recovery: RecoveryState;
  recentWorkspaces: DesktopRecentWorkspace[];
  pendingProtocolUrls: string[];
  security: DesktopSecuritySummary;
  account: DesktopAccountStatus;
  syncSettings: DesktopSyncSettings;
}

export interface WorkspaceSelection {
  path: string;
  selectedAt: string;
}

export interface DesktopRecentWorkspace {
  path: string;
  lastActiveAt: string;
  sessionCount: number;
}

export interface LogSearchEntry {
  file: string;
  line: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export type DesktopUpdateState =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface DesktopUpdateStatus {
  state: DesktopUpdateState;
  checkedAt: string | null;
  version: string | null;
  downloadProgress: number | null;
  reason: string | null;
}

export interface DesktopNotification {
  id: string;
  kind: 'task' | 'permission' | 'update' | 'device' | 'system';
  title: string;
  body: string;
  createdAt: string;
}

export interface DesktopWindowState {
  isMaximized: boolean;
  isFullScreen: boolean;
}

export interface DesktopAccountStatus {
  signedIn: boolean;
  email: string | null;
  plan: string | null;
  credits: number | null;
  syncState: 'offline' | 'idle' | 'syncing' | 'error';
  offlineMode: boolean;
  updatedAt: string | null;
}

export interface DesktopDeviceLogin {
  verificationUrl: string;
  userCode: string;
  expiresAt: string;
}

export interface DesktopSyncSettings {
  sessions: boolean;
  artifacts: boolean;
  memories: boolean;
  conflictPolicy: 'local-wins' | 'cloud-wins' | 'ask';
}

export interface DesktopSyncQueueItem {
  id: string;
  type: 'session' | 'artifact' | 'memory';
  action: 'create' | 'update' | 'delete';
  status: 'queued' | 'syncing' | 'failed';
  createdAt: string;
  reason: string;
}

export interface DesktopAccountAuditEvent {
  id: string;
  type: 'login-started' | 'login-completed' | 'refresh' | 'logout' | 'sync-settings' | 'offline-mode';
  message: string;
  createdAt: string;
}

export interface EchoAIDesktopApi {
  getSnapshot: () => Promise<DesktopAppSnapshot>;
  selectWorkspace: () => Promise<WorkspaceSelection | null>;
  openWorkspace: (path: string) => Promise<WorkspaceSelection>;
  setLastRoute: (route: string) => Promise<void>;
  getAccountStatus: () => Promise<DesktopAccountStatus>;
  startDeviceLogin: () => Promise<DesktopDeviceLogin>;
  refreshAccount: () => Promise<DesktopAccountStatus>;
  logout: () => Promise<DesktopAccountStatus>;
  getSyncSettings: () => Promise<DesktopSyncSettings>;
  updateSyncSettings: (settings: Partial<DesktopSyncSettings>) => Promise<DesktopSyncSettings>;
  listSyncQueue: () => Promise<DesktopSyncQueueItem[]>;
  listAccountAudit: () => Promise<DesktopAccountAuditEvent[]>;
  searchLogs: (query: string) => Promise<LogSearchEntry[]>;
  openExternal: (url: string) => Promise<boolean>;
  checkForUpdates: () => Promise<DesktopUpdateStatus>;
  downloadUpdate: () => Promise<DesktopUpdateStatus>;
  installUpdate: () => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<DesktopWindowState>;
  closeWindow: () => Promise<void>;
  getWindowState: () => Promise<DesktopWindowState>;
  onProtocolUrl: (callback: (url: string) => void) => () => void;
  onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) => () => void;
  onNotification: (callback: (notification: DesktopNotification) => void) => () => void;
  onWindowState: (callback: (state: DesktopWindowState) => void) => () => void;
}

export function isIpcInvokeChannel(value: string): value is DesktopIpcInvokeChannel {
  return (IPC_INVOKE_CHANNELS as readonly string[]).includes(value);
}

export function isIpcEventChannel(value: string): value is DesktopIpcEventChannel {
  return (IPC_EVENT_CHANNELS as readonly string[]).includes(value);
}

export function isEchoAIProtocolUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'echoai:';
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
