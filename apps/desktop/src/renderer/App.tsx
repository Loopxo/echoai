import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type {
  DesktopAppSnapshot,
  DesktopAccountStatus,
  DesktopSyncSettings,
  DesktopNotification,
  DesktopRuntimeEvent,
  DesktopRuntimeStatus,
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

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
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
  const [account, setAccount] = useState<DesktopAccountStatus | null>(null);
  const [syncSettings, setSyncSettings] = useState<DesktopSyncSettings | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<DesktopRuntimeStatus | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<DesktopRuntimeEvent[]>([]);
  const [runtimePrompt, setRuntimePrompt] = useState('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState('echoai-local');
  const [selectedMode, setSelectedMode] = useState<'default' | 'plan'>('default');
  const [attachments, setAttachments] = useState<string[]>([]);
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
    const unsubscribeRuntime = window.echoaiDesktop.onRuntimeEvent((event) => {
      setRuntimeEvents((current) => [event, ...current].slice(0, 12));
      const message = extractChatMessage(event);
      if (message) {
        setChatMessages((current) => upsertMessage(current, message));
      }
      const delta = extractAssistantDelta(event);
      if (delta) {
        setChatMessages((current) => appendAssistantDelta(current, event.runId, delta));
      }
      if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.cancelled') {
        setActiveRunId(null);
        void refreshRuntimeStatus();
      }
    });
    const unsubscribeWindow = window.echoaiDesktop.onWindowState((state) => setWindowState(state));

    void refreshRuntimeStatus();

    return () => {
      isMounted = false;
      unsubscribeProtocol();
      unsubscribeUpdates();
      unsubscribeNotifications();
      unsubscribeRuntime();
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
    setAccount(nextSnapshot.account);
    setSyncSettings(nextSnapshot.syncSettings);
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

  async function startDeviceLogin(): Promise<void> {
    const login = await window.echoaiDesktop.startDeviceLogin();
    pushLocalNotification('device', 'Device code', login.userCode);
  }

  async function refreshAccount(): Promise<void> {
    const status = await window.echoaiDesktop.refreshAccount();
    setAccount(status);
  }

  async function logout(): Promise<void> {
    const status = await window.echoaiDesktop.logout();
    setAccount(status);
    await refreshSnapshot();
  }

  async function updateSync(patch: Partial<DesktopSyncSettings>): Promise<void> {
    const settings = await window.echoaiDesktop.updateSyncSettings(patch);
    setSyncSettings(settings);
    const status = await window.echoaiDesktop.getAccountStatus();
    setAccount(status);
  }

  async function refreshRuntimeStatus(): Promise<void> {
    const status = await window.echoaiDesktop.getRuntimeStatus();
    setRuntimeStatus(status);
  }

  async function runRuntimePrompt(): Promise<void> {
    if (!runtimePrompt.trim()) {
      return;
    }

    const handle = await window.echoaiDesktop.runPrompt({
      input: buildPromptWithAttachments(runtimePrompt, attachments),
      workspaceRoot: workspace?.path,
      mode: selectedMode,
      model: selectedModel,
    });
    setActiveRunId(handle.runId);
    setRuntimePrompt('');
    setAttachments([]);
    await refreshRuntimeStatus();
  }

  async function cancelRuntimeRun(): Promise<void> {
    if (!activeRunId) {
      return;
    }

    await window.echoaiDesktop.cancelRun(activeRunId);
    setActiveRunId(null);
    await refreshRuntimeStatus();
  }

  async function retryMessage(message: ChatMessage): Promise<void> {
    setRuntimePrompt(message.content);
    await window.echoaiDesktop.runPrompt({
      input: message.content,
      workspaceRoot: workspace?.path,
      mode: selectedMode,
      model: selectedModel,
    });
  }

  async function branchFromMessage(message: ChatMessage): Promise<void> {
    await window.echoaiDesktop.createRuntimeSession(`Branch: ${message.content.slice(0, 32)}`);
    setRuntimePrompt(message.content);
    pushLocalNotification('system', 'Session branched', 'A new desktop runtime session is ready.');
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

          <div className="account-panel">
            <div>
              <div className="panel-kicker">Account</div>
              <div className="account-line">
                {account?.signedIn ? account.email : account?.offlineMode ? 'Offline mode' : 'Not signed in'}
              </div>
              <div className="account-meta">
                {account?.signedIn ? `${account.plan ?? 'plan'} / ${account.credits ?? 0} credits` : 'BYOK/local ready'}
              </div>
            </div>
            <div className="account-actions">
              {account?.signedIn ? (
                <>
                  <button onClick={refreshAccount} type="button">
                    Refresh
                  </button>
                  <button onClick={logout} type="button">
                    Logout
                  </button>
                </>
              ) : (
                <button onClick={startDeviceLogin} type="button">
                  Login
                </button>
              )}
            </div>
            <div className="sync-toggles">
              <label>
                <input
                  checked={syncSettings?.sessions ?? false}
                  onChange={(event) => void updateSync({ sessions: event.target.checked })}
                  type="checkbox"
                />
                Sessions
              </label>
              <label>
                <input
                  checked={syncSettings?.artifacts ?? false}
                  onChange={(event) => void updateSync({ artifacts: event.target.checked })}
                  type="checkbox"
                />
                Artifacts
              </label>
              <label>
                <input
                  checked={syncSettings?.memories ?? false}
                  onChange={(event) => void updateSync({ memories: event.target.checked })}
                  type="checkbox"
                />
                Memories
              </label>
            </div>
          </div>

          <div className="runtime-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Chat</div>
                <h2>Agent Kernel</h2>
              </div>
              <div className="runtime-status">
                {runtimeStatus
                  ? `${runtimeStatus.sessionCount} sessions / ${runtimeStatus.activeRuns} active`
                  : 'Loading'}
              </div>
            </div>
            <div className="chat-toolbar">
              <select
                aria-label="Model"
                onChange={(event) => setSelectedModel(event.target.value)}
                value={selectedModel}
              >
                <option value="echoai-local">EchoAI Local</option>
                <option value="echoai-free">EchoAI Free</option>
                <option value="echoai-premium">EchoAI Premium</option>
              </select>
              <select
                aria-label="Prompt mode"
                onChange={(event) => setSelectedMode(event.target.value === 'plan' ? 'plan' : 'default')}
                value={selectedMode}
              >
                <option value="default">Ask / Build</option>
                <option value="plan">Plan / Review</option>
              </select>
              <label className="attachment-button">
                Attach
                <input
                  multiple
                  onChange={(event) =>
                    setAttachments(Array.from(event.target.files ?? []).map((file) => file.name))
                  }
                  type="file"
                />
              </label>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="empty-row">No messages yet</div>
              ) : (
                chatMessages.map((message) => (
                  <article className={`message-card ${message.role}`} key={message.id}>
                    <header>
                      <strong>{message.role}</strong>
                      <div>
                        {message.role === 'user' ? (
                          <>
                            <button onClick={() => setRuntimePrompt(message.content)} type="button">
                              Edit
                            </button>
                            <button onClick={() => void retryMessage(message)} type="button">
                              Retry
                            </button>
                          </>
                        ) : null}
                        {message.role === 'assistant' ? (
                          <button onClick={() => void branchFromMessage(message)} type="button">
                            Branch
                          </button>
                        ) : null}
                      </div>
                    </header>
                    <p>{message.content}</p>
                  </article>
                ))
              )}
            </div>
            <div className="runtime-compose">
              <input
                onChange={(event) => setRuntimePrompt(event.target.value)}
                placeholder="Run a local desktop prompt"
                value={runtimePrompt}
              />
              {activeRunId ? (
                <button onClick={cancelRuntimeRun} type="button">
                  Stop
                </button>
              ) : (
                <button onClick={runRuntimePrompt} type="button">
                  Run
                </button>
              )}
            </div>
            {attachments.length > 0 ? <div className="attachment-list">{attachments.join(', ')}</div> : null}
            <div className="runtime-events">
              {runtimeEvents.length === 0 ? (
                <div className="empty-row">No runtime events</div>
              ) : (
                runtimeEvents.map((event) => (
                  <div className="runtime-event" key={`${event.runId}-${event.createdAt}-${event.type}`}>
                    <strong>{event.type}</strong>
                    <span>{event.sessionId ?? event.runId}</span>
                  </div>
                ))
              )}
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

function buildPromptWithAttachments(prompt: string, attachmentNames: string[]): string {
  if (attachmentNames.length === 0) {
    return prompt;
  }

  return `${prompt}\n\nAttachments: ${attachmentNames.join(', ')}`;
}

function upsertMessage(messages: ChatMessage[], next: ChatMessage): ChatMessage[] {
  const existingIndex = messages.findIndex((message) => message.id === next.id);
  if (existingIndex === -1) {
    return [...messages.filter((message) => !message.id.endsWith('-stream')), next];
  }

  return messages.map((message, index) => (index === existingIndex ? next : message));
}

function appendAssistantDelta(
  messages: ChatMessage[],
  runId: string,
  text: string
): ChatMessage[] {
  const streamId = `${runId}-stream`;
  const existing = messages.find((message) => message.id === streamId);
  if (!existing) {
    return [...messages, { id: streamId, role: 'assistant', content: text }];
  }

  return messages.map((message) =>
    message.id === streamId ? { ...message, content: `${message.content}${text}` } : message
  );
}

function extractAssistantDelta(event: DesktopRuntimeEvent): string | null {
  if (event.type !== 'assistant.delta' || !isRecord(event.payload)) {
    return null;
  }

  return typeof event.payload.text === 'string' ? event.payload.text : null;
}

function extractChatMessage(event: DesktopRuntimeEvent): ChatMessage | null {
  if (event.type !== 'message.created' || !isRecord(event.payload)) {
    return null;
  }

  const message = event.payload.message;
  if (!isRecord(message)) {
    return null;
  }

  const role = message.role;
  if (role !== 'user' && role !== 'assistant' && role !== 'tool' && role !== 'system') {
    return null;
  }

  return {
    id: typeof message.id === 'string' ? message.id : `${event.runId}-${event.createdAt}`,
    role,
    content: typeof message.content === 'string' ? message.content : '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
