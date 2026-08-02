import { useCallback, useEffect, useState } from 'react';
import type {
  DesktopBrowserAutomationStatus,
  DesktopBrowserProfile,
  DesktopChannelSetting,
  DesktopGatewayStatus,
  DesktopGuiPermissionStatus,
  DesktopMcpRuntimeStatus,
  DesktopMcpServer,
  DesktopPairedDevice,
  DesktopPairingRequest,
  DesktopPrivacyDashboard,
  DesktopReleaseChecklistItem,
  DesktopRemoteControlRequest,
  DesktopScheduledTask,
  DesktopServiceHealth,
  DesktopSkillEntry,
  DesktopTelemetrySettings,
} from '@shared/ipc';

export interface SettingsDataApi {
  mcpServers: DesktopMcpServer[];
  skills: DesktopSkillEntry[];
  browserProfiles: DesktopBrowserProfile[];
  browserStatus: DesktopBrowserAutomationStatus | null;
  guiStatus: DesktopGuiPermissionStatus | null;
  gateway: DesktopGatewayStatus | null;
  pairingRequests: DesktopPairingRequest[];
  pairedDevices: DesktopPairedDevice[];
  remoteControls: DesktopRemoteControlRequest[];
  channels: DesktopChannelSetting[];
  scheduledTasks: DesktopScheduledTask[];
  privacy: DesktopPrivacyDashboard | null;
  telemetry: DesktopTelemetrySettings | null;
  releaseChecklist: DesktopReleaseChecklistItem[];
  serviceHealth: DesktopServiceHealth[];
  mcpRuntimes: DesktopMcpRuntimeStatus[];
  loading: boolean;
  refresh: () => Promise<void>;
  addMcpServer: (input: { name: string; command: string; args: string[] }) => Promise<void>;
  removeMcpServer: (serverId: string) => Promise<void>;
  testMcpServer: (serverId: string) => Promise<boolean>;
  createSkill: (name: string, description: string) => Promise<void>;
  deleteSkill: (skillId: string) => Promise<void>;
  createBrowserProfile: (name: string) => Promise<void>;
  toggleGateway: () => Promise<void>;
  createPairing: (deviceName: string) => Promise<void>;
  respondPairing: (requestId: string, approved: boolean) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  approveRemote: (requestId: string, approved: boolean) => Promise<void>;
  toggleChannel: (channel: DesktopChannelSetting) => Promise<void>;
  createSchedule: (input: { title: string; prompt: string; schedule: string }) => Promise<void>;
  deleteSchedule: (taskId: string) => Promise<void>;
  setTelemetry: (enabled: boolean) => Promise<void>;
  exportPrivacyData: () => Promise<string>;
  deleteLocalData: () => Promise<void>;
}

/**
 * Everything behind Settings: tooling, gateway, devices, automations, privacy.
 *
 * Loaded lazily — `enabled` stays false until Settings is opened for the first
 * time, so app launch does not fan out into two dozen IPC calls the user may
 * never need.
 */
export function useSettingsData(
  enabled: boolean,
  workspacePath: string | null,
  onError: (title: string, body: string) => void
): SettingsDataApi {
  const [mcpServers, setMcpServers] = useState<DesktopMcpServer[]>([]);
  const [skills, setSkills] = useState<DesktopSkillEntry[]>([]);
  const [browserProfiles, setBrowserProfiles] = useState<DesktopBrowserProfile[]>([]);
  const [browserStatus, setBrowserStatus] = useState<DesktopBrowserAutomationStatus | null>(null);
  const [guiStatus, setGuiStatus] = useState<DesktopGuiPermissionStatus | null>(null);
  const [gateway, setGateway] = useState<DesktopGatewayStatus | null>(null);
  const [pairingRequests, setPairingRequests] = useState<DesktopPairingRequest[]>([]);
  const [pairedDevices, setPairedDevices] = useState<DesktopPairedDevice[]>([]);
  const [remoteControls, setRemoteControls] = useState<DesktopRemoteControlRequest[]>([]);
  const [channels, setChannels] = useState<DesktopChannelSetting[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<DesktopScheduledTask[]>([]);
  const [privacy, setPrivacy] = useState<DesktopPrivacyDashboard | null>(null);
  const [telemetry, setTelemetry] = useState<DesktopTelemetrySettings | null>(null);
  const [releaseChecklist, setReleaseChecklist] = useState<DesktopReleaseChecklistItem[]>([]);
  const [serviceHealth, setServiceHealth] = useState<DesktopServiceHealth[]>([]);
  const [mcpRuntimes, setMcpRuntimes] = useState<DesktopMcpRuntimeStatus[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Runs at launch, not on first Settings open.
   *
   * Reading the workbench snapshot is what starts the configured MCP servers, so
   * their tools are registered with the harness before the first prompt — and a
   * server that failed can be surfaced as a banner straight away.
   */
  const refreshRuntimeHealth = useCallback(async () => {
    try {
      const workbench = await window.echoaiDesktop.getWorkbenchSnapshot();
      setMcpRuntimes(workbench.mcpRuntimes);
      setServiceHealth(workbench.serviceHealth);
    } catch (error) {
      onError('Could not read tool status', error instanceof Error ? error.message : String(error));
    }
  }, [onError]);

  useEffect(() => {
    void refreshRuntimeHealth();
  }, [refreshRuntimeHealth]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [
        servers,
        skillList,
        profiles,
        browser,
        gui,
        gatewayStatus,
        requests,
        devices,
        remotes,
        channelList,
        schedules,
        privacyDashboard,
        telemetrySettings,
        checklist,
        workbench,
      ] = await Promise.all([
        window.echoaiDesktop.listMcpServers(),
        window.echoaiDesktop.listSkills(),
        window.echoaiDesktop.listBrowserProfiles(),
        window.echoaiDesktop.getBrowserAutomationStatus(),
        window.echoaiDesktop.getGuiPermissionStatus(),
        window.echoaiDesktop.getGatewayStatus(),
        window.echoaiDesktop.listPairingRequests(),
        window.echoaiDesktop.listPairedDevices(),
        window.echoaiDesktop.listRemoteControls(),
        window.echoaiDesktop.listChannelSettings(),
        window.echoaiDesktop.listScheduledTasks(),
        window.echoaiDesktop.getPrivacyDashboard(),
        window.echoaiDesktop.getTelemetrySettings(),
        window.echoaiDesktop.getReleaseChecklist(),
        window.echoaiDesktop.getWorkbenchSnapshot(),
      ]);

      setMcpServers(servers);
      setSkills(skillList);
      setBrowserProfiles(profiles);
      setBrowserStatus(browser);
      setGuiStatus(gui);
      setGateway(gatewayStatus);
      setPairingRequests(requests);
      setPairedDevices(devices);
      setRemoteControls(remotes);
      setChannels(channelList);
      setScheduledTasks(schedules);
      setPrivacy(privacyDashboard);
      setTelemetry(telemetrySettings);
      setReleaseChecklist(checklist);
      setServiceHealth(workbench.serviceHealth);
      setMcpRuntimes(workbench.mcpRuntimes);
    } catch (error) {
      onError('Could not load settings', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (enabled) {
      void refresh();
    }
  }, [enabled, refresh]);

  const guard = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      try {
        await action();
        await refresh();
      } catch (error) {
        onError(label, error instanceof Error ? error.message : String(error));
      }
    },
    [onError, refresh]
  );

  return {
    mcpServers,
    skills,
    browserProfiles,
    browserStatus,
    guiStatus,
    gateway,
    pairingRequests,
    pairedDevices,
    remoteControls,
    channels,
    scheduledTasks,
    privacy,
    telemetry,
    releaseChecklist,
    serviceHealth,
    mcpRuntimes,
    loading,
    refresh,
    addMcpServer: (input) =>
      guard('Could not add server', () =>
        window.echoaiDesktop.addMcpServer({ ...input, enabled: true })
      ),
    removeMcpServer: (serverId) =>
      guard('Could not remove server', () => window.echoaiDesktop.removeMcpServer(serverId)),
    testMcpServer: async (serverId) => {
      try {
        return await window.echoaiDesktop.testMcpServer(serverId);
      } catch (error) {
        onError('Server test failed', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    createSkill: (name, description) =>
      guard('Could not create skill', () => window.echoaiDesktop.createSkill(name, description)),
    deleteSkill: (skillId) =>
      guard('Could not delete skill', () => window.echoaiDesktop.deleteSkill(skillId)),
    createBrowserProfile: (name) =>
      guard('Could not create profile', () =>
        window.echoaiDesktop.createBrowserProfile(name, workspacePath ?? undefined)
      ),
    toggleGateway: () =>
      guard('Gateway action failed', () =>
        gateway?.running ? window.echoaiDesktop.stopGateway() : window.echoaiDesktop.startGateway()
      ),
    createPairing: (deviceName) =>
      guard('Could not create pairing code', () =>
        window.echoaiDesktop.createPairingRequest(deviceName, 'mobile')
      ),
    respondPairing: (requestId, approved) =>
      guard('Could not respond to pairing', () =>
        window.echoaiDesktop.respondPairingRequest(requestId, approved)
      ),
    revokeDevice: (deviceId) =>
      guard('Could not revoke device', () => window.echoaiDesktop.revokePairedDevice(deviceId)),
    approveRemote: (requestId, approved) =>
      guard('Could not respond to request', () =>
        window.echoaiDesktop.approveRemoteControl(requestId, approved)
      ),
    toggleChannel: (channel) =>
      guard('Could not update channel', () =>
        window.echoaiDesktop.updateChannelSetting(channel.id, { enabled: !channel.enabled })
      ),
    createSchedule: (input) =>
      guard('Could not create automation', () =>
        window.echoaiDesktop.createScheduledTask({
          ...input,
          workspacePath: workspacePath ?? undefined,
        })
      ),
    deleteSchedule: (taskId) =>
      guard('Could not delete automation', () => window.echoaiDesktop.deleteScheduledTask(taskId)),
    setTelemetry: (nextEnabled) =>
      guard('Could not update telemetry', () =>
        window.echoaiDesktop.updateTelemetrySettings({ enabled: nextEnabled })
      ),
    exportPrivacyData: async () => {
      try {
        return await window.echoaiDesktop.exportPrivacyData();
      } catch (error) {
        onError('Export failed', error instanceof Error ? error.message : String(error));
        return '';
      }
    },
    deleteLocalData: () =>
      guard('Could not delete local data', () => window.echoaiDesktop.deleteLocalPrivacyData()),
  };
}
