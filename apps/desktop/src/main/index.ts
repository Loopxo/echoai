import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  session as electronSession,
} from 'electron';
import type { OpenDialogOptions } from 'electron';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthStore } from './auth-store';
import { AutoUpdateService } from './auto-update-service';
import { DesktopRuntimeService } from './desktop-runtime-service';
import { buildDesktopAppPaths, ensureDesktopAppPaths } from './app-paths';
import { DesktopGatewayService } from './gateway-service';
import { DesktopLogger } from './logger';
import { RecoveryStore } from './recovery-store';
import { TerminalTaskService, classifyCommand, getSandboxStatus } from './terminal-task-service';
import { DesktopToolingService } from './tooling-service';
import { DesktopWebAppService } from './web-app-service';
import { DesktopWorkbenchService } from './workbench-service';
import { WorkspaceFileService } from './workspace-file-service';
import { WorkspaceStore } from './workspace-store';
import {
  type DesktopCommandRisk,
  type DesktopNotification,
  type DesktopAppPaths,
  type DesktopAppSnapshot,
  type DesktopSecuritySummary,
  type DesktopWindowState,
  type WorkspaceSelection,
  isEchoAIProtocolUrl,
  isSafeExternalUrl,
} from '@shared/ipc';

const mainDir = dirname(fileURLToPath(import.meta.url));
const scheme = 'echoai';
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const securitySummary: DesktopSecuritySummary = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  remoteModule: false,
  webSecurity: true,
};

let mainWindow: BrowserWindow | null = null;
let appPaths: DesktopAppPaths | null = null;
let logger: DesktopLogger | null = null;
let recoveryStore: RecoveryStore | null = null;
let authStore: AuthStore | null = null;
let workspaceStore: WorkspaceStore | null = null;
let workspaceFileService: WorkspaceFileService | null = null;
let terminalTaskService: TerminalTaskService | null = null;
let toolingService: DesktopToolingService | null = null;
let runtimeService: DesktopRuntimeService | null = null;
let gatewayService: DesktopGatewayService | null = null;
let webAppService: DesktopWebAppService | null = null;
let workbenchService: DesktopWorkbenchService | null = null;
let updateService: AutoUpdateService | null = null;
const pendingProtocolUrls: string[] = [];

app.setName('EchoAI');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  const protocolUrl = argv.find(isEchoAIProtocolUrl);
  if (protocolUrl) {
    void handleProtocolUrl(protocolUrl);
  }

  focusMainWindow();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  void handleProtocolUrl(url);
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: 'deny' };
  });
});

app.whenReady().then(async () => {
  await bootstrap();
  registerProtocolClient();
  registerPermissionPolicy();
  registerIpcHandlers();
  mainWindow = await createMainWindow();

  for (const arg of process.argv) {
    if (isEchoAIProtocolUrl(arg)) {
      await handleProtocolUrl(arg);
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow().then((window) => {
      mainWindow = window;
    });
  }
});

app.on('window-all-closed', () => {
  terminalTaskService?.cleanup();
  void gatewayService?.stopGateway();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  terminalTaskService?.cleanup();
  void gatewayService?.stopGateway();
});

async function bootstrap(): Promise<void> {
  appPaths = buildDesktopAppPaths(app.getPath('userData'));
  await ensureDesktopAppPaths(appPaths);

  logger = new DesktopLogger(appPaths.logsDir);
  await logger.ready();
  logger.info('desktop bootstrap complete', { version: app.getVersion(), platform: process.platform });

  recoveryStore = new RecoveryStore(appPaths.dataDir);
  authStore = new AuthStore(appPaths.dataDir);
  workspaceStore = new WorkspaceStore(appPaths.dataDir);
  workspaceFileService = new WorkspaceFileService();
  terminalTaskService = new TerminalTaskService(appPaths.logsDir, logger, (task) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tasks:update', task);
    }
  });
  toolingService = new DesktopToolingService(appPaths.dataDir, appPaths.skillsDir, appPaths.cacheDir);
  runtimeService = new DesktopRuntimeService(appPaths.sessionsDir, logger, (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('runtime:event', event);
    }
  });
  gatewayService = new DesktopGatewayService(appPaths, logger);
  webAppService = new DesktopWebAppService(appPaths);
  workbenchService = new DesktopWorkbenchService(appPaths.dataDir);
  updateService = new AutoUpdateService(logger, app.isPackaged);
}

async function createMainWindow(): Promise<BrowserWindow> {
  const services = requireServices();
  const recovery = await services.recoveryStore.read();
  const bounds = recovery.lastWindowBounds ?? { width: 1280, height: 820 };
  const window = new BrowserWindow({
    title: 'EchoAI',
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7f4ee',
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    icon: getIconPath(),
    show: false,
    webPreferences: {
      preload: join(mainDir, '../preload/index.js'),
      contextIsolation: securitySummary.contextIsolation,
      nodeIntegration: securitySummary.nodeIntegration,
      sandbox: securitySummary.sandbox,
      webSecurity: securitySummary.webSecurity,
      allowRunningInsecureContent: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  window.on('close', () => {
    void services.recoveryStore.update({
      lastWindowBounds: window.getBounds(),
    });
  });

  window.on('maximize', () => sendWindowState(window));
  window.on('unmaximize', () => sendWindowState(window));
  window.on('enter-full-screen', () => sendWindowState(window));
  window.on('leave-full-screen', () => sendWindowState(window));

  window.webContents.on('will-navigate', (event, url) => {
    if (isInternalNavigation(url)) {
      return;
    }

    event.preventDefault();
    void openExternalSafely(url);
  });

  if (devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(join(mainDir, '../../dist/index.html'));
  }

  updateService?.attachWindow(window);
  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:getSnapshot', async (): Promise<DesktopAppSnapshot> => {
    const services = requireServices();
    const recovery = await services.recoveryStore.read();
    return {
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      paths: services.appPaths,
      recovery,
      recentWorkspaces: await services.workspaceStore.list(),
      pendingProtocolUrls: [...pendingProtocolUrls],
      security: securitySummary,
      account: await services.authStore.getStatus(),
      syncSettings: await services.authStore.getSyncSettings(),
    };
  });

  ipcMain.handle('app:selectWorkspace', async (): Promise<WorkspaceSelection | null> => {
    const options: OpenDialogOptions = {
      title: 'Select EchoAI workspace',
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return openWorkspacePath(result.filePaths[0]);
  });

  ipcMain.handle('app:openWorkspace', async (_event, path: unknown): Promise<WorkspaceSelection> => {
    if (typeof path !== 'string' || path.trim().length === 0) {
      throw new Error('Invalid workspace path');
    }

    return openWorkspacePath(path);
  });

  ipcMain.handle('app:setLastRoute', async (_event, route: unknown): Promise<void> => {
    if (typeof route !== 'string' || !route.startsWith('/')) {
      throw new Error('Invalid desktop route');
    }

    const services = requireServices();
    await services.recoveryStore.update({ lastRoute: route });
  });

  ipcMain.handle('desktop:getWorkbenchSnapshot', async () => {
    const services = requireServices();
    const [
      recovery,
      runtimeStatus,
      gatewayStatus,
      releaseReadiness,
      mcpServers,
      mcpTools,
    ] = await Promise.all([
      services.recoveryStore.read(),
      services.runtimeService.getStatus(),
      services.gatewayService.getStatus(),
      services.gatewayService.getReleaseChecklist(),
      services.toolingService.listMcpServers(),
      services.toolingService.listMcpTools(),
    ]);
    return services.workbenchService.getSnapshot({
      activeWorkspacePath: recovery.lastWorkspacePath,
      runtimeStatus,
      gatewayStatus,
      sandboxStatus: getSandboxStatus(process.platform),
      releaseReadiness,
      mcpServers,
      mcpTools,
      terminalTasks: services.terminalTaskService.list(),
    });
  });

  ipcMain.handle('desktop:createWorkbenchProject', (_event, name: unknown, description: unknown, workspacePath: unknown) => {
    return requireServices().workbenchService.createProject(
      typeof name === 'string' ? name : '',
      typeof description === 'string' ? description : '',
      typeof workspacePath === 'string' ? workspacePath : undefined
    );
  });

  ipcMain.handle('desktop:addWorkbenchMemory', (_event, input: unknown) => {
    if (!isRecord(input) || typeof input.text !== 'string') {
      throw new Error('Invalid workbench memory');
    }

    const scope =
      input.scope === 'workspace' || input.scope === 'project' || input.scope === 'global'
        ? input.scope
        : 'global';
    const tags = Array.isArray(input.tags)
      ? input.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    return requireServices().workbenchService.addMemory({
      scope,
      text: input.text,
      source: typeof input.source === 'string' ? input.source : 'manual',
      tags,
    });
  });

  ipcMain.handle('desktop:pinWorkbenchMemory', (_event, memoryId: unknown, pinned: unknown) => {
    if (typeof memoryId !== 'string') {
      return null;
    }

    return requireServices().workbenchService.pinMemory(memoryId, pinned === true);
  });

  ipcMain.handle('desktop:createWorkbenchApproval', (_event, title: unknown, detail: unknown, risk: unknown) => {
    if (typeof title !== 'string' || typeof detail !== 'string') {
      throw new Error('Invalid workbench approval');
    }

    return requireServices().workbenchService.createApproval(title, detail, toCommandRisk(risk));
  });

  ipcMain.handle('desktop:respondWorkbenchApproval', (_event, approvalId: unknown, approved: unknown) => {
    if (typeof approvalId !== 'string') {
      return null;
    }

    return requireServices().workbenchService.respondApproval(approvalId, approved === true);
  });

  ipcMain.handle('desktop:startWorkbenchWorkflow', (_event, title: unknown) => {
    return requireServices().workbenchService.startWorkflow(
      typeof title === 'string' ? title : 'Market leader workflow'
    );
  });

  ipcMain.handle('desktop:advanceWorkbenchWorkflow', (_event, runId: unknown) => {
    return typeof runId === 'string'
      ? requireServices().workbenchService.advanceWorkflow(runId)
      : null;
  });

  ipcMain.handle('desktop:planSandboxCommand', (_event, command: unknown, cwd: unknown) => {
    const normalizedCommand = typeof command === 'string' ? command : '';
    return requireServices().workbenchService.planSandboxCommand({
      command: normalizedCommand,
      cwd: typeof cwd === 'string' ? cwd : undefined,
      classification: classifyCommand(normalizedCommand),
      sandboxStatus: getSandboxStatus(process.platform),
    });
  });

  ipcMain.handle('desktop:searchWorkbenchMemory', (_event, query: unknown) => {
    return requireServices().workbenchService.searchMemories(typeof query === 'string' ? query : '');
  });

  ipcMain.handle('desktop:recordBrowserAction', (_event, input: unknown) => {
    if (!isRecord(input) || typeof input.sessionId !== 'string') {
      throw new Error('Invalid browser action');
    }

    const action =
      input.action === 'click' ||
      input.action === 'type' ||
      input.action === 'screenshot' ||
      input.action === 'extract' ||
      input.action === 'handoff'
        ? input.action
        : 'navigate';
    return requireServices().workbenchService.recordBrowserAction({
      sessionId: input.sessionId,
      action,
      url: typeof input.url === 'string' ? input.url : undefined,
      detail: typeof input.detail === 'string' ? input.detail : undefined,
    });
  });

  ipcMain.handle('auth:getStatus', async () => {
    return requireServices().authStore.getStatus();
  });

  ipcMain.handle('auth:startDeviceLogin', async () => {
    const login = await requireServices().authStore.startDeviceLogin();
    await openExternalSafely(`${login.verificationUrl}?code=${encodeURIComponent(login.userCode)}`);
    pushNotification({
      kind: 'device',
      title: 'Device login started',
      body: login.userCode,
    });
    return login;
  });

  ipcMain.handle('auth:refresh', async () => {
    return requireServices().authStore.refresh();
  });

  ipcMain.handle('auth:logout', async () => {
    const account = await requireServices().authStore.logout();
    pushNotification({
      kind: 'system',
      title: 'Signed out',
      body: 'Hosted features are disabled.',
    });
    return account;
  });

  ipcMain.handle('sync:getSettings', async () => {
    return requireServices().authStore.getSyncSettings();
  });

  ipcMain.handle('sync:updateSettings', async (_event, patch: unknown) => {
    if (!isRecord(patch)) {
      throw new Error('Invalid sync settings');
    }

    return requireServices().authStore.updateSyncSettings(patch);
  });

  ipcMain.handle('sync:listQueue', async () => {
    return requireServices().authStore.listQueue();
  });

  ipcMain.handle('account:listAudit', async () => {
    return requireServices().authStore.listAudit();
  });

  ipcMain.handle('runtime:getStatus', async () => {
    return requireServices().runtimeService.getStatus();
  });

  ipcMain.handle('runtime:listSessions', async () => {
    return requireServices().runtimeService.listSessions();
  });

  ipcMain.handle('runtime:createSession', async (_event, title: unknown) => {
    if (typeof title !== 'string') {
      throw new Error('Invalid runtime session title');
    }

    return requireServices().runtimeService.createSession(title);
  });

  ipcMain.handle('runtime:runPrompt', async (_event, request: unknown) => {
    if (!isRecord(request) || typeof request.input !== 'string') {
      throw new Error('Invalid runtime request');
    }

    return requireServices().runtimeService.runPrompt({
      sessionId: typeof request.sessionId === 'string' ? request.sessionId : undefined,
      input: request.input,
      workspaceRoot: typeof request.workspaceRoot === 'string' ? request.workspaceRoot : undefined,
      mode: request.mode === 'plan' ? 'plan' : 'default',
      provider: typeof request.provider === 'string' ? request.provider : undefined,
      model: typeof request.model === 'string' ? request.model : undefined,
    });
  });

  ipcMain.handle('runtime:cancelRun', (_event, runId: unknown) => {
    if (typeof runId !== 'string') {
      return false;
    }

    return requireServices().runtimeService.cancelRun(runId);
  });

  ipcMain.handle('runtime:getSession', async (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') {
      return null;
    }

    return requireServices().runtimeService.getSession(sessionId);
  });

  ipcMain.handle('runtime:exportSession', async (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') {
      throw new Error('Invalid runtime session id');
    }

    return requireServices().runtimeService.exportSession(sessionId);
  });

  ipcMain.handle('workspace:listFiles', async (_event, rootPath: unknown) => {
    if (typeof rootPath !== 'string') {
      throw new Error('Invalid workspace root');
    }

    return requireServices().workspaceFileService.listFiles(rootPath);
  });

  ipcMain.handle('workspace:previewFile', async (_event, rootPath: unknown, relativePath: unknown) => {
    if (typeof rootPath !== 'string' || typeof relativePath !== 'string') {
      throw new Error('Invalid workspace preview request');
    }

    return requireServices().workspaceFileService.previewFile(rootPath, relativePath);
  });

  ipcMain.handle('workspace:search', async (_event, rootPath: unknown, query: unknown) => {
    if (typeof rootPath !== 'string' || typeof query !== 'string') {
      throw new Error('Invalid workspace search request');
    }

    return requireServices().workspaceFileService.search(rootPath, query);
  });

  ipcMain.handle('workspace:listSymbols', async (_event, rootPath: unknown, query: unknown) => {
    if (typeof rootPath !== 'string') {
      throw new Error('Invalid workspace symbol request');
    }

    return requireServices().workspaceFileService.listSymbols(rootPath, typeof query === 'string' ? query : '');
  });

  ipcMain.handle('workspace:listDiagnostics', async (_event, rootPath: unknown) => {
    if (typeof rootPath !== 'string') {
      throw new Error('Invalid workspace diagnostics request');
    }

    return requireServices().workspaceFileService.listDiagnostics(rootPath);
  });

  ipcMain.handle('workspace:index', async (_event, rootPath: unknown) => {
    if (typeof rootPath !== 'string') {
      throw new Error('Invalid workspace index request');
    }

    return requireServices().workspaceFileService.indexWorkspace(rootPath);
  });

  ipcMain.handle('workspace:listRecentFiles', async (_event, rootPath: unknown) => {
    if (typeof rootPath !== 'string') {
      throw new Error('Invalid recent files request');
    }

    return requireServices().workspaceFileService.listRecentFiles(rootPath);
  });

  ipcMain.handle('artifacts:list', async () => {
    return requireServices().workspaceFileService.listArtifacts(requireServices().appPaths.artifactsDir);
  });

  ipcMain.handle('artifacts:open', async (_event, artifactPath: unknown) => {
    if (typeof artifactPath !== 'string') {
      return false;
    }

    const result = await shell.openPath(artifactPath);
    return result.length === 0;
  });

  ipcMain.handle('artifacts:reveal', (_event, artifactPath: unknown) => {
    if (typeof artifactPath !== 'string') {
      return false;
    }

    shell.showItemInFolder(artifactPath);
    return true;
  });

  ipcMain.handle('terminal:run', async (_event, request: unknown) => {
    if (
      !isRecord(request) ||
      typeof request.command !== 'string' ||
      typeof request.cwd !== 'string'
    ) {
      throw new Error('Invalid terminal run request');
    }

    return requireServices().terminalTaskService.run({
      command: request.command,
      cwd: request.cwd,
    });
  });

  ipcMain.handle('terminal:stop', (_event, taskId: unknown) => {
    return typeof taskId === 'string' ? requireServices().terminalTaskService.stop(taskId) : false;
  });

  ipcMain.handle('terminal:listTasks', () => {
    return requireServices().terminalTaskService.list();
  });

  ipcMain.handle('terminal:getLog', async (_event, taskId: unknown) => {
    return typeof taskId === 'string' ? requireServices().terminalTaskService.getLog(taskId) : '';
  });

  ipcMain.handle('sandbox:classifyCommand', (_event, command: unknown) => {
    return classifyCommand(typeof command === 'string' ? command : '');
  });

  ipcMain.handle('sandbox:getStatus', () => {
    return getSandboxStatus(process.platform);
  });

  ipcMain.handle('mcp:listServers', () => {
    return requireServices().toolingService.listMcpServers();
  });

  ipcMain.handle('mcp:addServer', async (_event, server: unknown) => {
    if (!isRecord(server) || typeof server.name !== 'string' || typeof server.command !== 'string') {
      throw new Error('Invalid MCP server');
    }

    return requireServices().toolingService.addMcpServer({
      name: server.name,
      command: server.command,
      args: Array.isArray(server.args) ? server.args.filter((arg): arg is string => typeof arg === 'string') : [],
      enabled: server.enabled !== false,
    });
  });

  ipcMain.handle('mcp:removeServer', (_event, serverId: unknown) => {
    return typeof serverId === 'string' ? requireServices().toolingService.removeMcpServer(serverId) : false;
  });

  ipcMain.handle('mcp:testServer', (_event, serverId: unknown) => {
    return typeof serverId === 'string' ? requireServices().toolingService.testMcpServer(serverId) : false;
  });

  ipcMain.handle('mcp:listTools', () => {
    return requireServices().toolingService.listMcpTools();
  });

  ipcMain.handle('skills:list', () => {
    return requireServices().toolingService.listSkills();
  });

  ipcMain.handle('skills:create', (_event, name: unknown, description: unknown) => {
    if (typeof name !== 'string' || typeof description !== 'string') {
      throw new Error('Invalid skill');
    }

    return requireServices().toolingService.createSkill(name, description);
  });

  ipcMain.handle('skills:delete', (_event, skillId: unknown) => {
    return typeof skillId === 'string' ? requireServices().toolingService.deleteSkill(skillId) : false;
  });

  ipcMain.handle('browser:listProfiles', () => {
    return requireServices().toolingService.listBrowserProfiles();
  });

  ipcMain.handle('browser:createProfile', (_event, name: unknown, workspacePath: unknown) => {
    if (typeof name !== 'string') {
      throw new Error('Invalid browser profile name');
    }

    return requireServices().toolingService.createBrowserProfile(
      name,
      typeof workspacePath === 'string' ? workspacePath : undefined
    );
  });

  ipcMain.handle('browser:getAutomationStatus', () => {
    return requireServices().toolingService.getBrowserAutomationStatus();
  });

  ipcMain.handle('gui:getPermissionStatus', () => {
    return requireServices().toolingService.getGuiPermissionStatus();
  });

  ipcMain.handle('computer:requestAction', (_event, action: unknown) => {
    if (typeof action !== 'string') {
      throw new Error('Invalid computer-use action');
    }

    return requireServices().toolingService.requestComputerAction(action);
  });

  ipcMain.handle('canvas:list', () => {
    return requireServices().toolingService.listCanvasEntries();
  });

  ipcMain.handle('canvas:open', (_event, title: unknown) => {
    if (typeof title !== 'string') {
      throw new Error('Invalid canvas title');
    }

    return requireServices().toolingService.openCanvasEntry(title);
  });

  ipcMain.handle('tools:summarizeOutput', (_event, output: unknown) => {
    return requireServices().toolingService.summarizeToolOutput(typeof output === 'string' ? output : '');
  });

  ipcMain.handle('gateway:getStatus', () => {
    return requireServices().gatewayService.getStatus();
  });

  ipcMain.handle('gateway:start', (_event, preferredPort: unknown) => {
    const port = typeof preferredPort === 'number' && Number.isInteger(preferredPort)
      ? preferredPort
      : undefined;
    return requireServices().gatewayService.startGateway(port);
  });

  ipcMain.handle('gateway:stop', () => {
    return requireServices().gatewayService.stopGateway();
  });

  ipcMain.handle('devices:listPairingRequests', () => {
    return requireServices().gatewayService.listPairingRequests();
  });

  ipcMain.handle('devices:createPairingRequest', (_event, deviceName: unknown, deviceType: unknown) => {
    if (typeof deviceName !== 'string') {
      throw new Error('Invalid pairing device name');
    }

    const normalizedType =
      deviceType === 'mobile' || deviceType === 'web' || deviceType === 'desktop'
        ? deviceType
        : 'unknown';
    return requireServices().gatewayService.createPairingRequest(deviceName, normalizedType);
  });

  ipcMain.handle('devices:respondPairingRequest', (_event, requestId: unknown, approved: unknown) => {
    if (typeof requestId !== 'string') {
      throw new Error('Invalid pairing request id');
    }

    return requireServices().gatewayService.respondToPairing(requestId, approved === true);
  });

  ipcMain.handle('devices:listPaired', () => {
    return requireServices().gatewayService.listPairedDevices();
  });

  ipcMain.handle('devices:revoke', (_event, deviceId: unknown) => {
    return typeof deviceId === 'string' ? requireServices().gatewayService.revokeDevice(deviceId) : false;
  });

  ipcMain.handle('remote:listControls', () => {
    return requireServices().gatewayService.listRemoteControls();
  });

  ipcMain.handle('remote:submitControl', (_event, source: unknown, prompt: unknown, workspacePath: unknown) => {
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid remote prompt');
    }

    return requireServices().gatewayService.submitRemoteControl({
      source: source === 'mobile' ? 'mobile' : 'web',
      prompt,
      workspacePath: typeof workspacePath === 'string' ? workspacePath : undefined,
    });
  });

  ipcMain.handle('remote:approveControl', (_event, requestId: unknown, approved: unknown) => {
    if (typeof requestId !== 'string') {
      throw new Error('Invalid remote request id');
    }

    return requireServices().gatewayService.approveRemoteControl(requestId, approved === true);
  });

  ipcMain.handle('channels:list', () => {
    return requireServices().gatewayService.listChannelSettings();
  });

  ipcMain.handle('channels:update', (_event, channelId: unknown, patch: unknown) => {
    if (typeof channelId !== 'string' || !isRecord(patch)) {
      throw new Error('Invalid channel settings');
    }

    return requireServices().gatewayService.updateChannelSetting(channelId, patch);
  });

  ipcMain.handle('scheduled:list', () => {
    return requireServices().gatewayService.listScheduledTasks();
  });

  ipcMain.handle('scheduled:create', (_event, input: unknown) => {
    if (
      !isRecord(input) ||
      typeof input.title !== 'string' ||
      typeof input.prompt !== 'string' ||
      typeof input.schedule !== 'string'
    ) {
      throw new Error('Invalid scheduled task');
    }

    return requireServices().gatewayService.createScheduledTask({
      title: input.title,
      prompt: input.prompt,
      schedule: input.schedule,
      workspacePath: typeof input.workspacePath === 'string' ? input.workspacePath : undefined,
    });
  });

  ipcMain.handle('scheduled:delete', (_event, taskId: unknown) => {
    return typeof taskId === 'string' ? requireServices().gatewayService.deleteScheduledTask(taskId) : false;
  });

  ipcMain.handle('privacy:getDashboard', () => {
    return requireServices().gatewayService.getPrivacyDashboard();
  });

  ipcMain.handle('privacy:exportData', () => {
    return requireServices().gatewayService.exportPrivacyData();
  });

  ipcMain.handle('privacy:deleteLocalData', () => {
    return requireServices().gatewayService.deleteLocalPrivacyData();
  });

  ipcMain.handle('telemetry:getSettings', () => {
    return requireServices().gatewayService.getTelemetrySettings();
  });

  ipcMain.handle('telemetry:updateSettings', (_event, patch: unknown) => {
    if (!isRecord(patch)) {
      throw new Error('Invalid telemetry settings');
    }

    return requireServices().gatewayService.updateTelemetrySettings(patch);
  });

  ipcMain.handle('release:getChecklist', () => {
    return requireServices().gatewayService.getReleaseChecklist();
  });

  ipcMain.handle('webapp:getSnapshot', () => {
    return requireServices().webAppService.getSnapshot();
  });

  ipcMain.handle('webapp:getTickets', () => {
    return requireServices().webAppService.getTickets();
  });

  ipcMain.handle('webapp:search', (_event, query: unknown) => {
    return requireServices().webAppService.search(typeof query === 'string' ? query : '');
  });

  ipcMain.handle('webapp:runChat', (_event, request: unknown) => {
    if (!isRecord(request) || typeof request.prompt !== 'string' || typeof request.modelId !== 'string') {
      throw new Error('Invalid web app chat request');
    }

    return requireServices().webAppService.runChat({
      conversationId: typeof request.conversationId === 'string' ? request.conversationId : undefined,
      projectId: typeof request.projectId === 'string' ? request.projectId : undefined,
      prompt: request.prompt,
      modelId: request.modelId,
      mode:
        request.mode === 'act' ||
        request.mode === 'code' ||
        request.mode === 'research' ||
        request.mode === 'media' ||
        request.mode === 'automation'
          ? request.mode
          : 'ask',
    });
  });

  ipcMain.handle('webapp:createProject', (_event, name: unknown, description: unknown) => {
    return requireServices().webAppService.createProject(
      typeof name === 'string' ? name : '',
      typeof description === 'string' ? description : ''
    );
  });

  ipcMain.handle('webapp:createNote', (_event, title: unknown, body: unknown, projectId: unknown) => {
    return requireServices().webAppService.createNote(
      typeof title === 'string' ? title : '',
      typeof body === 'string' ? body : '',
      typeof projectId === 'string' ? projectId : undefined
    );
  });

  ipcMain.handle('webapp:createAutomation', (_event, name: unknown, prompt: unknown, schedule: unknown, projectId: unknown) => {
    return requireServices().webAppService.createAutomation(
      typeof name === 'string' ? name : '',
      typeof prompt === 'string' ? prompt : '',
      typeof schedule === 'string' ? schedule : '',
      typeof projectId === 'string' ? projectId : undefined
    );
  });

  ipcMain.handle('webapp:toggleIntegration', (_event, integrationId: unknown) => {
    return typeof integrationId === 'string'
      ? requireServices().webAppService.toggleIntegration(integrationId)
      : null;
  });

  ipcMain.handle('webapp:updateMemoryPrivacy', (_event, patch: unknown) => {
    if (!isRecord(patch)) {
      throw new Error('Invalid web app memory privacy patch');
    }

    return requireServices().webAppService.updateMemoryPrivacy(patch);
  });

  ipcMain.handle('webapp:updateToolPolicy', (_event, category: unknown, policy: unknown) => {
    if (typeof category !== 'string' || (policy !== 'allow' && policy !== 'ask' && policy !== 'deny')) {
      throw new Error('Invalid web app tool policy');
    }

    return requireServices().webAppService.updateToolPolicy(category, policy);
  });

  ipcMain.handle('webapp:exportData', () => {
    return requireServices().webAppService.exportData();
  });

  ipcMain.handle('logs:search', async (_event, query: unknown) => {
    const services = requireServices();
    return services.logger.search(typeof query === 'string' ? query : '');
  });

  ipcMain.handle('shell:openExternal', async (_event, url: unknown) => {
    if (typeof url !== 'string') {
      return false;
    }

    return openExternalSafely(url);
  });

  ipcMain.handle('updates:check', async () => {
    return requireServices().updateService.checkForUpdates();
  });

  ipcMain.handle('updates:download', async () => {
    return requireServices().updateService.downloadUpdate();
  });

  ipcMain.handle('updates:install', () => {
    return requireServices().updateService.installDownloadedUpdate();
  });

  ipcMain.handle('window:minimize', () => {
    getActiveWindow()?.minimize();
  });

  ipcMain.handle('window:maximizeToggle', (): DesktopWindowState => {
    const window = getActiveWindow();
    if (!window) {
      return { isMaximized: false, isFullScreen: false };
    }

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }

    return getWindowState(window);
  });

  ipcMain.handle('window:close', () => {
    getActiveWindow()?.close();
  });

  ipcMain.handle('window:getState', (): DesktopWindowState => {
    const window = getActiveWindow();
    return window ? getWindowState(window) : { isMaximized: false, isFullScreen: false };
  });
}

function registerProtocolClient(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(scheme, process.execPath, [resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(scheme);
  }

  logger?.info('protocol client registered', { scheme });
}

function registerPermissionPolicy(): void {
  electronSession.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger?.warn('renderer permission denied by default', { permission });
    callback(false);
  });
}

async function handleProtocolUrl(url: string): Promise<void> {
  if (!isEchoAIProtocolUrl(url)) {
    logger?.warn('blocked non EchoAI protocol url', { url });
    return;
  }

  pendingProtocolUrls.push(url);
  logger?.info('captured protocol url', { url });

  const services = recoveryStore ? { recoveryStore } : null;
  if (services) {
    await services.recoveryStore.update({ lastProtocolUrl: url });
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('protocol:url', url);
    pushNotification({
      kind: 'system',
      title: 'Deep link captured',
      body: url,
    });
  }

  await maybeCompleteHostedLogin(url);
}

async function maybeCompleteHostedLogin(url: string): Promise<void> {
  if (!authStore) {
    return;
  }

  const parsed = new URL(url);
  if (parsed.hostname !== 'auth' && !parsed.pathname.includes('auth')) {
    return;
  }

  const token = parsed.searchParams.get('token') ?? parsed.searchParams.get('code');
  if (!token) {
    return;
  }

  const credits = Number(parsed.searchParams.get('credits'));
  await authStore.completeHostedLogin({
    token,
    email: parsed.searchParams.get('email'),
    plan: parsed.searchParams.get('plan'),
    credits: Number.isFinite(credits) ? credits : null,
  });
  pushNotification({
    kind: 'device',
    title: 'Account connected',
    body: 'Hosted EchoAI sync is ready.',
  });
}

async function openWorkspacePath(path: string): Promise<WorkspaceSelection> {
  const services = requireServices();
  const selection = {
    path,
    selectedAt: new Date().toISOString(),
  };

  await services.workspaceStore.touch(selection.path);
  await services.recoveryStore.update({ lastWorkspacePath: selection.path });
  services.logger.info('workspace selected', { path: selection.path });
  pushNotification({
    kind: 'system',
    title: 'Workspace ready',
    body: selection.path,
  });
  return selection;
}

async function openExternalSafely(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) {
    logger?.warn('blocked external navigation', { url });
    return false;
  }

  await shell.openExternal(url);
  return true;
}

function focusMainWindow(): void {
  const window = mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
  if (!window || window.isDestroyed()) {
    void createMainWindow().then((createdWindow) => {
      mainWindow = createdWindow;
    });
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function pushNotification(input: Omit<DesktopNotification, 'id' | 'createdAt'>): void {
  const notification: DesktopNotification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notifications:push', notification);
  }
}

function sendWindowState(window: BrowserWindow): void {
  window.webContents.send('window:state', getWindowState(window));
}

function getWindowState(window: BrowserWindow): DesktopWindowState {
  return {
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen(),
  };
}

function getActiveWindow(): BrowserWindow | null {
  const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
  return window && !window.isDestroyed() ? window : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toCommandRisk(value: unknown): DesktopCommandRisk {
  return value === 'safe' || value === 'ask' || value === 'deny' ? value : 'ask';
}

function isInternalNavigation(url: string): boolean {
  if (devServerUrl && url.startsWith(devServerUrl)) {
    return true;
  }

  return url.startsWith('file://');
}

function getIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'echo-logo.png');
  }

  return resolve(mainDir, '../../../../assets/echo-logo.png');
}

function requireServices(): {
  appPaths: DesktopAppPaths;
  logger: DesktopLogger;
  recoveryStore: RecoveryStore;
  authStore: AuthStore;
  workspaceStore: WorkspaceStore;
  workspaceFileService: WorkspaceFileService;
  terminalTaskService: TerminalTaskService;
  toolingService: DesktopToolingService;
  runtimeService: DesktopRuntimeService;
  gatewayService: DesktopGatewayService;
  webAppService: DesktopWebAppService;
  workbenchService: DesktopWorkbenchService;
  updateService: AutoUpdateService;
} {
  if (
    !appPaths ||
    !logger ||
    !recoveryStore ||
    !authStore ||
    !workspaceStore ||
    !workspaceFileService ||
    !terminalTaskService ||
    !toolingService ||
    !runtimeService ||
    !gatewayService ||
    !webAppService ||
    !workbenchService ||
    !updateService
  ) {
    throw new Error('EchoAI desktop services are not ready');
  }

  return {
    appPaths,
    logger,
    recoveryStore,
    authStore,
    workspaceStore,
    workspaceFileService,
    terminalTaskService,
    toolingService,
    runtimeService,
    gatewayService,
    webAppService,
    workbenchService,
    updateService,
  };
}
