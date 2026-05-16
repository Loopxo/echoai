export const IPC_INVOKE_CHANNELS = [
  'app:getSnapshot',
  'app:selectWorkspace',
  'app:openWorkspace',
  'app:setLastRoute',
  'desktop:getWorkbenchSnapshot',
  'desktop:createWorkbenchProject',
  'desktop:addWorkbenchMemory',
  'desktop:pinWorkbenchMemory',
  'desktop:createWorkbenchApproval',
  'desktop:respondWorkbenchApproval',
  'desktop:startWorkbenchWorkflow',
  'auth:getStatus',
  'auth:startDeviceLogin',
  'auth:refresh',
  'auth:logout',
  'sync:getSettings',
  'sync:updateSettings',
  'sync:listQueue',
  'account:listAudit',
  'runtime:getStatus',
  'runtime:listSessions',
  'runtime:createSession',
  'runtime:runPrompt',
  'runtime:cancelRun',
  'runtime:getSession',
  'runtime:exportSession',
  'workspace:listFiles',
  'workspace:previewFile',
  'workspace:search',
  'workspace:listSymbols',
  'workspace:listDiagnostics',
  'workspace:index',
  'workspace:listRecentFiles',
  'artifacts:list',
  'artifacts:open',
  'artifacts:reveal',
  'terminal:run',
  'terminal:stop',
  'terminal:listTasks',
  'terminal:getLog',
  'sandbox:classifyCommand',
  'sandbox:getStatus',
  'mcp:listServers',
  'mcp:addServer',
  'mcp:removeServer',
  'mcp:testServer',
  'mcp:listTools',
  'skills:list',
  'skills:create',
  'skills:delete',
  'browser:listProfiles',
  'browser:createProfile',
  'browser:getAutomationStatus',
  'gui:getPermissionStatus',
  'computer:requestAction',
  'canvas:list',
  'canvas:open',
  'tools:summarizeOutput',
  'gateway:getStatus',
  'gateway:start',
  'gateway:stop',
  'devices:listPairingRequests',
  'devices:createPairingRequest',
  'devices:respondPairingRequest',
  'devices:listPaired',
  'devices:revoke',
  'remote:listControls',
  'remote:submitControl',
  'remote:approveControl',
  'channels:list',
  'channels:update',
  'scheduled:list',
  'scheduled:create',
  'scheduled:delete',
  'privacy:getDashboard',
  'privacy:exportData',
  'privacy:deleteLocalData',
  'telemetry:getSettings',
  'telemetry:updateSettings',
  'release:getChecklist',
  'webapp:getSnapshot',
  'webapp:getTickets',
  'webapp:search',
  'webapp:runChat',
  'webapp:createProject',
  'webapp:createNote',
  'webapp:createAutomation',
  'webapp:toggleIntegration',
  'webapp:updateMemoryPrivacy',
  'webapp:updateToolPolicy',
  'webapp:exportData',
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
  'runtime:event',
  'tasks:update',
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

export type DesktopOperationStatus =
  | 'queued'
  | 'running'
  | 'needs_approval'
  | 'blocked'
  | 'failed'
  | 'completed'
  | 'cancelled';

export type DesktopSourceRepo = 'open-cowork' | 'eigent' | 'overlay-web';

export interface DesktopSampleAudit {
  repo: DesktopSourceRepo;
  label: string;
  licenseFinding: 'missing' | 'apache-template' | 'unknown';
  copyPolicy: 'reference-only' | 'small-compatible-snippets' | 'blocked';
  strengths: string[];
  risks: string[];
  checkedAt: string;
}

export interface DesktopParityMetric {
  id: string;
  label: string;
  echoaiLevel: number;
  targetLevel: number;
  source: DesktopSourceRepo;
  status: 'ahead' | 'at-parity' | 'behind';
}

export interface DesktopCapabilityTicket {
  id: string;
  area: string;
  title: string;
  status: 'complete';
  maturity: 'foundation' | 'integrated' | 'production-ready';
  evidence: string;
  sourceInfluence: DesktopSourceRepo[];
}

export interface DesktopWorkbenchProject {
  id: string;
  name: string;
  description: string;
  workspacePath: string | null;
  status: 'active' | 'archived';
  lastActiveAt: string;
}

export interface DesktopWorkbenchMemory {
  id: string;
  scope: 'global' | 'workspace' | 'project';
  text: string;
  source: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

export interface DesktopWorkbenchApproval {
  id: string;
  title: string;
  detail: string;
  risk: DesktopCommandRisk;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
}

export interface DesktopWorkflowNode {
  id: string;
  label: string;
  status: DesktopOperationStatus;
  owner: 'agent' | 'user' | 'system';
  detail: string;
}

export interface DesktopWorkflowRun {
  id: string;
  title: string;
  status: DesktopOperationStatus;
  nodes: DesktopWorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

export interface DesktopBrowserSession {
  id: string;
  profileName: string;
  workspacePath: string | null;
  status: DesktopOperationStatus;
  currentUrl: string | null;
  actionCount: number;
  createdAt: string;
}

export interface DesktopServiceHealth {
  id: string;
  label: string;
  status: 'ready' | 'degraded' | 'blocked';
  detail: string;
}

export interface DesktopWorkbenchSnapshot {
  generatedAt: string;
  productPosture: string;
  copyPolicy: string;
  localFirst: boolean;
  activeWorkspacePath: string | null;
  sampleAudits: DesktopSampleAudit[];
  parityMetrics: DesktopParityMetric[];
  capabilities: DesktopCapabilityTicket[];
  projects: DesktopWorkbenchProject[];
  activeProjectId: string | null;
  memories: DesktopWorkbenchMemory[];
  approvals: DesktopWorkbenchApproval[];
  workflows: DesktopWorkflowRun[];
  browserSessions: DesktopBrowserSession[];
  serviceHealth: DesktopServiceHealth[];
  releaseReadiness: DesktopReleaseChecklistItem[];
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

export interface DesktopRuntimeStatus {
  activeRuns: number;
  sessionCount: number;
  provider: string;
  model: string;
}

export interface DesktopRuntimeSessionSummary {
  id: string;
  title: string;
  provider: string | null;
  model: string | null;
  mode: 'default' | 'plan';
  messageCount: number;
  artifactCount: number;
  updatedAt: number;
}

export interface DesktopRuntimeRunRequest {
  sessionId?: string;
  input: string;
  workspaceRoot?: string;
  mode?: 'default' | 'plan';
  provider?: string;
  model?: string;
}

export interface DesktopRuntimeRunHandle {
  runId: string;
}

export interface DesktopRuntimeEvent {
  runId: string;
  type: string;
  sessionId: string | null;
  createdAt: string;
  payload: unknown;
}

export type DesktopWorkspaceEntryKind = 'file' | 'directory';

export interface DesktopWorkspaceEntry {
  path: string;
  name: string;
  kind: DesktopWorkspaceEntryKind;
  size: number;
  modifiedAt: number;
}

export interface DesktopFilePreview {
  path: string;
  name: string;
  kind: 'text' | 'code' | 'markdown' | 'image' | 'pdf' | 'csv' | 'binary' | 'missing';
  size: number;
  modifiedAt: number | null;
  content: string | null;
  mediaPath: string | null;
}

export interface DesktopWorkspaceSearchResult {
  path: string;
  line: number | null;
  preview: string;
}

export interface DesktopWorkspaceSymbol {
  path: string;
  name: string;
  kind: 'function' | 'class' | 'type' | 'constant' | 'heading';
  line: number;
}

export interface DesktopWorkspaceDiagnostic {
  path: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  line: number | null;
}

export interface DesktopWorkspaceIndex {
  root: string;
  fileCount: number;
  directoryCount: number;
  indexedAt: string;
  ignoredPaths: string[];
}

export interface DesktopArtifactEntry {
  path: string;
  name: string;
  type: 'diff' | 'file' | 'report' | 'log' | 'other';
  size: number;
  modifiedAt: number;
}

export type DesktopCommandRisk = 'safe' | 'ask' | 'deny';

export interface DesktopCommandClassification {
  risk: DesktopCommandRisk;
  reason: string;
}

export interface DesktopTerminalRunRequest {
  command: string;
  cwd: string;
}

export interface DesktopTaskRecord {
  id: string;
  command: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'denied';
  classification: DesktopCommandClassification;
  exitCode: number | null;
  startedAt: string;
  updatedAt: string;
  logPath: string;
}

export interface DesktopSandboxStatus {
  native: 'available';
  wsl: 'available' | 'missing' | 'unsupported';
  lima: 'available' | 'missing' | 'unsupported';
  platform: NodeJS.Platform;
}

export interface DesktopMcpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  createdAt: string;
}

export interface DesktopMcpToolInfo {
  serverId: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface DesktopSkillEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  updatedAt: string;
}

export interface DesktopBrowserProfile {
  id: string;
  name: string;
  workspacePath: string | null;
  createdAt: string;
}

export interface DesktopBrowserAutomationStatus {
  installed: boolean;
  activeProfileId: string | null;
  message: string;
}

export interface DesktopGuiPermissionStatus {
  screenRecording: 'unknown' | 'granted' | 'missing';
  accessibility: 'unknown' | 'granted' | 'missing';
}

export interface DesktopComputerUseAudit {
  id: string;
  action: string;
  status: 'queued' | 'requires-permission';
  createdAt: string;
}

export interface DesktopCanvasEntry {
  id: string;
  title: string;
  path: string;
  createdAt: string;
}

export interface DesktopToolSummary {
  lineCount: number;
  charCount: number;
  preview: string;
  truncated: boolean;
}

export interface DesktopGatewayStatus {
  running: boolean;
  host: string;
  port: number | null;
  url: string | null;
  startedAt: string | null;
  protocolVersion: string;
  pairedDeviceCount: number;
  pendingPairingCount: number;
  remoteHandoffCount: number;
  scheduledTaskCount: number;
  telemetryEnabled: boolean;
}

export interface DesktopPairingRequest {
  id: string;
  deviceName: string;
  deviceType: 'mobile' | 'web' | 'desktop' | 'unknown';
  code: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

export interface DesktopPairedDevice {
  id: string;
  name: string;
  type: DesktopPairingRequest['deviceType'];
  trustedAt: string;
  lastSeenAt: string;
  scopes: string[];
}

export interface DesktopRemoteControlRequest {
  id: string;
  source: 'mobile' | 'web';
  prompt: string;
  workspacePath: string | null;
  status: 'queued' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
}

export interface DesktopChannelSetting {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  webhookUrl: string | null;
  updatedAt: string;
}

export interface DesktopScheduledTask {
  id: string;
  title: string;
  prompt: string;
  schedule: string;
  workspacePath: string | null;
  enabled: boolean;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesktopTelemetrySettings {
  enabled: boolean;
  orgAllowed: boolean;
  promptContentAllowed: boolean;
  updatedAt: string | null;
}

export interface DesktopPrivacyLocalDataItem {
  label: string;
  path: string;
  boundary: 'local';
}

export interface DesktopPrivacyCloudDataItem {
  label: string;
  enabled: boolean;
}

export interface DesktopPrivacyDashboard {
  localData: DesktopPrivacyLocalDataItem[];
  cloudData: DesktopPrivacyCloudDataItem[];
  pairedDevices: number;
  pendingPairingRequests: number;
  telemetry: DesktopTelemetrySettings;
  generatedAt: string;
}

export interface DesktopPrivacyDeleteResult {
  deletedAt: string;
  resetPairingRequests: boolean;
  resetPairedDevices: boolean;
  resetRemoteControls: boolean;
  resetTelemetry: boolean;
}

export interface DesktopReleaseChecklistItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'blocked';
  detail: string;
}

export type DesktopWebRunMode = 'ask' | 'act' | 'code' | 'research' | 'media' | 'automation';
export type DesktopWebModelMode = 'hosted' | 'free' | 'byok' | 'local';
export type DesktopWebToolPolicy = 'allow' | 'ask' | 'deny';

export interface DesktopWebFeatureFlags {
  freeModels: boolean;
  media: boolean;
  integrations: boolean;
  automations: boolean;
  desktopHandoff: boolean;
  mobileHandoff: boolean;
  browserAutomation: boolean;
  codeSandbox: boolean;
  memoryAutoSave: boolean;
}

export interface DesktopWebMetric {
  label: string;
  value: string;
}

export interface DesktopWebModel {
  id: string;
  provider: string;
  label: string;
  mode: DesktopWebModelMode;
  capabilities: string[];
  contextTokens: number;
  inputUsdMicros: number;
  outputUsdMicros: number;
  fallbackModelId: string | null;
  healthy: boolean;
}

export interface DesktopWebProject {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  updatedAt: string;
}

export interface DesktopWebConversation {
  id: string;
  projectId: string | null;
  title: string;
  modelId: string;
  mode: DesktopWebRunMode;
  shared: boolean;
  updatedAt: string;
}

export interface DesktopWebMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  modelId: string | null;
  createdAt: string;
}

export interface DesktopWebToolCall {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'requires-approval' | 'completed' | 'failed';
  policy: DesktopWebToolPolicy;
  preview: string;
}

export interface DesktopWebFile {
  id: string;
  projectId: string | null;
  name: string;
  kind: 'pdf' | 'image' | 'markdown' | 'code' | 'csv' | 'docx' | 'text';
  status: 'uploaded' | 'extracting' | 'indexed' | 'failed';
  embeddingStatus: 'queued' | 'ready' | 'disabled';
  sizeBytes: number;
}

export interface DesktopWebMemory {
  id: string;
  scope: 'global' | 'workspace' | 'project';
  text: string;
  approved: boolean;
  tags: string[];
}

export interface DesktopWebNote {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
}

export interface DesktopWebAutomation {
  id: string;
  projectId: string | null;
  name: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  outputTarget: 'chat' | 'note' | 'report' | 'webhook';
  nextRunAt: string;
}

export interface DesktopWebIntegration {
  id: string;
  name: string;
  category: 'chat' | 'storage' | 'calendar' | 'issue-tracker' | 'browser' | 'sandbox';
  connected: boolean;
  oauth: boolean;
  exposedTools: string[];
}

export interface DesktopWebDevice {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'browser';
  status: 'online' | 'offline' | 'pending' | 'revoked';
  scopes: string[];
  lastSeenAt: string | null;
}

export interface DesktopWebUsageEntry {
  id: string;
  modelId: string;
  billingMode: DesktopWebModelMode;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  createdAt: string;
}

export interface DesktopWebAuditEvent {
  id: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface DesktopWebTicketStatus {
  id: string;
  area: string;
  title: string;
  status: 'complete';
  evidence: string;
}

export interface DesktopWebSearchResult {
  id: string;
  type: 'session' | 'project' | 'note' | 'file' | 'memory' | 'setting';
  title: string;
  detail: string;
}

export interface DesktopWebSnapshot {
  identity: {
    email: string;
    organization: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    plan: 'free' | 'pro' | 'team' | 'enterprise';
  };
  metrics: DesktopWebMetric[];
  featureFlags: DesktopWebFeatureFlags;
  projects: DesktopWebProject[];
  conversations: DesktopWebConversation[];
  messages: DesktopWebMessage[];
  toolCalls: DesktopWebToolCall[];
  files: DesktopWebFile[];
  memories: DesktopWebMemory[];
  notes: DesktopWebNote[];
  automations: DesktopWebAutomation[];
  integrations: DesktopWebIntegration[];
  models: DesktopWebModel[];
  devices: DesktopWebDevice[];
  usage: DesktopWebUsageEntry[];
  auditEvents: DesktopWebAuditEvent[];
  memoryPrivacy: {
    enabled: boolean;
    autoSave: boolean;
    exportable: boolean;
  };
  toolPolicies: Record<string, DesktopWebToolPolicy>;
  ticketSummary: {
    total: number;
    complete: number;
    updatedAt: string;
  };
}

export interface DesktopWebChatRunRequest {
  conversationId?: string;
  projectId?: string;
  prompt: string;
  modelId: string;
  mode: DesktopWebRunMode;
}

export interface DesktopWebChatRunResult {
  runId: string;
  conversation: DesktopWebConversation;
  userMessage: DesktopWebMessage;
  assistantMessage: DesktopWebMessage;
  usage: DesktopWebUsageEntry;
}

export interface EchoAIDesktopApi {
  getSnapshot: () => Promise<DesktopAppSnapshot>;
  selectWorkspace: () => Promise<WorkspaceSelection | null>;
  openWorkspace: (path: string) => Promise<WorkspaceSelection>;
  setLastRoute: (route: string) => Promise<void>;
  getWorkbenchSnapshot: () => Promise<DesktopWorkbenchSnapshot>;
  createWorkbenchProject: (
    name: string,
    description: string,
    workspacePath?: string
  ) => Promise<DesktopWorkbenchProject>;
  addWorkbenchMemory: (input: {
    scope: DesktopWorkbenchMemory['scope'];
    text: string;
    source: string;
    tags?: string[];
  }) => Promise<DesktopWorkbenchMemory>;
  pinWorkbenchMemory: (memoryId: string, pinned: boolean) => Promise<DesktopWorkbenchMemory | null>;
  createWorkbenchApproval: (
    title: string,
    detail: string,
    risk: DesktopCommandRisk
  ) => Promise<DesktopWorkbenchApproval>;
  respondWorkbenchApproval: (
    approvalId: string,
    approved: boolean
  ) => Promise<DesktopWorkbenchApproval | null>;
  startWorkbenchWorkflow: (title: string) => Promise<DesktopWorkflowRun>;
  getAccountStatus: () => Promise<DesktopAccountStatus>;
  startDeviceLogin: () => Promise<DesktopDeviceLogin>;
  refreshAccount: () => Promise<DesktopAccountStatus>;
  logout: () => Promise<DesktopAccountStatus>;
  getSyncSettings: () => Promise<DesktopSyncSettings>;
  updateSyncSettings: (settings: Partial<DesktopSyncSettings>) => Promise<DesktopSyncSettings>;
  listSyncQueue: () => Promise<DesktopSyncQueueItem[]>;
  listAccountAudit: () => Promise<DesktopAccountAuditEvent[]>;
  getRuntimeStatus: () => Promise<DesktopRuntimeStatus>;
  listRuntimeSessions: () => Promise<DesktopRuntimeSessionSummary[]>;
  createRuntimeSession: (title: string) => Promise<DesktopRuntimeSessionSummary>;
  runPrompt: (request: DesktopRuntimeRunRequest) => Promise<DesktopRuntimeRunHandle>;
  cancelRun: (runId: string) => Promise<boolean>;
  getRuntimeSession: (sessionId: string) => Promise<DesktopRuntimeSessionSummary | null>;
  exportRuntimeSession: (sessionId: string) => Promise<string>;
  listWorkspaceFiles: (rootPath: string) => Promise<DesktopWorkspaceEntry[]>;
  previewWorkspaceFile: (rootPath: string, relativePath: string) => Promise<DesktopFilePreview>;
  searchWorkspace: (rootPath: string, query: string) => Promise<DesktopWorkspaceSearchResult[]>;
  listWorkspaceSymbols: (rootPath: string, query: string) => Promise<DesktopWorkspaceSymbol[]>;
  listWorkspaceDiagnostics: (rootPath: string) => Promise<DesktopWorkspaceDiagnostic[]>;
  indexWorkspace: (rootPath: string) => Promise<DesktopWorkspaceIndex>;
  listRecentWorkspaceFiles: (rootPath: string) => Promise<DesktopWorkspaceEntry[]>;
  listArtifacts: () => Promise<DesktopArtifactEntry[]>;
  openArtifact: (path: string) => Promise<boolean>;
  revealArtifact: (path: string) => Promise<boolean>;
  runTerminalCommand: (request: DesktopTerminalRunRequest) => Promise<DesktopTaskRecord>;
  stopTerminalTask: (taskId: string) => Promise<boolean>;
  listTerminalTasks: () => Promise<DesktopTaskRecord[]>;
  getTerminalLog: (taskId: string) => Promise<string>;
  classifyCommand: (command: string) => Promise<DesktopCommandClassification>;
  getSandboxStatus: () => Promise<DesktopSandboxStatus>;
  listMcpServers: () => Promise<DesktopMcpServer[]>;
  addMcpServer: (server: Omit<DesktopMcpServer, 'id' | 'createdAt'>) => Promise<DesktopMcpServer>;
  removeMcpServer: (serverId: string) => Promise<boolean>;
  testMcpServer: (serverId: string) => Promise<boolean>;
  listMcpTools: () => Promise<DesktopMcpToolInfo[]>;
  listSkills: () => Promise<DesktopSkillEntry[]>;
  createSkill: (name: string, description: string) => Promise<DesktopSkillEntry>;
  deleteSkill: (skillId: string) => Promise<boolean>;
  listBrowserProfiles: () => Promise<DesktopBrowserProfile[]>;
  createBrowserProfile: (name: string, workspacePath?: string) => Promise<DesktopBrowserProfile>;
  getBrowserAutomationStatus: () => Promise<DesktopBrowserAutomationStatus>;
  getGuiPermissionStatus: () => Promise<DesktopGuiPermissionStatus>;
  requestComputerAction: (action: string) => Promise<DesktopComputerUseAudit>;
  listCanvasEntries: () => Promise<DesktopCanvasEntry[]>;
  openCanvasEntry: (title: string) => Promise<DesktopCanvasEntry>;
  summarizeToolOutput: (output: string) => Promise<DesktopToolSummary>;
  getGatewayStatus: () => Promise<DesktopGatewayStatus>;
  startGateway: (preferredPort?: number) => Promise<DesktopGatewayStatus>;
  stopGateway: () => Promise<DesktopGatewayStatus>;
  listPairingRequests: () => Promise<DesktopPairingRequest[]>;
  createPairingRequest: (
    deviceName: string,
    deviceType: DesktopPairingRequest['deviceType']
  ) => Promise<DesktopPairingRequest>;
  respondPairingRequest: (
    requestId: string,
    approved: boolean
  ) => Promise<DesktopPairingRequest | null>;
  listPairedDevices: () => Promise<DesktopPairedDevice[]>;
  revokePairedDevice: (deviceId: string) => Promise<boolean>;
  listRemoteControls: () => Promise<DesktopRemoteControlRequest[]>;
  submitRemoteControl: (
    source: DesktopRemoteControlRequest['source'],
    prompt: string,
    workspacePath?: string
  ) => Promise<DesktopRemoteControlRequest>;
  approveRemoteControl: (
    requestId: string,
    approved: boolean
  ) => Promise<DesktopRemoteControlRequest | null>;
  listChannelSettings: () => Promise<DesktopChannelSetting[]>;
  updateChannelSetting: (
    channelId: string,
    patch: Partial<DesktopChannelSetting>
  ) => Promise<DesktopChannelSetting>;
  listScheduledTasks: () => Promise<DesktopScheduledTask[]>;
  createScheduledTask: (input: {
    title: string;
    prompt: string;
    schedule: string;
    workspacePath?: string;
  }) => Promise<DesktopScheduledTask>;
  deleteScheduledTask: (taskId: string) => Promise<boolean>;
  getPrivacyDashboard: () => Promise<DesktopPrivacyDashboard>;
  exportPrivacyData: () => Promise<string>;
  deleteLocalPrivacyData: () => Promise<DesktopPrivacyDeleteResult>;
  getTelemetrySettings: () => Promise<DesktopTelemetrySettings>;
  updateTelemetrySettings: (
    patch: Partial<DesktopTelemetrySettings>
  ) => Promise<DesktopTelemetrySettings>;
  getReleaseChecklist: () => Promise<DesktopReleaseChecklistItem[]>;
  getWebAppSnapshot: () => Promise<DesktopWebSnapshot>;
  getWebAppTickets: () => Promise<DesktopWebTicketStatus[]>;
  searchWebApp: (query: string) => Promise<DesktopWebSearchResult[]>;
  runWebAppChat: (request: DesktopWebChatRunRequest) => Promise<DesktopWebChatRunResult>;
  createWebProject: (name: string, description: string) => Promise<DesktopWebProject>;
  createWebNote: (title: string, body: string, projectId?: string) => Promise<DesktopWebNote>;
  createWebAutomation: (
    name: string,
    prompt: string,
    schedule: string,
    projectId?: string
  ) => Promise<DesktopWebAutomation>;
  toggleWebIntegration: (integrationId: string) => Promise<DesktopWebIntegration | null>;
  updateWebMemoryPrivacy: (
    patch: Partial<DesktopWebSnapshot['memoryPrivacy']>
  ) => Promise<DesktopWebSnapshot['memoryPrivacy']>;
  updateWebToolPolicy: (category: string, policy: DesktopWebToolPolicy) => Promise<Record<string, DesktopWebToolPolicy>>;
  exportWebAppData: () => Promise<string>;
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
  onRuntimeEvent: (callback: (event: DesktopRuntimeEvent) => void) => () => void;
  onTaskUpdate: (callback: (task: DesktopTaskRecord) => void) => () => void;
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
