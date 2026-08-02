import { useCallback, useEffect, useState } from 'react';
import type {
  DesktopAccountStatus,
  DesktopAppSnapshot,
  DesktopRecentWorkspace,
  DesktopSyncSettings,
  DesktopUpdateStatus,
  DesktopWindowState,
  WorkspaceSelection,
} from '@shared/ipc';
import type { ToastsApi } from './useToasts';

export interface AppDataApi {
  snapshot: DesktopAppSnapshot | null;
  workspace: WorkspaceSelection | null;
  recentWorkspaces: DesktopRecentWorkspace[];
  account: DesktopAccountStatus | null;
  syncSettings: DesktopSyncSettings | null;
  updateStatus: DesktopUpdateStatus | null;
  windowState: DesktopWindowState;
  ready: boolean;
  needsOnboarding: boolean;
  dismissOnboarding: () => void;
  selectWorkspace: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  selecting: boolean;
  refreshAccount: () => Promise<void>;
  startDeviceLogin: () => Promise<void>;
  logout: () => Promise<void>;
  updateSync: (patch: Partial<DesktopSyncSettings>) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

/** Snapshot, workspace selection, account, sync, updates and window state. */
export function useAppData(toasts: ToastsApi): AppDataApi {
  const [snapshot, setSnapshot] = useState<DesktopAppSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<DesktopRecentWorkspace[]>([]);
  const [account, setAccount] = useState<DesktopAccountStatus | null>(null);
  const [syncSettings, setSyncSettings] = useState<DesktopSyncSettings | null>(null);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [windowState, setWindowState] = useState<DesktopWindowState>({
    isMaximized: false,
    isFullScreen: false,
  });
  const [ready, setReady] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const { push } = toasts;

  const applySnapshot = useCallback((next: DesktopAppSnapshot) => {
    setSnapshot(next);
    setRecentWorkspaces(next.recentWorkspaces);
    setAccount(next.account);
    setSyncSettings(next.syncSettings);
    if (next.recovery.lastWorkspacePath) {
      setWorkspace({
        path: next.recovery.lastWorkspacePath,
        selectedAt: next.recovery.updatedAt ?? new Date().toISOString(),
      });
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const next = await window.echoaiDesktop.getSnapshot();
    applySnapshot(next);
    return next;
  }, [applySnapshot]);

  useEffect(() => {
    let mounted = true;

    void refreshSnapshot()
      .then(() => {
        if (mounted) {
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setReady(true);
          push('system', 'Startup problem', error instanceof Error ? error.message : String(error));
        }
      });

    void window.echoaiDesktop.getWindowState().then((state) => {
      if (mounted) {
        setWindowState(state);
      }
    });

    const unsubscribeWindow = window.echoaiDesktop.onWindowState(setWindowState);
    const unsubscribeUpdates = window.echoaiDesktop.onUpdateStatus((status) => {
      setUpdateStatus(status);
      if (status.state === 'available') {
        push('update', 'Update available', `EchoAI ${status.version ?? ''} is ready to download.`);
      }
      if (status.state === 'downloaded') {
        push('update', 'Update ready', 'Restart to install the new version.');
      }
    });
    const unsubscribeProtocol = window.echoaiDesktop.onProtocolUrl((url) => {
      push('system', 'Deep link opened', url);
    });

    return () => {
      mounted = false;
      unsubscribeWindow();
      unsubscribeUpdates();
      unsubscribeProtocol();
    };
  }, [push, refreshSnapshot]);

  const selectWorkspace = useCallback(async () => {
    setSelecting(true);
    try {
      const selection = await window.echoaiDesktop.selectWorkspace();
      if (selection) {
        setWorkspace(selection);
        setOnboardingDismissed(true);
        await refreshSnapshot();
      }
    } catch (error) {
      push('system', 'Could not open folder', error instanceof Error ? error.message : String(error));
    } finally {
      setSelecting(false);
    }
  }, [push, refreshSnapshot]);

  const openWorkspace = useCallback(
    async (path: string) => {
      try {
        setWorkspace(await window.echoaiDesktop.openWorkspace(path));
        setOnboardingDismissed(true);
        await refreshSnapshot();
      } catch (error) {
        push('system', 'Could not open workspace', error instanceof Error ? error.message : String(error));
      }
    },
    [push, refreshSnapshot]
  );

  const refreshAccount = useCallback(async () => {
    setAccount(await window.echoaiDesktop.refreshAccount());
  }, []);

  const startDeviceLogin = useCallback(async () => {
    try {
      const login = await window.echoaiDesktop.startDeviceLogin();
      push('device', 'Enter this code to sign in', `${login.userCode} at ${login.verificationUrl}`);
      await window.echoaiDesktop.openExternal(login.verificationUrl);
    } catch (error) {
      push('system', 'Sign-in failed', error instanceof Error ? error.message : String(error));
    }
  }, [push]);

  const logout = useCallback(async () => {
    setAccount(await window.echoaiDesktop.logout());
    await refreshSnapshot();
  }, [refreshSnapshot]);

  const updateSync = useCallback(async (patch: Partial<DesktopSyncSettings>) => {
    setSyncSettings(await window.echoaiDesktop.updateSyncSettings(patch));
    setAccount(await window.echoaiDesktop.getAccountStatus());
  }, []);

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus(await window.echoaiDesktop.checkForUpdates());
  }, []);

  const downloadUpdate = useCallback(async () => {
    setUpdateStatus(await window.echoaiDesktop.downloadUpdate());
  }, []);

  const installUpdate = useCallback(async () => {
    await window.echoaiDesktop.installUpdate();
  }, []);

  return {
    snapshot,
    workspace,
    recentWorkspaces,
    account,
    syncSettings,
    updateStatus,
    windowState,
    ready,
    // Ask for a workspace on first run only, and never block an existing one.
    needsOnboarding: ready && !workspace && !onboardingDismissed,
    dismissOnboarding: () => setOnboardingDismissed(true),
    selectWorkspace,
    openWorkspace,
    selecting,
    refreshAccount,
    startDeviceLogin,
    logout,
    updateSync,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}

export function describeUpdateStatus(status: DesktopUpdateStatus | null): string {
  if (!status) {
    return 'Not checked yet';
  }

  switch (status.state) {
    case 'idle':
      return 'Up to date';
    case 'checking':
      return 'Checking for updates…';
    case 'available':
      return `Version ${status.version ?? 'unknown'} available`;
    case 'not-available':
      return 'You are on the latest version';
    case 'downloading':
      return status.downloadProgress === null
        ? 'Downloading…'
        : `Downloading ${status.downloadProgress}%`;
    case 'downloaded':
      return `Version ${status.version ?? ''} ready to install`.trim();
    case 'disabled':
      return status.reason ?? 'Updates are disabled for this build';
    case 'error':
      return status.reason ?? 'Update check failed';
    default:
      return status.state;
  }
}
