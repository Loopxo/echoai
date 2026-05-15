import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_EVENT_CHANNELS,
  type DesktopAppSnapshot,
  type DesktopIpcEventChannel,
  type DesktopIpcInvokeChannel,
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

function subscribe(channel: DesktopIpcEventChannel, callback: (value: string) => void): () => void {
  if (!isIpcEventChannel(channel)) {
    throw new Error(`Blocked IPC event channel: ${channel}`);
  }

  const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
    if (typeof value === 'string') {
      callback(value);
    }
  };

  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: EchoAIDesktopApi = {
  getSnapshot: () => invoke<DesktopAppSnapshot>('app:getSnapshot'),
  selectWorkspace: () => invoke<WorkspaceSelection | null>('app:selectWorkspace'),
  setLastRoute: (route: string) => invoke<void>('app:setLastRoute', route),
  searchLogs: (query: string) => invoke<LogSearchEntry[]>('logs:search', query),
  openExternal: (url: string) => invoke<boolean>('shell:openExternal', url),
  onProtocolUrl: (callback: (url: string) => void) => subscribe('protocol:url', callback),
};

for (const channel of IPC_EVENT_CHANNELS) {
  if (!isIpcEventChannel(channel)) {
    throw new Error(`Invalid desktop event channel: ${channel}`);
  }
}

contextBridge.exposeInMainWorld('echoaiDesktop', api);
