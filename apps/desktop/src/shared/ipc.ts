export const IPC_INVOKE_CHANNELS = [
  'app:getSnapshot',
  'app:selectWorkspace',
  'app:setLastRoute',
  'logs:search',
  'shell:openExternal',
] as const;

export const IPC_EVENT_CHANNELS = ['protocol:url'] as const;

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
  pendingProtocolUrls: string[];
  security: DesktopSecuritySummary;
}

export interface WorkspaceSelection {
  path: string;
  selectedAt: string;
}

export interface LogSearchEntry {
  file: string;
  line: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface EchoAIDesktopApi {
  getSnapshot: () => Promise<DesktopAppSnapshot>;
  selectWorkspace: () => Promise<WorkspaceSelection | null>;
  setLastRoute: (route: string) => Promise<void>;
  searchLogs: (query: string) => Promise<LogSearchEntry[]>;
  openExternal: (url: string) => Promise<boolean>;
  onProtocolUrl: (callback: (url: string) => void) => () => void;
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
