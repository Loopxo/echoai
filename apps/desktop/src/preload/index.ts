import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_EVENT_CHANNELS,
  type DesktopAppSnapshot,
  type DesktopIpcEventChannel,
  type DesktopIpcInvokeChannel,
  type DesktopAccountAuditEvent,
  type DesktopAccountStatus,
  type DesktopNotification,
  type DesktopRuntimeEvent,
  type DesktopRuntimeRunHandle,
  type DesktopRuntimeRunRequest,
  type DesktopRuntimeSessionSummary,
  type DesktopRuntimeStatus,
  type DesktopDeviceLogin,
  type DesktopSyncQueueItem,
  type DesktopSyncSettings,
  type DesktopUpdateStatus,
  type DesktopWindowState,
  type EchoAIDesktopApi,
  type LogSearchEntry,
  type WorkspaceSelection,
  isIpcEventChannel,
  isIpcInvokeChannel,
} from '@shared/ipc';

function invoke<T>(channel: DesktopIpcInvokeChannel, ...args: unknown[]): Promise<T> {
  if (!isIpcInvokeChannel(channel)) {
    return Promise.reject(new Error(`Blocked IPC invoke channel: ${channel}`));
  }

  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function subscribe<T>(
  channel: DesktopIpcEventChannel,
  callback: (value: T) => void,
  guard: (value: unknown) => value is T
): () => void {
  if (!isIpcEventChannel(channel)) {
    throw new Error(`Blocked IPC event channel: ${channel}`);
  }

  const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
    if (guard(value)) {
      callback(value);
    }
  };

  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: EchoAIDesktopApi = {
  getSnapshot: () => invoke<DesktopAppSnapshot>('app:getSnapshot'),
  selectWorkspace: () => invoke<WorkspaceSelection | null>('app:selectWorkspace'),
  openWorkspace: (path: string) => invoke<WorkspaceSelection>('app:openWorkspace', path),
  setLastRoute: (route: string) => invoke<void>('app:setLastRoute', route),
  getAccountStatus: () => invoke<DesktopAccountStatus>('auth:getStatus'),
  startDeviceLogin: () => invoke<DesktopDeviceLogin>('auth:startDeviceLogin'),
  refreshAccount: () => invoke<DesktopAccountStatus>('auth:refresh'),
  logout: () => invoke<DesktopAccountStatus>('auth:logout'),
  getSyncSettings: () => invoke<DesktopSyncSettings>('sync:getSettings'),
  updateSyncSettings: (settings: Partial<DesktopSyncSettings>) =>
    invoke<DesktopSyncSettings>('sync:updateSettings', settings),
  listSyncQueue: () => invoke<DesktopSyncQueueItem[]>('sync:listQueue'),
  listAccountAudit: () => invoke<DesktopAccountAuditEvent[]>('account:listAudit'),
  getRuntimeStatus: () => invoke<DesktopRuntimeStatus>('runtime:getStatus'),
  listRuntimeSessions: () => invoke<DesktopRuntimeSessionSummary[]>('runtime:listSessions'),
  createRuntimeSession: (title: string) =>
    invoke<DesktopRuntimeSessionSummary>('runtime:createSession', title),
  runPrompt: (request: DesktopRuntimeRunRequest) =>
    invoke<DesktopRuntimeRunHandle>('runtime:runPrompt', request),
  cancelRun: (runId: string) => invoke<boolean>('runtime:cancelRun', runId),
  getRuntimeSession: (sessionId: string) =>
    invoke<DesktopRuntimeSessionSummary | null>('runtime:getSession', sessionId),
  exportRuntimeSession: (sessionId: string) => invoke<string>('runtime:exportSession', sessionId),
  searchLogs: (query: string) => invoke<LogSearchEntry[]>('logs:search', query),
  openExternal: (url: string) => invoke<boolean>('shell:openExternal', url),
  checkForUpdates: () => invoke<DesktopUpdateStatus>('updates:check'),
  downloadUpdate: () => invoke<DesktopUpdateStatus>('updates:download'),
  installUpdate: () => invoke<boolean>('updates:install'),
  minimizeWindow: () => invoke<void>('window:minimize'),
  maximizeWindow: () => invoke<DesktopWindowState>('window:maximizeToggle'),
  closeWindow: () => invoke<void>('window:close'),
  getWindowState: () => invoke<DesktopWindowState>('window:getState'),
  onProtocolUrl: (callback: (url: string) => void) =>
    subscribe('protocol:url', callback, isString),
  onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) =>
    subscribe('updates:status', callback, isDesktopUpdateStatus),
  onNotification: (callback: (notification: DesktopNotification) => void) =>
    subscribe('notifications:push', callback, isDesktopNotification),
  onRuntimeEvent: (callback: (event: DesktopRuntimeEvent) => void) =>
    subscribe('runtime:event', callback, isDesktopRuntimeEvent),
  onWindowState: (callback: (state: DesktopWindowState) => void) =>
    subscribe('window:state', callback, isDesktopWindowState),
};

for (const channel of IPC_EVENT_CHANNELS) {
  if (!isIpcEventChannel(channel)) {
    throw new Error(`Invalid desktop event channel: ${channel}`);
  }
}

contextBridge.exposeInMainWorld('echoaiDesktop', api);

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isDesktopUpdateStatus(value: unknown): value is DesktopUpdateStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    typeof (value as { state: unknown }).state === 'string'
  );
}

function isDesktopNotification(value: unknown): value is DesktopNotification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof (value as { title: unknown }).title === 'string' &&
    'body' in value &&
    typeof (value as { body: unknown }).body === 'string'
  );
}

function isDesktopWindowState(value: unknown): value is DesktopWindowState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isMaximized' in value &&
    typeof (value as { isMaximized: unknown }).isMaximized === 'boolean' &&
    'isFullScreen' in value &&
    typeof (value as { isFullScreen: unknown }).isFullScreen === 'boolean'
  );
}

function isDesktopRuntimeEvent(value: unknown): value is DesktopRuntimeEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'runId' in value &&
    typeof (value as { runId: unknown }).runId === 'string' &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  );
}
