import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { MarketWorkbench } from './MarketWorkbench';
import type {
  DesktopAppSnapshot,
  DesktopAccountStatus,
  DesktopSyncSettings,
  DesktopNotification,
  DesktopRuntimeEvent,
  DesktopRuntimeStatus,
  DesktopRecentWorkspace,
  DesktopArtifactEntry,
  DesktopFilePreview,
  DesktopWorkspaceDiagnostic,
  DesktopWorkspaceEntry,
  DesktopWorkspaceIndex,
  DesktopWorkspaceSearchResult,
  DesktopWorkspaceSymbol,
  DesktopSandboxStatus,
  DesktopTaskRecord,
  DesktopToolSummary,
  DesktopBrowserAutomationStatus,
  DesktopBrowserProfile,
  DesktopCanvasEntry,
  DesktopChannelSetting,
  DesktopGatewayStatus,
  DesktopGuiPermissionStatus,
  DesktopMcpServer,
  DesktopPairedDevice,
  DesktopPairingRequest,
  DesktopPrivacyDashboard,
  DesktopReleaseChecklistItem,
  DesktopRemoteControlRequest,
  DesktopSkillEntry,
  DesktopScheduledTask,
  DesktopTelemetrySettings,
  DesktopUpdateStatus,
  DesktopWebIntegration,
  DesktopWebRunMode,
  DesktopWebSearchResult,
  DesktopWebSnapshot,
  DesktopWebTicketStatus,
  DesktopWebToolPolicy,
  DesktopWindowState,
  DesktopMemorySearchResult,
  DesktopSandboxCommandPlan,
  DesktopWorkbenchSnapshot,
  LogSearchEntry,
  WorkspaceSelection,
} from '@shared/ipc';

const pages = [
  'Home',
  'Web',
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
  Web: 'Cloud app in Electron',
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
  const [workbench, setWorkbench] = useState<DesktopWorkbenchSnapshot | null>(null);
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
  const [workspaceFiles, setWorkspaceFiles] = useState<DesktopWorkspaceEntry[]>([]);
  const [workspacePreview, setWorkspacePreview] = useState<DesktopFilePreview | null>(null);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<DesktopWorkspaceSearchResult[]>([]);
  const [workspaceSymbols, setWorkspaceSymbols] = useState<DesktopWorkspaceSymbol[]>([]);
  const [workspaceDiagnostics, setWorkspaceDiagnostics] = useState<DesktopWorkspaceDiagnostic[]>([]);
  const [workspaceIndex, setWorkspaceIndex] = useState<DesktopWorkspaceIndex | null>(null);
  const [recentFiles, setRecentFiles] = useState<DesktopWorkspaceEntry[]>([]);
  const [artifacts, setArtifacts] = useState<DesktopArtifactEntry[]>([]);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalTasks, setTerminalTasks] = useState<DesktopTaskRecord[]>([]);
  const [terminalLog, setTerminalLog] = useState('');
  const [sandboxStatus, setSandboxStatus] = useState<DesktopSandboxStatus | null>(null);
  const [mcpServers, setMcpServers] = useState<DesktopMcpServer[]>([]);
  const [skills, setSkills] = useState<DesktopSkillEntry[]>([]);
  const [browserProfiles, setBrowserProfiles] = useState<DesktopBrowserProfile[]>([]);
  const [browserStatus, setBrowserStatus] = useState<DesktopBrowserAutomationStatus | null>(null);
  const [guiStatus, setGuiStatus] = useState<DesktopGuiPermissionStatus | null>(null);
  const [canvasEntries, setCanvasEntries] = useState<DesktopCanvasEntry[]>([]);
  const [toolSummary, setToolSummary] = useState<DesktopToolSummary | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<DesktopGatewayStatus | null>(null);
  const [pairingRequests, setPairingRequests] = useState<DesktopPairingRequest[]>([]);
  const [pairedDevices, setPairedDevices] = useState<DesktopPairedDevice[]>([]);
  const [remoteControls, setRemoteControls] = useState<DesktopRemoteControlRequest[]>([]);
  const [channelSettings, setChannelSettings] = useState<DesktopChannelSetting[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<DesktopScheduledTask[]>([]);
  const [privacyDashboard, setPrivacyDashboard] = useState<DesktopPrivacyDashboard | null>(null);
  const [telemetrySettings, setTelemetrySettings] = useState<DesktopTelemetrySettings | null>(null);
  const [releaseChecklist, setReleaseChecklist] = useState<DesktopReleaseChecklistItem[]>([]);
  const [webApp, setWebApp] = useState<DesktopWebSnapshot | null>(null);
  const [webTickets, setWebTickets] = useState<DesktopWebTicketStatus[]>([]);
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webSearchResults, setWebSearchResults] = useState<DesktopWebSearchResult[]>([]);
  const [webPrompt, setWebPrompt] = useState('Complete the web workflow inside Electron');
  const [webMode, setWebMode] = useState<DesktopWebRunMode>('act');
  const [webModelId, setWebModelId] = useState('echoai-premium-reasoner');
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
    const unsubscribeTasks = window.echoaiDesktop.onTaskUpdate((task) => {
      setTerminalTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].slice(0, 12));
    });
    const unsubscribeWindow = window.echoaiDesktop.onWindowState((state) => setWindowState(state));

    void refreshRuntimeStatus();
    void refreshTerminalState();
    void refreshToolingState();
    void refreshGatewayState();
    void refreshWebAppState();
    void refreshWorkbenchState();

    return () => {
      isMounted = false;
      unsubscribeProtocol();
      unsubscribeUpdates();
      unsubscribeNotifications();
      unsubscribeRuntime();
      unsubscribeTasks();
      unsubscribeWindow();
    };
  }, []);

  useEffect(() => {
    const route = routeByPage.get(activePage) ?? '/';
    void window.echoaiDesktop.setLastRoute(route);
  }, [activePage]);

  useEffect(() => {
    if (workspace?.path) {
      void refreshWorkspaceData(workspace.path);
    }
  }, [workspace?.path]);

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

  async function refreshWorkbenchState(): Promise<void> {
    setWorkbench(await window.echoaiDesktop.getWorkbenchSnapshot());
  }

  async function createWorkbenchProject(): Promise<void> {
    await window.echoaiDesktop.createWorkbenchProject(
      'Market Leader Desktop',
      'Native local-first agent workspace benchmarked against Open Cowork, Eigent, and Overlay.',
      workspace?.path
    );
    await refreshWorkbenchState();
  }

  async function addWorkbenchMemory(): Promise<void> {
    await window.echoaiDesktop.addWorkbenchMemory({
      scope: workspace?.path ? 'workspace' : 'global',
      text: workspace?.path
        ? `Workspace ${workspace.path} is the active local-first desktop context.`
        : 'EchoAI Desktop should stay local-first and clean-room with sample repositories.',
      source: 'desktop-workbench',
      tags: ['desktop', 'market-leader'],
    });
    await refreshWorkbenchState();
  }

  async function createWorkbenchApproval(): Promise<void> {
    await window.echoaiDesktop.createWorkbenchApproval(
      'Privileged desktop action',
      'Mutating tool, terminal, browser, file, or remote handoff work must pass typed IPC and explicit approval.',
      'ask'
    );
    await refreshWorkbenchState();
  }

  async function startWorkbenchWorkflow(): Promise<void> {
    await window.echoaiDesktop.startWorkbenchWorkflow('End-to-end desktop agent run');
    await refreshWorkbenchState();
  }

  async function advanceWorkbenchWorkflow(runId: string): Promise<void> {
    await window.echoaiDesktop.advanceWorkbenchWorkflow(runId);
    await refreshWorkbenchState();
  }

  async function planWorkbenchSandboxCommand(command: string): Promise<DesktopSandboxCommandPlan> {
    const plan = await window.echoaiDesktop.planSandboxCommand(command, workspace?.path);
    await refreshWorkbenchState();
    return plan;
  }

  async function searchWorkbenchMemory(query: string): Promise<DesktopMemorySearchResult[]> {
    return window.echoaiDesktop.searchWorkbenchMemory(query);
  }

  async function recordWorkbenchBrowserAction(sessionId: string): Promise<void> {
    await window.echoaiDesktop.recordBrowserAction({
      sessionId,
      action: 'navigate',
      url: 'https://echoai.local/desktop-agent',
      detail: 'Recorded browser workspace action from the native workbench.',
    });
    await refreshWorkbenchState();
  }

  async function respondWorkbenchApproval(approvalId: string, approved: boolean): Promise<void> {
    await window.echoaiDesktop.respondWorkbenchApproval(approvalId, approved);
    await refreshWorkbenchState();
  }

  async function pinWorkbenchMemory(memoryId: string, pinned: boolean): Promise<void> {
    await window.echoaiDesktop.pinWorkbenchMemory(memoryId, pinned);
    await refreshWorkbenchState();
  }

  async function selectWorkspace(): Promise<void> {
    setIsSelectingWorkspace(true);
    try {
      const selection = await window.echoaiDesktop.selectWorkspace();
      if (selection) {
        setWorkspace(selection);
        setIsOnboardingOpen(false);
        await refreshSnapshot();
        await refreshWorkbenchState();
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
    await refreshWorkbenchState();
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

  async function refreshWorkspaceData(rootPath: string): Promise<void> {
    const [files, index, diagnostics, recent, artifactsList, symbols] = await Promise.all([
      window.echoaiDesktop.listWorkspaceFiles(rootPath),
      window.echoaiDesktop.indexWorkspace(rootPath),
      window.echoaiDesktop.listWorkspaceDiagnostics(rootPath),
      window.echoaiDesktop.listRecentWorkspaceFiles(rootPath),
      window.echoaiDesktop.listArtifacts(),
      window.echoaiDesktop.listWorkspaceSymbols(rootPath, ''),
    ]);
    setWorkspaceFiles(files);
    setWorkspaceIndex(index);
    setWorkspaceDiagnostics(diagnostics);
    setRecentFiles(recent);
    setArtifacts(artifactsList);
    setWorkspaceSymbols(symbols.slice(0, 8));
  }

  async function previewWorkspaceFile(path: string): Promise<void> {
    if (!workspace?.path) {
      return;
    }

    const preview = await window.echoaiDesktop.previewWorkspaceFile(workspace.path, path);
    setWorkspacePreview(preview);
  }

  async function searchWorkspace(): Promise<void> {
    if (!workspace?.path) {
      return;
    }

    const [results, symbols] = await Promise.all([
      window.echoaiDesktop.searchWorkspace(workspace.path, workspaceSearchQuery),
      window.echoaiDesktop.listWorkspaceSymbols(workspace.path, workspaceSearchQuery),
    ]);
    setWorkspaceSearchResults(results);
    setWorkspaceSymbols(symbols.slice(0, 8));
  }

  async function refreshTerminalState(): Promise<void> {
    const [tasks, sandbox] = await Promise.all([
      window.echoaiDesktop.listTerminalTasks(),
      window.echoaiDesktop.getSandboxStatus(),
    ]);
    setTerminalTasks(tasks);
    setSandboxStatus(sandbox);
  }

  async function runTerminalCommand(): Promise<void> {
    if (!workspace?.path || !terminalCommand.trim()) {
      return;
    }

    const task = await window.echoaiDesktop.runTerminalCommand({
      command: terminalCommand,
      cwd: workspace.path,
    });
    setTerminalTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
    setTerminalCommand('');
  }

  async function stopTerminalTask(taskId: string): Promise<void> {
    await window.echoaiDesktop.stopTerminalTask(taskId);
  }

  async function loadTerminalLog(taskId: string): Promise<void> {
    setTerminalLog(await window.echoaiDesktop.getTerminalLog(taskId));
  }

  async function refreshToolingState(): Promise<void> {
    const [servers, skillList, profiles, status, permissions, canvases] = await Promise.all([
      window.echoaiDesktop.listMcpServers(),
      window.echoaiDesktop.listSkills(),
      window.echoaiDesktop.listBrowserProfiles(),
      window.echoaiDesktop.getBrowserAutomationStatus(),
      window.echoaiDesktop.getGuiPermissionStatus(),
      window.echoaiDesktop.listCanvasEntries(),
    ]);
    setMcpServers(servers);
    setSkills(skillList);
    setBrowserProfiles(profiles);
    setBrowserStatus(status);
    setGuiStatus(permissions);
    setCanvasEntries(canvases);
  }

  async function createDefaultTooling(): Promise<void> {
    await Promise.all([
      window.echoaiDesktop.addMcpServer({
        name: 'local-echoai',
        command: 'echoai',
        args: ['mcp'],
        enabled: true,
      }),
      window.echoaiDesktop.createBrowserProfile('Default profile', workspace?.path),
      window.echoaiDesktop.openCanvasEntry('Desktop canvas'),
      window.echoaiDesktop.summarizeToolOutput(terminalLog || 'No output selected').then(setToolSummary),
    ]);
    await refreshToolingState();
  }

  async function refreshGatewayState(): Promise<void> {
    const [
      status,
      requests,
      devices,
      remotes,
      channels,
      schedules,
      privacy,
      telemetry,
      checklist,
    ] = await Promise.all([
      window.echoaiDesktop.getGatewayStatus(),
      window.echoaiDesktop.listPairingRequests(),
      window.echoaiDesktop.listPairedDevices(),
      window.echoaiDesktop.listRemoteControls(),
      window.echoaiDesktop.listChannelSettings(),
      window.echoaiDesktop.listScheduledTasks(),
      window.echoaiDesktop.getPrivacyDashboard(),
      window.echoaiDesktop.getTelemetrySettings(),
      window.echoaiDesktop.getReleaseChecklist(),
    ]);
    setGatewayStatus(status);
    setPairingRequests(requests);
    setPairedDevices(devices);
    setRemoteControls(remotes);
    setChannelSettings(channels);
    setScheduledTasks(schedules);
    setPrivacyDashboard(privacy);
    setTelemetrySettings(telemetry);
    setReleaseChecklist(checklist);
  }

  async function toggleGateway(): Promise<void> {
    const status = gatewayStatus?.running
      ? await window.echoaiDesktop.stopGateway()
      : await window.echoaiDesktop.startGateway();
    setGatewayStatus(status);
    await refreshGatewayState();
  }

  async function createLocalPairing(): Promise<void> {
    const request = await window.echoaiDesktop.createPairingRequest('EchoAI mobile', 'mobile');
    pushLocalNotification('device', 'Pairing request', request.code);
    await refreshGatewayState();
  }

  async function respondToPairing(requestId: string, approved: boolean): Promise<void> {
    await window.echoaiDesktop.respondPairingRequest(requestId, approved);
    await refreshGatewayState();
  }

  async function revokePairedDevice(deviceId: string): Promise<void> {
    await window.echoaiDesktop.revokePairedDevice(deviceId);
    await refreshGatewayState();
  }

  async function submitRemoteHandoff(source: DesktopRemoteControlRequest['source']): Promise<void> {
    await window.echoaiDesktop.submitRemoteControl(
      source,
      source === 'mobile' ? 'Summarize current workspace status' : 'Run local desktop handoff',
      workspace?.path
    );
    await refreshGatewayState();
  }

  async function approveRemoteHandoff(requestId: string, approved: boolean): Promise<void> {
    await window.echoaiDesktop.approveRemoteControl(requestId, approved);
    await refreshGatewayState();
  }

  async function toggleChannel(channel: DesktopChannelSetting): Promise<void> {
    await window.echoaiDesktop.updateChannelSetting(channel.id, { enabled: !channel.enabled });
    await refreshGatewayState();
  }

  async function createScheduledTask(): Promise<void> {
    await window.echoaiDesktop.createScheduledTask({
      title: 'Daily workspace review',
      prompt: 'Review the selected workspace and summarize important changes.',
      schedule: 'daily',
      workspacePath: workspace?.path,
    });
    await refreshGatewayState();
  }

  async function deleteScheduledTask(taskId: string): Promise<void> {
    await window.echoaiDesktop.deleteScheduledTask(taskId);
    await refreshGatewayState();
  }

  async function exportPrivacyData(): Promise<void> {
    const path = await window.echoaiDesktop.exportPrivacyData();
    pushLocalNotification('system', 'Privacy export ready', path);
    await refreshGatewayState();
  }

  async function deleteLocalPrivacyData(): Promise<void> {
    await window.echoaiDesktop.deleteLocalPrivacyData();
    pushLocalNotification('system', 'Local gateway data reset', 'Pairing, remotes, and telemetry reset.');
    await refreshGatewayState();
  }

  async function updateTelemetry(enabled: boolean): Promise<void> {
    const telemetry = await window.echoaiDesktop.updateTelemetrySettings({ enabled });
    setTelemetrySettings(telemetry);
    await refreshGatewayState();
  }

  async function refreshWebAppState(): Promise<void> {
    const [snapshot, tickets] = await Promise.all([
      window.echoaiDesktop.getWebAppSnapshot(),
      window.echoaiDesktop.getWebAppTickets(),
    ]);
    setWebApp(snapshot);
    setWebTickets(tickets);
    if (snapshot.models.length > 0 && !snapshot.models.some((model) => model.id === webModelId)) {
      setWebModelId(snapshot.models[0]?.id ?? 'echoai-premium-reasoner');
    }
  }

  async function runWebAppPrompt(): Promise<void> {
    if (!webPrompt.trim()) {
      return;
    }

    await window.echoaiDesktop.runWebAppChat({
      prompt: webPrompt,
      modelId: webModelId,
      mode: webMode,
      projectId: webApp?.projects[0]?.id,
    });
    setWebPrompt('');
    await refreshWebAppState();
  }

  async function searchWebApp(): Promise<void> {
    setWebSearchResults(await window.echoaiDesktop.searchWebApp(webSearchQuery));
  }

  async function createWebAppProject(): Promise<void> {
    await window.echoaiDesktop.createWebProject('Electron Web Project', 'Created from the desktop web app surface.');
    await refreshWebAppState();
  }

  async function createWebAppNote(): Promise<void> {
    await window.echoaiDesktop.createWebNote(
      'Electron web note',
      'This note is available to chat context, exports, and project detail.',
      webApp?.projects[0]?.id
    );
    await refreshWebAppState();
  }

  async function createWebAppAutomation(): Promise<void> {
    await window.echoaiDesktop.createWebAutomation(
      'Electron web digest',
      'Summarize web app chats, projects, files, notes, and devices.',
      'RRULE:FREQ=DAILY',
      webApp?.projects[0]?.id
    );
    await refreshWebAppState();
  }

  async function toggleWebAppIntegration(integration: DesktopWebIntegration): Promise<void> {
    await window.echoaiDesktop.toggleWebIntegration(integration.id);
    await refreshWebAppState();
  }

  async function updateWebAppMemoryPrivacy(autoSave: boolean): Promise<void> {
    await window.echoaiDesktop.updateWebMemoryPrivacy({ autoSave });
    await refreshWebAppState();
  }

  async function updateWebAppToolPolicy(category: string, policy: DesktopWebToolPolicy): Promise<void> {
    await window.echoaiDesktop.updateWebToolPolicy(category, policy);
    await refreshWebAppState();
  }

  async function exportWebAppData(): Promise<void> {
    const path = await window.echoaiDesktop.exportWebAppData();
    pushLocalNotification('system', 'Electron web export ready', path);
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

          <MarketWorkbench
            snapshot={workbench}
            onAddMemory={addWorkbenchMemory}
            onAdvanceWorkflow={advanceWorkbenchWorkflow}
            onCreateApproval={createWorkbenchApproval}
            onCreateProject={createWorkbenchProject}
            onPinMemory={pinWorkbenchMemory}
            onPlanSandboxCommand={planWorkbenchSandboxCommand}
            onRecordBrowserAction={recordWorkbenchBrowserAction}
            onRespondApproval={respondWorkbenchApproval}
            onSearchMemory={searchWorkbenchMemory}
            onStartWorkflow={startWorkbenchWorkflow}
          />

          <div className="webapp-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Web In Electron</div>
                <h2>Overlay App Tickets W-001-W-100</h2>
              </div>
              <div className="webapp-actions">
                <button onClick={createWebAppProject} type="button">Project</button>
                <button onClick={createWebAppNote} type="button">Note</button>
                <button onClick={createWebAppAutomation} type="button">Automation</button>
                <button onClick={exportWebAppData} type="button">Export</button>
              </div>
            </div>
            <div className="webapp-grid">
              <section className="webapp-section hero">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Status</div>
                    <strong>{webApp ? `${webApp.ticketSummary.complete}/${webApp.ticketSummary.total} tickets` : 'Loading'}</strong>
                  </div>
                  <span>{webApp?.identity.plan ?? 'team'} / {webApp?.identity.role ?? 'owner'}</span>
                </div>
                <div className="metric-row compact">
                  {(webApp?.metrics ?? []).slice(0, 5).map((metric) => (
                    <Metric key={metric.label} label={metric.label} value={metric.value} />
                  ))}
                </div>
                <div className="webapp-search">
                  <input
                    aria-label="Search Electron web app"
                    onChange={(event) => setWebSearchQuery(event.target.value)}
                    placeholder="Search sessions, projects, files, notes, memories, settings"
                    value={webSearchQuery}
                  />
                  <button onClick={searchWebApp} type="button">Search</button>
                </div>
                <div className="webapp-results">
                  {(webSearchResults.length > 0 ? webSearchResults : []).slice(0, 5).map((result) => (
                    <div className="webapp-row" key={result.id}>
                      <span>{result.title}</span>
                      <small>{result.type} / {result.detail}</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="webapp-section chat">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Chat</div>
                    <strong>{webApp?.conversations.length ?? 0} sessions</strong>
                  </div>
                </div>
                <div className="webapp-compose">
                  <select
                    aria-label="Web app model"
                    onChange={(event) => setWebModelId(event.target.value)}
                    value={webModelId}
                  >
                    {(webApp?.models ?? []).map((model) => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Web app mode"
                    onChange={(event) => setWebMode(event.target.value as DesktopWebRunMode)}
                    value={webMode}
                  >
                    {['ask', 'act', 'code', 'research', 'media', 'automation'].map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                  <input
                    onChange={(event) => setWebPrompt(event.target.value)}
                    placeholder="Run hosted/free/BYOK/local web chat"
                    value={webPrompt}
                  />
                  <button onClick={runWebAppPrompt} type="button">Run</button>
                </div>
                <div className="webapp-message-list">
                  {(webApp?.messages ?? []).slice(-4).map((message) => (
                    <article className={`webapp-message ${message.role}`} key={message.id}>
                      <strong>{message.role}</strong>
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="webapp-section">
                <SectionList title="Projects" items={(webApp?.projects ?? []).map((project) => project.name)} />
                <SectionList title="Files" items={(webApp?.files ?? []).map((file) => `${file.name} / ${file.status}`)} />
              </section>

              <section className="webapp-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Memory</div>
                    <strong>{webApp?.memoryPrivacy.autoSave ? 'Auto-save' : 'Approval required'}</strong>
                  </div>
                  <label className="telemetry-toggle">
                    <input
                      checked={webApp?.memoryPrivacy.autoSave ?? false}
                      onChange={(event) => void updateWebAppMemoryPrivacy(event.target.checked)}
                      type="checkbox"
                    />
                    Auto
                  </label>
                </div>
                <SectionList title="Notes" items={(webApp?.notes ?? []).map((note) => note.title)} />
                <SectionList title="Memories" items={(webApp?.memories ?? []).map((memory) => `${memory.scope}: ${memory.text}`)} />
              </section>

              <section className="webapp-section">
                <SectionList title="Models" items={(webApp?.models ?? []).map((model) => `${model.mode} ${model.label}`)} />
                <SectionList title="Usage" items={(webApp?.usage ?? []).map((usage) => `${usage.modelId} / ${formatUsdMicros(usage.costUsdMicros)}`)} />
              </section>

              <section className="webapp-section">
                <div className="panel-kicker">Policies</div>
                <div className="policy-grid">
                  {Object.entries(webApp?.toolPolicies ?? {}).map(([category, policy]) => (
                    <label key={category}>
                      <span>{category}</span>
                      <select
                        aria-label={`${category} policy`}
                        onChange={(event) => void updateWebAppToolPolicy(category, event.target.value as DesktopWebToolPolicy)}
                        value={policy}
                      >
                        <option value="allow">allow</option>
                        <option value="ask">ask</option>
                        <option value="deny">deny</option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              <section className="webapp-section">
                <div className="panel-kicker">Integrations</div>
                <div className="channel-grid">
                  {(webApp?.integrations ?? []).map((integration) => (
                    <label key={integration.id}>
                      <input
                        checked={integration.connected}
                        onChange={() => void toggleWebAppIntegration(integration)}
                        type="checkbox"
                      />
                      {integration.name}
                    </label>
                  ))}
                </div>
                <SectionList title="Devices" items={(webApp?.devices ?? []).map((device) => `${device.name} / ${device.status}`)} />
              </section>

              <section className="webapp-section ticket-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Ticket Evidence</div>
                    <strong>{webTickets.length} complete</strong>
                  </div>
                </div>
                <div className="ticket-grid">
                  {webTickets.slice(0, 24).map((ticket) => (
                    <div className="ticket-row" key={ticket.id}>
                      <strong>{ticket.id}</strong>
                      <span>{ticket.area}</span>
                      <small>{ticket.title}</small>
                    </div>
                  ))}
                </div>
              </section>
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

          <div className="files-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Workspace Files</div>
                <h2>{workspaceIndex ? `${workspaceIndex.fileCount} files indexed` : 'File Explorer'}</h2>
              </div>
              <div className="log-search">
                <input
                  aria-label="Workspace search"
                  onChange={(event) => setWorkspaceSearchQuery(event.target.value)}
                  placeholder="Search files"
                  value={workspaceSearchQuery}
                />
                <button onClick={searchWorkspace} type="button">
                  Search
                </button>
              </div>
            </div>
            <div className="files-layout">
              <div className="file-list">
                {workspaceFiles.length === 0 ? (
                  <div className="empty-row">Select a workspace</div>
                ) : (
                  workspaceFiles.map((entry) => (
                    <button
                      disabled={entry.kind === 'directory'}
                      key={entry.path}
                      onClick={() => void previewWorkspaceFile(entry.path)}
                      type="button"
                    >
                      <span>{entry.kind === 'directory' ? 'Dir' : 'File'}</span>
                      <strong>{entry.name}</strong>
                    </button>
                  ))
                )}
              </div>
              <div className="file-preview">
                <div className="panel-kicker">Preview</div>
                {workspacePreview ? (
                  <>
                    <strong>{workspacePreview.name}</strong>
                    <small>{workspacePreview.kind} / {formatBytes(workspacePreview.size)}</small>
                    <pre>{workspacePreview.content ?? workspacePreview.mediaPath ?? 'Binary preview unavailable'}</pre>
                  </>
                ) : (
                  <div className="empty-row">Open a file</div>
                )}
              </div>
              <div className="file-inspector">
                <SectionList
                  title="Search"
                  items={workspaceSearchResults.slice(0, 5).map((result) => `${result.path}${result.line ? `:${result.line}` : ''}`)}
                />
                <SectionList
                  title="Symbols"
                  items={workspaceSymbols.map((symbol) => `${symbol.kind} ${symbol.name}`)}
                />
                <SectionList
                  title="Diagnostics"
                  items={workspaceDiagnostics.slice(0, 5).map((diagnostic) => `${diagnostic.severity}: ${diagnostic.path}`)}
                />
                <SectionList
                  title="Recent"
                  items={recentFiles.slice(0, 5).map((file) => file.path)}
                />
                <SectionList
                  title="Artifacts"
                  items={artifacts.slice(0, 5).map((artifact) => artifact.name)}
                />
              </div>
            </div>
          </div>

          <div className="terminal-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Terminal</div>
                <h2>Managed Commands</h2>
              </div>
              <div className="runtime-status">
                Native {sandboxStatus?.native ?? 'loading'} / WSL {sandboxStatus?.wsl ?? '-'} / Lima {sandboxStatus?.lima ?? '-'}
              </div>
            </div>
            <div className="terminal-compose">
              <input
                onChange={(event) => setTerminalCommand(event.target.value)}
                placeholder="npm test, pnpm build, git status"
                value={terminalCommand}
              />
              <button disabled={!workspace?.path} onClick={runTerminalCommand} type="button">
                Run
              </button>
            </div>
            <div className="terminal-layout">
              <div className="terminal-task-list">
                {terminalTasks.length === 0 ? (
                  <div className="empty-row">No terminal tasks</div>
                ) : (
                  terminalTasks.map((task) => (
                    <button key={task.id} onClick={() => void loadTerminalLog(task.id)} type="button">
                      <strong>{task.command}</strong>
                      <span>{task.status} / {task.classification.risk}</span>
                      {task.status === 'running' ? (
                        <small onClick={(event) => {
                          event.stopPropagation();
                          void stopTerminalTask(task.id);
                        }}>
                          Stop
                        </small>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <pre className="terminal-log">{terminalLog || 'Select a task log'}</pre>
            </div>
          </div>

          <div className="tooling-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Tools</div>
                <h2>MCP, Skills, Browser, Canvas</h2>
              </div>
              <button className="small-action" onClick={createDefaultTooling} type="button">
                Prepare
              </button>
            </div>
            <div className="tooling-grid">
              <SectionList title="MCP Servers" items={mcpServers.map((server) => server.name)} />
              <SectionList title="Skills" items={skills.slice(0, 8).map((skill) => skill.name)} />
              <SectionList title="Browser Profiles" items={browserProfiles.map((profile) => profile.name)} />
              <SectionList
                title="GUI Permissions"
                items={[
                  `screen ${guiStatus?.screenRecording ?? 'unknown'}`,
                  `accessibility ${guiStatus?.accessibility ?? 'unknown'}`,
                ]}
              />
              <SectionList title="Canvas" items={canvasEntries.map((entry) => entry.title)} />
              <SectionList
                title="Tool Summary"
                items={[
                  toolSummary
                    ? `${toolSummary.lineCount} lines / ${toolSummary.truncated ? 'truncated' : 'full'}`
                    : browserStatus?.message ?? 'No summary',
                ]}
              />
            </div>
          </div>

          <div className="gateway-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Remote & Privacy</div>
                <h2>Gateway, Devices, Channels</h2>
              </div>
              <button className="small-action" onClick={toggleGateway} type="button">
                {gatewayStatus?.running ? 'Stop gateway' : 'Start gateway'}
              </button>
            </div>
            <div className="gateway-grid">
              <section className="gateway-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Gateway</div>
                    <strong>{gatewayStatus?.running ? 'Running' : 'Stopped'}</strong>
                  </div>
                  <span>{gatewayStatus?.url ?? 'Local only'}</span>
                </div>
                <div className="metric-row compact">
                  <Metric label="Devices" value={`${gatewayStatus?.pairedDeviceCount ?? 0}`} />
                  <Metric label="Pending" value={`${gatewayStatus?.pendingPairingCount ?? 0}`} />
                  <Metric label="Hand offs" value={`${gatewayStatus?.remoteHandoffCount ?? 0}`} />
                </div>
              </section>

              <section className="gateway-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Pairing</div>
                    <strong>{pairedDevices.length} trusted</strong>
                  </div>
                  <button onClick={createLocalPairing} type="button">
                    New code
                  </button>
                </div>
                <div className="gateway-list">
                  {pairingRequests.length === 0 ? (
                    <div className="empty-row">No pairing requests</div>
                  ) : (
                    pairingRequests.slice(0, 4).map((request) => (
                      <div className="gateway-row" key={request.id}>
                        <span>{request.deviceName}</span>
                        <small>{request.code} / {request.status}</small>
                        {request.status === 'pending' ? (
                          <div>
                            <button onClick={() => void respondToPairing(request.id, true)} type="button">
                              Approve
                            </button>
                            <button onClick={() => void respondToPairing(request.id, false)} type="button">
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                  {pairedDevices.slice(0, 3).map((device) => (
                    <div className="gateway-row" key={device.id}>
                      <span>{device.name}</span>
                      <small>{device.type} / {device.scopes.length} scopes</small>
                      <button onClick={() => void revokePairedDevice(device.id)} type="button">
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="gateway-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Remote</div>
                    <strong>{remoteControls.length} requests</strong>
                  </div>
                  <div>
                    <button onClick={() => void submitRemoteHandoff('mobile')} type="button">
                      Mobile
                    </button>
                    <button onClick={() => void submitRemoteHandoff('web')} type="button">
                      Web
                    </button>
                  </div>
                </div>
                <div className="gateway-list">
                  {remoteControls.length === 0 ? (
                    <div className="empty-row">No remote handoffs</div>
                  ) : (
                    remoteControls.slice(0, 4).map((remote) => (
                      <div className="gateway-row" key={remote.id}>
                        <span>{remote.prompt}</span>
                        <small>{remote.source} / {remote.status}</small>
                        {remote.status === 'queued' ? (
                          <div>
                            <button onClick={() => void approveRemoteHandoff(remote.id, true)} type="button">
                              Approve
                            </button>
                            <button onClick={() => void approveRemoteHandoff(remote.id, false)} type="button">
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="gateway-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Channels</div>
                    <strong>{channelSettings.filter((channel) => channel.enabled).length} enabled</strong>
                  </div>
                </div>
                <div className="channel-grid">
                  {channelSettings.map((channel) => (
                    <label key={channel.id}>
                      <input
                        checked={channel.enabled}
                        onChange={() => void toggleChannel(channel)}
                        type="checkbox"
                      />
                      {channel.name}
                    </label>
                  ))}
                </div>
              </section>

              <section className="gateway-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Scheduled</div>
                    <strong>{scheduledTasks.length} tasks</strong>
                  </div>
                  <button onClick={createScheduledTask} type="button">
                    Add
                  </button>
                </div>
                <div className="gateway-list">
                  {scheduledTasks.length === 0 ? (
                    <div className="empty-row">No scheduled tasks</div>
                  ) : (
                    scheduledTasks.slice(0, 3).map((task) => (
                      <div className="gateway-row" key={task.id}>
                        <span>{task.title}</span>
                        <small>{task.schedule} / {task.nextRunAt ? formatDate(task.nextRunAt) : 'manual'}</small>
                        <button onClick={() => void deleteScheduledTask(task.id)} type="button">
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="gateway-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Privacy</div>
                    <strong>{telemetrySettings?.enabled ? 'Telemetry on' : 'Telemetry off'}</strong>
                  </div>
                  <label className="telemetry-toggle">
                    <input
                      checked={telemetrySettings?.enabled ?? false}
                      onChange={(event) => void updateTelemetry(event.target.checked)}
                      type="checkbox"
                    />
                    Opt in
                  </label>
                </div>
                <div className="privacy-actions">
                  <button onClick={exportPrivacyData} type="button">
                    Export
                  </button>
                  <button onClick={deleteLocalPrivacyData} type="button">
                    Delete local
                  </button>
                </div>
                <SectionList
                  title="Boundary"
                  items={[
                    `${privacyDashboard?.localData.length ?? 0} local stores`,
                    `${privacyDashboard?.cloudData.filter((item) => item.enabled).length ?? 0} cloud sync points`,
                  ]}
                />
              </section>

              <section className="gateway-section release-section">
                <div className="section-title">
                  <div>
                    <div className="panel-kicker">Release</div>
                    <strong>{releaseChecklist.filter((item) => item.status === 'pass').length}/{releaseChecklist.length} pass</strong>
                  </div>
                </div>
                <div className="release-list">
                  {releaseChecklist.map((item) => (
                    <div className={`release-row ${item.status}`} key={item.id}>
                      <strong>{item.label}</strong>
                      <span>{item.status}</span>
                    </div>
                  ))}
                </div>
              </section>
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

function SectionList({ title, items }: { title: string; items: string[] }): ReactElement {
  return (
    <section className="section-list">
      <div className="panel-kicker">{title}</div>
      {items.length === 0 ? (
        <span>None</span>
      ) : (
        items.map((item) => <span key={item}>{item}</span>)
      )}
    </section>
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatUsdMicros(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}`;
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
