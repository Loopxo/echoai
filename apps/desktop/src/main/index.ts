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
import { buildDesktopAppPaths, ensureDesktopAppPaths } from './app-paths';
import { DesktopLogger } from './logger';
import { RecoveryStore } from './recovery-store';
import { WorkspaceStore } from './workspace-store';
import {
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
  updateService: AutoUpdateService;
} {
  if (!appPaths || !logger || !recoveryStore || !authStore || !workspaceStore || !updateService) {
    throw new Error('EchoAI desktop services are not ready');
  }

  return { appPaths, logger, recoveryStore, authStore, workspaceStore, updateService };
}
