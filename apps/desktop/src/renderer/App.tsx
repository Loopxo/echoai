import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Icon } from '@echoai/design';
import { TitleBar } from './shell/TitleBar';
import { Sidebar, buildSidebarProjects } from './shell/Sidebar';
import { Onboarding } from './shell/Onboarding';
import { Banners, type Banner } from './shell/Banners';
import { CommandPalette, type PaletteAction } from './shell/CommandPalette';
import { Timeline } from './chat/Timeline';
import { Composer, type ApprovalMode, type SlashCommand } from './chat/Composer';
import { PANEL_TABS, RightPanel, type PanelTab } from './panels/RightPanel';
import { Settings, type SettingsSection } from './settings/Settings';
import { IconButton, Tooltip } from './ui';
import { useTheme } from './state/useTheme';
import { useToasts } from './state/useToasts';
import { useAppData } from './state/useAppData';
import { useRuntime, threadTitle } from './state/useRuntime';
import { useWorkspaceFiles } from './state/useWorkspaceFiles';
import { useTerminal } from './state/useTerminal';
import { useGit } from './state/useGit';
import { useSettingsData } from './state/useSettingsData';
import { usePersistentState, useResizable, useViewportWidth } from './lib/hooks';
import { basename, pluralize } from './lib/format';

const SIDEBAR_DEFAULT = 264;
const SIDEBAR_MIN = 208;
const MAIN_MIN = 560;
const PANEL_DEFAULT = 540;
const PANEL_MIN = 340;

const chrome = window.echoaiDesktop.windowChrome;

const SUGGESTIONS = [
  { icon: 'search', text: 'Explain how this project is structured' },
  { icon: 'circle-check', text: 'Find and fix failing tests' },
  { icon: 'diff', text: 'Review my uncommitted changes' },
  { icon: 'file-text', text: 'Write a README for this repo' },
] as const;

export function App(): ReactElement {
  const theme = useTheme();
  const toasts = useToasts();
  const notify = useCallback(
    (title: string, body: string) => toasts.push('system', title, body),
    [toasts]
  );

  const app = useAppData(toasts);
  const workspacePath = app.workspace?.path ?? null;

  const runtime = useRuntime(workspacePath, notify);
  const files = useWorkspaceFiles(workspacePath, notify);
  const terminal = useTerminal(workspacePath, notify);
  const git = useGit(workspacePath, notify, notify);

  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState('echoai:sidebar-collapsed', false);
  const [panelOpen, setPanelOpen] = usePersistentState('echoai:panel-open', false);
  const [panelTab, setPanelTab] = usePersistentState<PanelTab>('echoai:panel-tab', 'files');
  const [approval, setApproval] = usePersistentState<ApprovalMode>('echoai:approval', 'supervised');
  const [pinnedIds, setPinnedIds] = usePersistentState<string[]>('echoai:pinned-threads', []);
  const [dismissedBanners, setDismissedBanners] = usePersistentState<string[]>(
    'echoai:dismissed-banners',
    []
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // Settings data is fetched on first open and kept warm afterwards.
  const [settingsTouched, setSettingsTouched] = useState(false);
  const settingsData = useSettingsData(settingsTouched, workspacePath, notify);

  const viewportWidth = useViewportWidth();
  const sidebar = useResizable({
    storageKey: 'echoai:sidebar-width',
    defaultWidth: SIDEBAR_DEFAULT,
    minWidth: SIDEBAR_MIN,
    maxWidth: Math.max(SIDEBAR_MIN, viewportWidth - MAIN_MIN - (panelOpen ? PANEL_MIN : 0)),
    edge: 'right',
  });
  const panel = useResizable({
    storageKey: 'echoai:panel-width',
    defaultWidth: PANEL_DEFAULT,
    minWidth: PANEL_MIN,
    maxWidth: Math.max(
      PANEL_MIN,
      viewportWidth - MAIN_MIN - (sidebarCollapsed ? 0 : sidebar.width)
    ),
    edge: 'left',
  });

  const openSettings = useCallback((section: SettingsSection = 'general') => {
    setSettingsTouched(true);
    setSettingsSection(section);
    setSettingsOpen(true);
  }, []);

  const openPanel = useCallback(
    (tab: PanelTab) => {
      setPanelTab(tab);
      setPanelOpen(true);
    },
    [setPanelOpen, setPanelTab]
  );

  /* ------------------------------ Shortcuts ------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        runtime.newThread();
        setDraft('');
        return;
      }
      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
        return;
      }
      if (mod && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setPanelOpen(!panelOpen);
        return;
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        openSettings();
        return;
      }
      if (event.key === 'Escape' && runtime.running && !paletteOpen && !settingsOpen) {
        // Only reach for Stop once no overlay is claiming Escape.
        event.preventDefault();
        void runtime.stop();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    openSettings,
    paletteOpen,
    panelOpen,
    runtime,
    settingsOpen,
    setPanelOpen,
    setSidebarCollapsed,
    sidebarCollapsed,
  ]);

  /* --------------------------- Route persistence --------------------------- */

  useEffect(() => {
    const route = settingsOpen
      ? `/settings/${settingsSection}`
      : runtime.activeSessionId
        ? `/thread/${runtime.activeSessionId}`
        : '/';
    void window.echoaiDesktop.setLastRoute(route);
  }, [runtime.activeSessionId, settingsOpen, settingsSection]);

  /* ------------------------------- Actions ------------------------------- */

  const activeSession = runtime.sessions.find((session) => session.id === runtime.activeSessionId);
  const title = activeSession ? threadTitle(activeSession) : 'New thread';

  const projects = useMemo(
    () => buildSidebarProjects(runtime.sessions, app.recentWorkspaces, workspacePath),
    [app.recentWorkspaces, runtime.sessions, workspacePath]
  );

  const togglePin = useCallback(
    (sessionId: string) => {
      setPinnedIds((current) =>
        current.includes(sessionId)
          ? current.filter((id) => id !== sessionId)
          : [...current, sessionId]
      );
    },
    [setPinnedIds]
  );

  const usageLabel = app.account?.signedIn
    ? `${app.account.credits ?? 0} credits · ${app.account.plan ?? 'plan'}`
    : null;

  /**
   * Banners are for blockers only, so each one names a fixable condition and
   * links to where it is fixed.
   */
  const banners = useMemo<Banner[]>(() => {
    const list: Banner[] = [];

    if (runtime.status && runtime.status.providers.length === 0) {
      list.push({
        id: 'no-provider',
        tone: 'warning',
        icon: 'key',
        title: 'No model provider configured',
        body: 'Add an API key, or run Ollama locally, to start a conversation.',
        action: { label: 'Open settings', run: () => openSettings('models') },
      });
    }

    const failedServers = settingsData.mcpRuntimes.filter((server) => server.status === 'failed');
    if (failedServers.length > 0) {
      list.push({
        id: `mcp-failed-${failedServers.length}`,
        tone: 'danger',
        icon: 'plug',
        title: `${pluralize(failedServers.length, 'MCP server')} failed to start`,
        body: failedServers[0]?.failureReason ?? undefined,
        action: { label: 'Review', run: () => openSettings('tools') },
      });
    }

    if (app.updateStatus?.state === 'downloaded') {
      list.push({
        id: `update-${app.updateStatus.version ?? 'ready'}`,
        tone: 'primary',
        icon: 'download',
        title: `EchoAI Agent ${app.updateStatus.version ?? ''} is ready`.trim(),
        body: 'Restart to finish installing.',
        action: { label: 'Restart', run: () => void app.installUpdate() },
      });
    }

    return list.filter((banner) => !dismissedBanners.includes(banner.id)).map((banner) => ({
      ...banner,
      onDismiss: () => setDismissedBanners((current) => [...current, banner.id]),
    }));
  }, [
    app,
    dismissedBanners,
    openSettings,
    runtime.status,
    settingsData.mcpRuntimes,
    setDismissedBanners,
  ]);

  const searchFiles = useCallback(
    async (query: string): Promise<string[]> => {
      if (!workspacePath) {
        return [];
      }
      const trimmed = query.trim();
      if (!trimmed) {
        return files.entries.filter((entry) => entry.kind === 'file').slice(0, 8).map((entry) => entry.path);
      }
      try {
        const results = await window.echoaiDesktop.searchWorkspace(workspacePath, trimmed);
        return [...new Set(results.map((result) => result.path))].slice(0, 8);
      } catch {
        return [];
      }
    },
    [files.entries, workspacePath]
  );

  const slashCommands = useMemo<SlashCommand[]>(
    () => [
      {
        name: 'new',
        description: 'Start a new thread',
        icon: 'square-pen',
        run: () => {
          runtime.newThread();
          setDraft('');
        },
      },
      {
        name: 'plan',
        description: 'Switch to plan-first mode',
        icon: 'list',
        run: () => runtime.setMode('plan'),
      },
      {
        name: 'build',
        description: 'Switch to build mode',
        icon: 'zap',
        run: () => runtime.setMode('default'),
      },
      {
        name: 'files',
        description: 'Open the file browser',
        icon: 'folder',
        run: () => openPanel('files'),
      },
      {
        name: 'diff',
        description: 'Review working tree changes',
        icon: 'diff',
        run: () => openPanel('changes'),
      },
      {
        name: 'terminal',
        description: 'Open the terminal panel',
        icon: 'terminal',
        run: () => openPanel('terminal'),
      },
      {
        name: 'logs',
        description: 'Open runtime logs',
        icon: 'activity',
        run: () => openPanel('logs'),
      },
      {
        name: 'workspace',
        description: 'Open a different folder',
        icon: 'folder-open',
        run: () => void app.selectWorkspace(),
      },
      {
        name: 'settings',
        description: 'Open settings',
        icon: 'settings',
        run: () => openSettings(),
      },
      {
        name: 'theme',
        description: 'Toggle light and dark',
        icon: 'moon',
        run: theme.toggle,
      },
    ],
    [app, openPanel, openSettings, runtime, theme.toggle]
  );

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      {
        id: 'action-new-thread',
        label: 'New thread',
        detail: '⌘N',
        icon: 'square-pen',
        group: 'Actions',
        run: () => {
          runtime.newThread();
          setDraft('');
        },
      },
      {
        id: 'action-open-folder',
        label: 'Open folder…',
        icon: 'folder-open',
        group: 'Actions',
        keywords: 'workspace project directory',
        run: () => void app.selectWorkspace(),
      },
      {
        id: 'action-toggle-theme',
        label: `Switch to ${theme.resolved === 'dark' ? 'light' : 'dark'} theme`,
        icon: theme.resolved === 'dark' ? 'sun' : 'moon',
        group: 'Actions',
        run: theme.toggle,
      },
      {
        id: 'action-toggle-sidebar',
        label: sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar',
        detail: '⌘B',
        icon: 'panel-left',
        group: 'Actions',
        run: () => setSidebarCollapsed(!sidebarCollapsed),
      },
      {
        id: 'action-check-updates',
        label: 'Check for updates',
        icon: 'download',
        group: 'Actions',
        run: () => {
          openSettings('updates');
          void app.checkForUpdates();
        },
      },
    ];

    for (const tab of PANEL_TABS) {
      actions.push({
        id: `panel-${tab}`,
        label: `Open ${tab}`,
        icon:
          tab === 'files'
            ? 'folder'
            : tab === 'changes'
              ? 'diff'
              : tab === 'terminal'
                ? 'terminal'
                : tab === 'artifacts'
                  ? 'layers'
                  : 'activity',
        group: 'Panels',
        run: () => openPanel(tab),
      });
    }

    for (const session of runtime.sessions.slice(0, 30)) {
      actions.push({
        id: `thread-${session.id}`,
        label: threadTitle(session),
        detail: `${session.messageCount} messages`,
        icon: 'message-circle',
        group: 'Threads',
        run: () => void runtime.openThread(session.id),
      });
    }

    for (const recent of app.recentWorkspaces.slice(0, 8)) {
      actions.push({
        id: `workspace-${recent.path}`,
        label: basename(recent.path),
        detail: recent.path,
        icon: 'folder',
        group: 'Workspaces',
        run: () => void app.openWorkspace(recent.path),
      });
    }

    for (const section of [
      'general',
      'models',
      'account',
      'tools',
      'automations',
      'devices',
      'privacy',
      'updates',
      'about',
    ] as const) {
      actions.push({
        id: `settings-${section}`,
        label: `Settings: ${section}`,
        icon: 'settings',
        group: 'Settings',
        run: () => openSettings(section),
      });
    }

    return actions;
  }, [app, openPanel, openSettings, runtime, setSidebarCollapsed, sidebarCollapsed, theme]);

  const providerReady = (runtime.status?.providers.length ?? 0) > 0;

  return (
    <div className="app" data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
      <div
        style={
          {
            display: 'contents',
            // Reserve the traffic light gutter only where macOS actually draws it.
            '--traffic-inset': chrome.hasNativeTrafficLights
              ? `${chrome.trafficLightInset}px`
              : '0px',
          } as React.CSSProperties
        }
      >
        {/* Always mounted: collapsing animates the width instead of unmounting,
            which is what made the layout jump sideways in one frame. */}
        <Sidebar
          sessions={runtime.sessions}
          projects={projects}
          activeSessionId={runtime.activeSessionId}
          activeProjectPath={workspacePath}
          pinnedIds={pinnedIds}
          account={app.account}
          usageLabel={usageLabel}
          resizable={sidebar}
          onNewThread={() => {
            runtime.newThread();
            setDraft('');
          }}
          onOpenThread={(sessionId) => void runtime.openThread(sessionId)}
          onOpenPalette={() => setPaletteOpen(true)}
          onTogglePin={togglePin}
          onSelectWorkspace={() => void app.selectWorkspace()}
          onOpenWorkspace={(path) => void app.openWorkspace(path)}
          onOpenSettings={(section) => openSettings(section ?? 'general')}
          onOpenPanel={openPanel}
          onCollapse={() => setSidebarCollapsed(true)}
          onSignIn={() => void app.startDeviceLogin()}
          onSignOut={() => void app.logout()}
        />

        <main className="main">
          <TitleBar
            title={title}
            subtitle={workspacePath}
            windowState={app.windowState}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen(!panelOpen)}
            onOpenSettings={() => openSettings()}
            leading={
              sidebarCollapsed ? (
                <div className="collapsed-rail no-drag">
                  <Tooltip content="Show sidebar" shortcut="⌘B">
                    <IconButton
                      icon="panel-left"
                      label="Show sidebar"
                      onClick={() => setSidebarCollapsed(false)}
                    />
                  </Tooltip>
                  <Tooltip content="New thread" shortcut="⌘N">
                    <IconButton
                      icon="square-pen"
                      label="New thread"
                      onClick={() => {
                        runtime.newThread();
                        setDraft('');
                      }}
                    />
                  </Tooltip>
                </div>
              ) : null
            }
            actions={
              <Tooltip content={`Switch to ${theme.resolved === 'dark' ? 'light' : 'dark'} theme`}>
                <IconButton
                  icon={theme.resolved === 'dark' ? 'sun' : 'moon'}
                  label="Toggle theme"
                  onClick={theme.toggle}
                />
              </Tooltip>
            }
          />

          <div className="main-body">
            <section className="thread" aria-label="Conversation">
              <Banners banners={banners} />
              <Timeline
                rows={runtime.rows}
                loading={runtime.historyLoading}
                onRetry={(content) => setDraft(content)}
                emptyState={
                  <Welcome
                    workspaceName={workspacePath ? basename(workspacePath) : null}
                    onSuggestion={(text) => setDraft(text)}
                  />
                }
              />

              <Composer
                running={runtime.running}
                disabled={!providerReady}
                status={runtime.status}
                provider={runtime.provider}
                model={runtime.model}
                mode={runtime.mode}
                commands={slashCommands}
                onSearchFiles={searchFiles}
                onProviderChange={runtime.setProvider}
                onModelChange={runtime.setModel}
                onModeChange={runtime.setMode}
                onSend={(input) => void runtime.send(input)}
                onStop={() => void runtime.stop()}
                draft={draft}
                onDraftChange={setDraft}
                workspaceName={workspacePath ? basename(workspacePath) : null}
                gitStatus={git.status}
                approval={approval}
                onApprovalChange={setApproval}
                onOpenChanges={() => openPanel('changes')}
                onSelectWorkspace={() => void app.selectWorkspace()}
              />
            </section>

            {panelOpen ? (
              <RightPanel
                tab={panelTab}
                onTabChange={setPanelTab}
                onClose={() => setPanelOpen(false)}
                resizable={panel}
                workspacePath={workspacePath}
                files={files}
                terminal={terminal}
                git={git}
                onOpenExternal={(path) => void window.echoaiDesktop.openArtifact(path)}
              />
            ) : null}
          </div>
        </main>
      </div>

      {paletteOpen ? (
        <CommandPalette actions={paletteActions} onDismiss={() => setPaletteOpen(false)} />
      ) : null}

      {settingsOpen ? (
        <Settings
          section={settingsSection}
          onSectionChange={setSettingsSection}
          onClose={() => setSettingsOpen(false)}
          app={app}
          data={settingsData}
          runtimeStatus={runtime.status}
          themePreference={theme.preference}
          onThemeChange={theme.setPreference}
          onNotify={notify}
        />
      ) : null}

      {app.needsOnboarding ? (
        <Onboarding
          recentWorkspaces={app.recentWorkspaces}
          selecting={app.selecting}
          onSelectWorkspace={() => void app.selectWorkspace()}
          onOpenWorkspace={(path) => void app.openWorkspace(path)}
          onSkip={app.dismissOnboarding}
        />
      ) : null}

      {toasts.toasts.length > 0 ? (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.toasts.map((toast) => (
            <div className="toast" data-kind={toast.kind} key={toast.id}>
              <span className="toast-icon">
                <Icon
                  name={
                    toast.kind === 'update'
                      ? 'download'
                      : toast.kind === 'permission'
                        ? 'shield'
                        : toast.kind === 'device'
                          ? 'smartphone'
                          : toast.kind === 'task'
                            ? 'circle-check'
                            : 'info'
                  }
                  size={15}
                />
              </span>
              <span className="toast-text">
                <span className="toast-title">{toast.title}</span>
                <span className="toast-body">{toast.body}</span>
              </span>
              <IconButton
                icon="x"
                label="Dismiss"
                size="sm"
                onClick={() => toasts.dismiss(toast.id)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------- Welcome -------------------------------- */

function Welcome({
  workspaceName,
  onSuggestion,
}: {
  workspaceName: string | null;
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="welcome">
      <span className="welcome-mark" aria-hidden>
        <Icon name="sparkles" size={22} />
      </span>
      <h1 className="welcome-title">
        {workspaceName ? `What should we do in ${workspaceName}?` : 'What should we build?'}
      </h1>
      <p className="welcome-desc">
        {workspaceName
          ? 'EchoAI can read your files, run commands and propose changes. You approve anything that writes.'
          : 'Open a folder to let EchoAI read your code, or just start a conversation.'}
      </p>

      <div className="welcome-suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.text}
            type="button"
            className="suggestion"
            onClick={() => onSuggestion(suggestion.text)}
          >
            <Icon name={suggestion.icon} size={14} />
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  );
}
