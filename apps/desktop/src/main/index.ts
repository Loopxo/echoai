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
import { AutoUpdateService } from './auto-update-service';
import { buildDesktopAppPaths, ensureDesktopAppPaths } from './app-paths';
import { DesktopLogger } from './logger';
import { RecoveryStore } from './recovery-store';
import {
  type DesktopAppPaths,
  type DesktopAppSnapshot,
  type DesktopSecuritySummary,
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
      pendingProtocolUrls: [...pendingProtocolUrls],
      security: securitySummary,
    };
  });

  ipcMain.handle('app:selectWorkspace', async (): Promise<WorkspaceSelection | null> => {
    const services = requireServices();
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

    const selection = {
      path: result.filePaths[0],
      selectedAt: new Date().toISOString(),
    };
    await services.recoveryStore.update({ lastWorkspacePath: selection.path });
    services.logger.info('workspace selected', { path: selection.path });
    return selection;
  });

  ipcMain.handle('app:setLastRoute', async (_event, route: unknown): Promise<void> => {
    if (typeof route !== 'string' || !route.startsWith('/')) {
      throw new Error('Invalid desktop route');
    }

    const services = requireServices();
    await services.recoveryStore.update({ lastRoute: route });
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
  }
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
  updateService: AutoUpdateService;
} {
  if (!appPaths || !logger || !recoveryStore || !updateService) {
    throw new Error('EchoAI desktop services are not ready');
  }

  return { appPaths, logger, recoveryStore, updateService };
}
