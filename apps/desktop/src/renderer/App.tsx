import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type {
  DesktopAppSnapshot,
  DesktopNotification,
  DesktopRecentWorkspace,
  DesktopUpdateStatus,
  DesktopWindowState,
  LogSearchEntry,
  WorkspaceSelection,
} from '@shared/ipc';

const pages = [
  'Home',
  'Chat',
  'Workspace',
  'Files',
  'Tasks',
  'Trace',
  'Terminal',
  'Browser',
  'Canvas',
  'Sessions',
  'Artifacts',
  'Memory',
  'Skills',
  'MCP',
  'Automations',
  'Devices',
  'Channels',
  'Settings',
] as const;

type Page = (typeof pages)[number];

type PaletteItem = {
  id: string;
  label: string;
  detail: string;
  run: () => void | Promise<void>;
};

const pageDescriptions: Record<Page, string> = {
  Home: 'Command center',
  Chat: 'Runtime session',
  Workspace: 'Project context',
  Files: 'Workspace tree',
  Tasks: 'Background work',
  Trace: 'Run events',
  Terminal: 'Managed shell',
  Browser: 'Automation profile',
  Canvas: 'Live outputs',
  Sessions: 'History',
  Artifacts: 'Generated files',
  Memory: 'Saved context',
  Skills: 'Instruction packs',
  MCP: 'Tool servers',
  Automations: 'Scheduled runs',
  Devices: 'Pairing',
  Channels: 'Integrations',
  Settings: 'Controls',
};

const routeByPage = new Map<Page, string>(pages.map((page) => [page, `/${page.toLowerCase()}`]));

export function App(): ReactElement {
  const [activePage, setActivePage] = useState<Page>('Home');
  const [snapshot, setSnapshot] = useState<DesktopAppSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<DesktopRecentWorkspace[]>([]);
  const [protocolUrl, setProtocolUrl] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [windowState, setWindowState] = useState<DesktopWindowState>({
    isMaximized: false,
    isFullScreen: false,
  });
  const [notifications, setNotifications] = useState<DesktopNotification[]>([]);
  const [logQuery, setLogQuery] = useState('');
  const [logs, setLogs] = useState<LogSearchEntry[]>([]);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSelectingWorkspace, setIsSelectingWorkspace] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void refreshSnapshot().then((nextSnapshot) => {
      if (!isMounted) {
        return;
      }

      setIsOnboardingOpen(!nextSnapshot.recovery.lastWorkspacePath);
    });

    void window.echoaiDesktop.getWindowState().then((state) => {
      if (isMounted) {
        setWindowState(state);
      }
    });

    const unsubscribeProtocol = window.echoaiDesktop.onProtocolUrl((url) => {
      setProtocolUrl(url);
      pushLocalNotification('system', 'Deep link captured', url);
    });
    const unsubscribeUpdates = window.echoaiDesktop.onUpdateStatus((status) => {
      setUpdateStatus(status);
      if (status.state === 'available' || status.state === 'downloaded') {
        pushLocalNotification('update', 'Desktop update', formatUpdateState(status));
      }
    });
    const unsubscribeNotifications = window.echoaiDesktop.onNotification((notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 4));
    });
    const unsubscribeWindow = window.echoaiDesktop.onWindowState((state) => setWindowState(state));

    return () => {
      isMounted = false;
      unsubscribeProtocol();
      unsubscribeUpdates();
      unsubscribeNotifications();
      unsubscribeWindow();
    };
  }, []);

  useEffect(() => {
    const route = routeByPage.get(activePage) ?? '/';
    void window.echoaiDesktop.setLastRoute(route);
  }, [activePage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsPaletteOpen(true);
      }

      if (event.key === 'Escape') {
        setIsPaletteOpen(false);
        setIsOnboardingOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const primaryStatus = useMemo(() => {
    if (!snapshot) {
      return 'Starting';
    }

    return workspace ? 'Workspace ready' : 'No workspace';
  }, [snapshot, workspace]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const pageItems = pages.map((page) => ({
      id: `page-${page}`,
      label: page,
      detail: pageDescriptions[page],
      run: () => setActivePage(page),
    }));
    const workspaceItems = recentWorkspaces.map((recent) => ({
      id: `workspace-${recent.path}`,
      label: recent.path,
      detail: 'Recent workspace',
      run: () => openRecentWorkspace(recent.path),
    }));
    const actionItems: PaletteItem[] = [
      {
        id: 'action-select-workspace',
        label: 'Select workspace',
        detail: 'Open native folder picker',
        run: selectWorkspace,
      },
      {
        id: 'action-check-updates',
        label: 'Check for updates',
        detail: 'Run desktop update check',
        run: checkForUpdates,
      },
    ];
    const query = paletteQuery.trim().toLowerCase();
    return [...actionItems, ...pageItems, ...workspaceItems]
      .filter((item) => {
        if (!query) {
          return true;
        }

        return `${item.label} ${item.detail}`.toLowerCase().includes(query);
      })
      .slice(0, 10);
  }, [paletteQuery, recentWorkspaces]);

  async function refreshSnapshot(): Promise<DesktopAppSnapshot> {
    const nextSnapshot = await window.echoaiDesktop.getSnapshot();
    setSnapshot(nextSnapshot);
    setRecentWorkspaces(nextSnapshot.recentWorkspaces);
    if (nextSnapshot.recovery.lastWorkspacePath) {
      setWorkspace({
        path: nextSnapshot.recovery.lastWorkspacePath,
        selectedAt: nextSnapshot.recovery.updatedAt ?? new Date().toISOString(),
      });
    }
    if (nextSnapshot.recovery.lastProtocolUrl) {
      setProtocolUrl(nextSnapshot.recovery.lastProtocolUrl);
    }
    return nextSnapshot;
  }

  async function selectWorkspace(): Promise<void> {
    setIsSelectingWorkspace(true);
    try {
      const selection = await window.echoaiDesktop.selectWorkspace();
      if (selection) {
        setWorkspace(selection);
        setIsOnboardingOpen(false);
        await refreshSnapshot();
      }
    } finally {
      setIsSelectingWorkspace(false);
    }
  }

  async function openRecentWorkspace(path: string): Promise<void> {
    const selection = await window.echoaiDesktop.openWorkspace(path);
    setWorkspace(selection);
    setIsPaletteOpen(false);
    setIsOnboardingOpen(false);
    await refreshSnapshot();
  }

  async function searchLogs(): Promise<void> {
    const results = await window.echoaiDesktop.searchLogs(logQuery);
    setLogs(results.slice(0, 8));
  }

  async function checkForUpdates(): Promise<void> {
    const status = await window.echoaiDesktop.checkForUpdates();
    setUpdateStatus(status);
  }

  async function downloadUpdate(): Promise<void> {
    const status = await window.echoaiDesktop.downloadUpdate();
    setUpdateStatus(status);
  }

  async function installUpdate(): Promise<void> {
    await window.echoaiDesktop.installUpdate();
  }

  function pushLocalNotification(
    kind: DesktopNotification['kind'],
    title: string,
    body: string
  ): void {
    setNotifications((current) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          kind,
          title,
          body,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 4)
    );
  }

  async function runPaletteItem(item: PaletteItem): Promise<void> {
    await item.run();
    setIsPaletteOpen(false);
    setPaletteQuery('');
  }

  return (
    <div className="desktop-shell">
      <aside className="sidebar" aria-label="EchoAI navigation">
        <div className="brand">
          <div className="brand-mark">EA</div>
          <div>
            <div className="brand-name">EchoAI</div>
            <div className="brand-subtitle">Desktop</div>
          </div>
        </div>

        <button className="palette-button" onClick={() => setIsPaletteOpen(true)} type="button">
          <span>Search</span>
          <kbd>K</kbd>
        </button>

        <nav className="nav-list">
          {pages.map((page) => (
            <button
              className={page === activePage ? 'nav-item active' : 'nav-item'}
              key={page}
              onClick={() => setActivePage(page)}
              type="button"
            >
              <span className="nav-icon">{page.slice(0, 1)}</span>
              <span>{page}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-surface">
        <header className="title-bar">
          <div className="title-drag">
            <span>EchoAI</span>
            <span>{workspace?.path ?? 'No workspace'}</span>
          </div>
          <div className="window-controls">
            <button aria-label="Minimize" onClick={() => void window.echoaiDesktop.minimizeWindow()} type="button">
              -
            </button>
            <button
              aria-label={windowState.isMaximized ? 'Restore' : 'Maximize'}
              onClick={() =>
                void window.echoaiDesktop.maximizeWindow().then((state) => setWindowState(state))
              }
              type="button"
            >
              {windowState.isMaximized ? 'R' : '+'}
            </button>
            <button aria-label="Close" onClick={() => void window.echoaiDesktop.closeWindow()} type="button">
              x
            </button>
          </div>
        </header>

        <header className="top-bar">
          <div>
            <h1>{activePage}</h1>
            <p>{pageDescriptions[activePage]}</p>
          </div>
          <button
            className="primary-button"
            disabled={isSelectingWorkspace}
            onClick={selectWorkspace}
            type="button"
          >
            {isSelectingWorkspace ? 'Opening...' : workspace ? 'Change workspace' : 'Select workspace'}
          </button>
        </header>

        <section className="content-grid">
          <div className="workspace-panel">
            <div className="panel-kicker">Workspace</div>
            <div className="workspace-path">{workspace?.path ?? 'None selected'}</div>
            <div className="metric-row">
              <Metric label="Runtime" value="Local" />
              <Metric label="Bridge" value="Typed IPC" />
              <Metric label="Protocol" value={protocolUrl ? 'Captured' : 'Ready'} />
            </div>
          </div>

          <div className="secondary-panel">
            <div className="panel-kicker">Recent</div>
            <div className="recent-list">
              {recentWorkspaces.length === 0 ? (
                <div className="empty-row">No recent workspaces</div>
              ) : (
                recentWorkspaces.slice(0, 4).map((recent) => (
                  <button
                    className="recent-item"
                    key={recent.path}
                    onClick={() => void openRecentWorkspace(recent.path)}
                    type="button"
                  >
                    <span>{recent.path}</span>
                    <small>{formatDate(recent.lastActiveAt)}</small>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="updates-panel">
            <div>
              <div className="panel-kicker">Updates</div>
              <div className="update-state">{formatUpdateState(updateStatus)}</div>
            </div>
            <div className="update-actions">
              <button onClick={checkForUpdates} type="button">
                Check
              </button>
              <button
                disabled={updateStatus?.state !== 'available'}
                onClick={downloadUpdate}
                type="button"
              >
                Download
              </button>
              <button
                disabled={updateStatus?.state !== 'downloaded'}
                onClick={installUpdate}
                type="button"
              >
                Install
              </button>
            </div>
          </div>

          <div className="activity-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Logs</div>
                <h2>Runtime Activity</h2>
              </div>
              <div className="log-search">
                <input
                  aria-label="Log search"
                  onChange={(event) => setLogQuery(event.target.value)}
                  placeholder="Search logs"
                  type="search"
                  value={logQuery}
                />
                <button onClick={searchLogs} type="button">
                  Search
                </button>
              </div>
            </div>
            <div className="log-list">
              {logs.length === 0 ? (
                <div className="empty-row">No matching log entries</div>
              ) : (
                logs.map((entry) => (
                  <div className="log-row" key={`${entry.file}-${entry.line}`}>
                    <span className={`log-level ${entry.level}`}>{entry.level}</span>
                    <span>{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <footer className="status-bar">
          <span>{primaryStatus}</span>
          <span>{snapshot ? `v${snapshot.version}` : 'Loading version'}</span>
          <span>{snapshot?.platform ?? 'platform'}</span>
        </footer>
      </main>

      <NotificationStack notifications={notifications} />

      {isPaletteOpen ? (
        <div className="overlay-backdrop" onMouseDown={() => setIsPaletteOpen(false)}>
          <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <input
              autoFocus
              onChange={(event) => setPaletteQuery(event.target.value)}
              placeholder="Search pages, actions, workspaces"
              type="search"
              value={paletteQuery}
            />
            <div className="palette-list">
              {paletteItems.map((item) => (
                <button key={item.id} onClick={() => void runPaletteItem(item)} type="button">
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isOnboardingOpen ? (
        <div className="overlay-backdrop">
          <div className="onboarding-panel">
            <div className="panel-kicker">Setup</div>
            <h2>EchoAI Desktop</h2>
            <div className="onboarding-steps">
              <Step title="Workspace" state={workspace ? 'done' : 'active'} />
              <Step title="Models" state="ready" />
              <Step title="Permissions" state="ready" />
              <Step title="Pairing" state="ready" />
            </div>
            <div className="onboarding-actions">
              <button className="primary-button" onClick={selectWorkspace} type="button">
                Select workspace
              </button>
              <button onClick={() => setIsOnboardingOpen(false)} type="button">
                Later
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NotificationStack({
  notifications,
}: {
  notifications: DesktopNotification[];
}): ReactElement | null {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-stack">
      {notifications.map((notification) => (
        <div className={`toast ${notification.kind}`} key={notification.id}>
          <strong>{notification.title}</strong>
          <span>{notification.body}</span>
        </div>
      ))}
    </div>
  );
}

function Step({ title, state }: { title: string; state: 'active' | 'done' | 'ready' }): ReactElement {
  return (
    <div className={`setup-step ${state}`}>
      <span>{title}</span>
      <strong>{state}</strong>
    </div>
  );
}

function formatUpdateState(status: DesktopUpdateStatus | null): string {
  if (!status) {
    return 'Idle';
  }

  if (status.state === 'downloading' && status.downloadProgress !== null) {
    return `Downloading ${status.downloadProgress}%`;
  }

  if (status.version) {
    return `${status.state} ${status.version}`;
  }

  return status.reason ?? status.state;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
