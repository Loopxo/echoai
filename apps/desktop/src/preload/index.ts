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
  type DesktopArtifactEntry,
  type DesktopBrowserAutomationStatus,
  type DesktopBrowserProfile,
  type DesktopCanvasEntry,
  type DesktopChannelSetting,
  type DesktopCommandClassification,
  type DesktopComputerUseAudit,
  type DesktopFilePreview,
  type DesktopGatewayStatus,
  type DesktopGuiPermissionStatus,
  type DesktopMcpServer,
  type DesktopMcpToolInfo,
  type DesktopPairedDevice,
  type DesktopPairingRequest,
  type DesktopPrivacyDashboard,
  type DesktopPrivacyDeleteResult,
  type DesktopReleaseChecklistItem,
  type DesktopRemoteControlRequest,
  type DesktopSandboxStatus,
  type DesktopScheduledTask,
  type DesktopSkillEntry,
  type DesktopTaskRecord,
  type DesktopTelemetrySettings,
  type DesktopTerminalRunRequest,
  type DesktopToolSummary,
  type DesktopWorkspaceDiagnostic,
  type DesktopWorkspaceEntry,
  type DesktopWorkspaceIndex,
  type DesktopWorkspaceSearchResult,
  type DesktopWorkspaceSymbol,
  type DesktopDeviceLogin,
  type DesktopSyncQueueItem,
  type DesktopSyncSettings,
  type DesktopUpdateStatus,
  type DesktopWebAutomation,
  type DesktopWebChatRunRequest,
  type DesktopWebChatRunResult,
  type DesktopWebIntegration,
  type DesktopWebNote,
  type DesktopWebProject,
  type DesktopWebSearchResult,
  type DesktopWebSnapshot,
  type DesktopWebTicketStatus,
  type DesktopWebToolPolicy,
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
  listWorkspaceFiles: (rootPath: string) =>
    invoke<DesktopWorkspaceEntry[]>('workspace:listFiles', rootPath),
  previewWorkspaceFile: (rootPath: string, relativePath: string) =>
    invoke<DesktopFilePreview>('workspace:previewFile', rootPath, relativePath),
  searchWorkspace: (rootPath: string, query: string) =>
    invoke<DesktopWorkspaceSearchResult[]>('workspace:search', rootPath, query),
  listWorkspaceSymbols: (rootPath: string, query: string) =>
    invoke<DesktopWorkspaceSymbol[]>('workspace:listSymbols', rootPath, query),
  listWorkspaceDiagnostics: (rootPath: string) =>
    invoke<DesktopWorkspaceDiagnostic[]>('workspace:listDiagnostics', rootPath),
  indexWorkspace: (rootPath: string) => invoke<DesktopWorkspaceIndex>('workspace:index', rootPath),
  listRecentWorkspaceFiles: (rootPath: string) =>
    invoke<DesktopWorkspaceEntry[]>('workspace:listRecentFiles', rootPath),
  listArtifacts: () => invoke<DesktopArtifactEntry[]>('artifacts:list'),
  openArtifact: (path: string) => invoke<boolean>('artifacts:open', path),
  revealArtifact: (path: string) => invoke<boolean>('artifacts:reveal', path),
  runTerminalCommand: (request: DesktopTerminalRunRequest) =>
    invoke<DesktopTaskRecord>('terminal:run', request),
  stopTerminalTask: (taskId: string) => invoke<boolean>('terminal:stop', taskId),
  listTerminalTasks: () => invoke<DesktopTaskRecord[]>('terminal:listTasks'),
  getTerminalLog: (taskId: string) => invoke<string>('terminal:getLog', taskId),
  classifyCommand: (command: string) =>
    invoke<DesktopCommandClassification>('sandbox:classifyCommand', command),
  getSandboxStatus: () => invoke<DesktopSandboxStatus>('sandbox:getStatus'),
  listMcpServers: () => invoke<DesktopMcpServer[]>('mcp:listServers'),
  addMcpServer: (server: Omit<DesktopMcpServer, 'id' | 'createdAt'>) =>
    invoke<DesktopMcpServer>('mcp:addServer', server),
  removeMcpServer: (serverId: string) => invoke<boolean>('mcp:removeServer', serverId),
  testMcpServer: (serverId: string) => invoke<boolean>('mcp:testServer', serverId),
  listMcpTools: () => invoke<DesktopMcpToolInfo[]>('mcp:listTools'),
  listSkills: () => invoke<DesktopSkillEntry[]>('skills:list'),
  createSkill: (name: string, description: string) =>
    invoke<DesktopSkillEntry>('skills:create', name, description),
  deleteSkill: (skillId: string) => invoke<boolean>('skills:delete', skillId),
  listBrowserProfiles: () => invoke<DesktopBrowserProfile[]>('browser:listProfiles'),
  createBrowserProfile: (name: string, workspacePath?: string) =>
    invoke<DesktopBrowserProfile>('browser:createProfile', name, workspacePath),
  getBrowserAutomationStatus: () =>
    invoke<DesktopBrowserAutomationStatus>('browser:getAutomationStatus'),
  getGuiPermissionStatus: () => invoke<DesktopGuiPermissionStatus>('gui:getPermissionStatus'),
  requestComputerAction: (action: string) =>
    invoke<DesktopComputerUseAudit>('computer:requestAction', action),
  listCanvasEntries: () => invoke<DesktopCanvasEntry[]>('canvas:list'),
  openCanvasEntry: (title: string) => invoke<DesktopCanvasEntry>('canvas:open', title),
  summarizeToolOutput: (output: string) => invoke<DesktopToolSummary>('tools:summarizeOutput', output),
  getGatewayStatus: () => invoke<DesktopGatewayStatus>('gateway:getStatus'),
  startGateway: (preferredPort?: number) =>
    invoke<DesktopGatewayStatus>('gateway:start', preferredPort),
  stopGateway: () => invoke<DesktopGatewayStatus>('gateway:stop'),
  listPairingRequests: () => invoke<DesktopPairingRequest[]>('devices:listPairingRequests'),
  createPairingRequest: (deviceName: string, deviceType: DesktopPairingRequest['deviceType']) =>
    invoke<DesktopPairingRequest>('devices:createPairingRequest', deviceName, deviceType),
  respondPairingRequest: (requestId: string, approved: boolean) =>
    invoke<DesktopPairingRequest | null>('devices:respondPairingRequest', requestId, approved),
  listPairedDevices: () => invoke<DesktopPairedDevice[]>('devices:listPaired'),
  revokePairedDevice: (deviceId: string) => invoke<boolean>('devices:revoke', deviceId),
  listRemoteControls: () => invoke<DesktopRemoteControlRequest[]>('remote:listControls'),
  submitRemoteControl: (
    source: DesktopRemoteControlRequest['source'],
    prompt: string,
    workspacePath?: string
  ) => invoke<DesktopRemoteControlRequest>('remote:submitControl', source, prompt, workspacePath),
  approveRemoteControl: (requestId: string, approved: boolean) =>
    invoke<DesktopRemoteControlRequest | null>('remote:approveControl', requestId, approved),
  listChannelSettings: () => invoke<DesktopChannelSetting[]>('channels:list'),
  updateChannelSetting: (channelId: string, patch: Partial<DesktopChannelSetting>) =>
    invoke<DesktopChannelSetting>('channels:update', channelId, patch),
  listScheduledTasks: () => invoke<DesktopScheduledTask[]>('scheduled:list'),
  createScheduledTask: (input: {
    title: string;
    prompt: string;
    schedule: string;
    workspacePath?: string;
  }) => invoke<DesktopScheduledTask>('scheduled:create', input),
  deleteScheduledTask: (taskId: string) => invoke<boolean>('scheduled:delete', taskId),
  getPrivacyDashboard: () => invoke<DesktopPrivacyDashboard>('privacy:getDashboard'),
  exportPrivacyData: () => invoke<string>('privacy:exportData'),
  deleteLocalPrivacyData: () => invoke<DesktopPrivacyDeleteResult>('privacy:deleteLocalData'),
  getTelemetrySettings: () => invoke<DesktopTelemetrySettings>('telemetry:getSettings'),
  updateTelemetrySettings: (patch: Partial<DesktopTelemetrySettings>) =>
    invoke<DesktopTelemetrySettings>('telemetry:updateSettings', patch),
  getReleaseChecklist: () => invoke<DesktopReleaseChecklistItem[]>('release:getChecklist'),
  getWebAppSnapshot: () => invoke<DesktopWebSnapshot>('webapp:getSnapshot'),
  getWebAppTickets: () => invoke<DesktopWebTicketStatus[]>('webapp:getTickets'),
  searchWebApp: (query: string) => invoke<DesktopWebSearchResult[]>('webapp:search', query),
  runWebAppChat: (request: DesktopWebChatRunRequest) =>
    invoke<DesktopWebChatRunResult>('webapp:runChat', request),
  createWebProject: (name: string, description: string) =>
    invoke<DesktopWebProject>('webapp:createProject', name, description),
  createWebNote: (title: string, body: string, projectId?: string) =>
    invoke<DesktopWebNote>('webapp:createNote', title, body, projectId),
  createWebAutomation: (name: string, prompt: string, schedule: string, projectId?: string) =>
    invoke<DesktopWebAutomation>('webapp:createAutomation', name, prompt, schedule, projectId),
  toggleWebIntegration: (integrationId: string) =>
    invoke<DesktopWebIntegration | null>('webapp:toggleIntegration', integrationId),
  updateWebMemoryPrivacy: (patch: Partial<DesktopWebSnapshot['memoryPrivacy']>) =>
    invoke<DesktopWebSnapshot['memoryPrivacy']>('webapp:updateMemoryPrivacy', patch),
  updateWebToolPolicy: (category: string, policy: DesktopWebToolPolicy) =>
    invoke<Record<string, DesktopWebToolPolicy>>('webapp:updateToolPolicy', category, policy),
  exportWebAppData: () => invoke<string>('webapp:exportData'),
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
  onTaskUpdate: (callback: (task: DesktopTaskRecord) => void) =>
    subscribe('tasks:update', callback, isDesktopTaskRecord),
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

function isDesktopTaskRecord(value: unknown): value is DesktopTaskRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'string'
  );
}
