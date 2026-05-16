import type { BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';
import type { DesktopUpdateStatus } from '@shared/ipc';
import type { DesktopLogger } from './logger';

const idleStatus: DesktopUpdateStatus = {
  state: 'idle',
  checkedAt: null,
  version: null,
  downloadProgress: null,
  reason: null,
};

export class AutoUpdateService {
  private updater: AppUpdater | null = null;
  private status: DesktopUpdateStatus = idleStatus;
  private window: BrowserWindow | null = null;

  constructor(
    private readonly logger: DesktopLogger,
    private readonly isPackaged: boolean
  ) {}

  attachWindow(window: BrowserWindow): void {
    this.window = window;
    this.emitStatus();
  }

  getStatus(): DesktopUpdateStatus {
    return this.status;
  }

  async checkForUpdates(): Promise<DesktopUpdateStatus> {
    if (!this.isPackaged) {
      return this.setStatus({
        state: 'disabled',
        reason: 'Updates run only in packaged desktop builds.',
      });
    }

    const updater = await this.loadUpdater();
    if (!updater) {
      return this.status;
    }

    this.setStatus({ state: 'checking', checkedAt: new Date().toISOString(), reason: null });
    await updater.checkForUpdates().catch((error: unknown) => {
      this.setStatus({ state: 'error', reason: formatUpdateError(error) });
    });
    return this.status;
  }

  async downloadUpdate(): Promise<DesktopUpdateStatus> {
    const updater = await this.loadUpdater();
    if (!updater) {
      return this.status;
    }

    this.setStatus({ state: 'downloading', downloadProgress: 0, reason: null });
    await updater.downloadUpdate().catch((error: unknown) => {
      this.setStatus({ state: 'error', reason: formatUpdateError(error) });
    });
    return this.status;
  }

  installDownloadedUpdate(): boolean {
    if (!this.updater || this.status.state !== 'downloaded') {
      return false;
    }

    this.logger.info('installing downloaded desktop update');
    this.updater.quitAndInstall(false, true);
    return true;
  }

  private async loadUpdater(): Promise<AppUpdater | null> {
    if (this.updater) {
      return this.updater;
    }

    try {
      const { autoUpdater } = await import('electron-updater');
      autoUpdater.autoDownload = false;
      this.bindUpdater(autoUpdater);
      this.updater = autoUpdater;
      return autoUpdater;
    } catch (error) {
      this.logger.warn('failed to load desktop updater', error);
      this.setStatus({
        state: 'error',
        reason: 'Updater module is unavailable in this build.',
      });
      return null;
    }
  }

  private bindUpdater(updater: AppUpdater): void {
    updater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking', checkedAt: new Date().toISOString(), reason: null });
    });

    updater.on('update-available', (info) => {
      this.logger.info('desktop update available', { version: info.version });
      this.setStatus({
        state: 'available',
        version: info.version,
        downloadProgress: null,
        reason: null,
      });
    });

    updater.on('update-not-available', (info) => {
      this.logger.info('desktop update not available', { version: info.version });
      this.setStatus({
        state: 'not-available',
        version: info.version,
        downloadProgress: null,
        reason: null,
      });
    });

    updater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        downloadProgress: Math.round(progress.percent),
        reason: null,
      });
    });

    updater.on('update-downloaded', (info) => {
      this.logger.info('desktop update downloaded', { version: info.version });
      this.setStatus({
        state: 'downloaded',
        version: info.version,
        downloadProgress: 100,
        reason: null,
      });
    });

    updater.on('error', (error) => {
      this.logger.error('desktop updater error', error);
      this.setStatus({ state: 'error', reason: formatUpdateError(error) });
    });
  }

  private setStatus(patch: Partial<DesktopUpdateStatus>): DesktopUpdateStatus {
    this.status = {
      ...this.status,
      ...patch,
    };
    this.emitStatus();
    return this.status;
  }

  private emitStatus(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('updates:status', this.status);
    }
  }
}

function formatUpdateError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
