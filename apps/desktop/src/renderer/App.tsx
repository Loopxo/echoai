import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { DesktopAppSnapshot, LogSearchEntry, WorkspaceSelection } from '@shared/ipc';

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
  const [protocolUrl, setProtocolUrl] = useState<string | null>(null);
  const [logQuery, setLogQuery] = useState('');
  const [logs, setLogs] = useState<LogSearchEntry[]>([]);
  const [isSelectingWorkspace, setIsSelectingWorkspace] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void window.echoaiDesktop.getSnapshot().then((nextSnapshot) => {
      if (!isMounted) {
        return;
      }

      setSnapshot(nextSnapshot);
      if (nextSnapshot.recovery.lastWorkspacePath) {
        setWorkspace({
          path: nextSnapshot.recovery.lastWorkspacePath,
          selectedAt: nextSnapshot.recovery.updatedAt ?? new Date().toISOString(),
        });
      }
      if (nextSnapshot.recovery.lastProtocolUrl) {
        setProtocolUrl(nextSnapshot.recovery.lastProtocolUrl);
      }
    });

    const unsubscribe = window.echoaiDesktop.onProtocolUrl((url) => setProtocolUrl(url));
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const route = routeByPage.get(activePage) ?? '/';
    void window.echoaiDesktop.setLastRoute(route);
  }, [activePage]);

  const primaryStatus = useMemo(() => {
    if (!snapshot) {
      return 'Starting';
    }

    return workspace ? 'Workspace ready' : 'No workspace';
  }, [snapshot, workspace]);

  async function selectWorkspace(): Promise<void> {
    setIsSelectingWorkspace(true);
    try {
      const selection = await window.echoaiDesktop.selectWorkspace();
      if (selection) {
        setWorkspace(selection);
      }
    } finally {
      setIsSelectingWorkspace(false);
    }
  }

  async function searchLogs(): Promise<void> {
    const results = await window.echoaiDesktop.searchLogs(logQuery);
    setLogs(results.slice(0, 8));
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
        <header className="top-bar">
          <div>
            <h1>{activePage}</h1>
            <p>{pageDescriptions[activePage]}</p>
          </div>
          <button className="primary-button" disabled={isSelectingWorkspace} onClick={selectWorkspace} type="button">
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
            <div className="panel-kicker">Security</div>
            <ul className="security-list">
              <li>Context isolation enabled</li>
              <li>Sandboxed renderer enabled</li>
              <li>Node integration disabled</li>
              <li>External navigation guarded</li>
            </ul>
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
