import React from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";

import { AppProvider, useAppState, type RouteKey } from "./state/AppState";
import { AccountScreen } from "./screens/AccountScreen";
import { ApprovalDecisionScreen } from "./screens/ApprovalDecisionScreen";
import { ApprovalDetailsScreen } from "./screens/ApprovalDetailsScreen";
import { ApprovalInboxScreen } from "./screens/ApprovalInboxScreen";
import { ApprovalPushScreen } from "./screens/ApprovalPushScreen";
import { ApprovalTimeoutScreen } from "./screens/ApprovalTimeoutScreen";
import { AndroidScreenCaptureScreen } from "./screens/AndroidScreenCaptureScreen";
import { AndroidVoiceWakeScreen } from "./screens/AndroidVoiceWakeScreen";
import { AudioCaptureScreen } from "./screens/AudioCaptureScreen";
import { AttachmentPickerScreen } from "./screens/AttachmentPickerScreen";
import { AuthAuditScreen } from "./screens/AuthAuditScreen";
import { CacheEncryptionScreen } from "./screens/CacheEncryptionScreen";
import { CameraCaptureScreen } from "./screens/CameraCaptureScreen";
import { CameraContextCommandScreen } from "./screens/CameraContextCommandScreen";
import { ChatComposerScreen } from "./screens/ChatComposerScreen";
import { ChatDetailScreen } from "./screens/ChatDetailScreen";
import { ChatListScreen } from "./screens/ChatListScreen";
import { DeviceRevokeScreen } from "./screens/DeviceRevokeScreen";
import { DebugLogsScreen } from "./screens/DebugLogsScreen";
import { DesktopBrowserTaskScreen } from "./screens/DesktopBrowserTaskScreen";
import { DesktopChangedFilesScreen } from "./screens/DesktopChangedFilesScreen";
import { DesktopHomeScreen } from "./screens/DesktopHomeScreen";
import { DesktopNotificationControlsScreen } from "./screens/DesktopNotificationControlsScreen";
import { DesktopSnapshotScreen } from "./screens/DesktopSnapshotScreen";
import { DesktopTerminalRunScreen } from "./screens/DesktopTerminalRunScreen";
import { DesktopWorkspaceSelectorScreen } from "./screens/DesktopWorkspaceSelectorScreen";
import { FilePreviewScreen } from "./screens/FilePreviewScreen";
import { FileUploadScreen } from "./screens/FileUploadScreen";
import { GatewayDiscoveryScreen } from "./screens/GatewayDiscoveryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { IosVoiceWakeFeasibilityScreen } from "./screens/IosVoiceWakeFeasibilityScreen";
import { IosScreenFlowScreen } from "./screens/IosScreenFlowScreen";
import { LocationContextCommandScreen } from "./screens/LocationContextCommandScreen";
import { ManualGatewayConnectScreen } from "./screens/ManualGatewayConnectScreen";
import { MemoriesScreen } from "./screens/MemoriesScreen";
import { MemorySuggestionsScreen } from "./screens/MemorySuggestionsScreen";
import { ModelPickerScreen } from "./screens/ModelPickerScreen";
import { ModelSettingsScreen } from "./screens/ModelSettingsScreen";
import { NewChatScreen } from "./screens/NewChatScreen";
import { NoteEditorScreen } from "./screens/NoteEditorScreen";
import { NoteListScreen } from "./screens/NoteListScreen";
import { NotificationSettingsScreen } from "./screens/NotificationSettingsScreen";
import { OfflineCaptureQueueScreen } from "./screens/OfflineCaptureQueueScreen";
import { PairedDevicesScreen } from "./screens/PairedDevicesScreen";
import { PairApprovalScreen } from "./screens/PairApprovalScreen";
import { PermissionDashboardScreen } from "./screens/PermissionDashboardScreen";
import { PrivacySettingsScreen } from "./screens/PrivacySettingsScreen";
import { QrPairingScreen } from "./screens/QrPairingScreen";
import { ProjectDetailScreen } from "./screens/ProjectDetailScreen";
import { ProjectListScreen } from "./screens/ProjectListScreen";
import { PushToTalkScreen } from "./screens/PushToTalkScreen";
import { RemoteDiffApprovalScreen } from "./screens/RemoteDiffApprovalScreen";
import { RemoteLogsScreen } from "./screens/RemoteLogsScreen";
import { RemoteTunnelScreen } from "./screens/RemoteTunnelScreen";
import { RetryEditTurnScreen } from "./screens/RetryEditTurnScreen";
import { RunStatusScreen } from "./screens/RunStatusScreen";
import { SafetyWarningScreen } from "./screens/SafetyWarningScreen";
import { SendToDesktopScreen } from "./screens/SendToDesktopScreen";
import { SettingsHomeScreen } from "./screens/SettingsHomeScreen";
import { ShareIntakeScreen } from "./screens/ShareIntakeScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { SmsCapabilityDecisionScreen } from "./screens/SmsCapabilityDecisionScreen";
import { StreamingResponseScreen } from "./screens/StreamingResponseScreen";
import { StopRunScreen } from "./screens/StopRunScreen";
import { TalkModeScreen } from "./screens/TalkModeScreen";
import { TlsPinningScreen } from "./screens/TlsPinningScreen";
import { ToolCallCardsScreen } from "./screens/ToolCallCardsScreen";
import { WakeDesktopScreen } from "./screens/WakeDesktopScreen";
import { WebHandoffScreen } from "./screens/WebHandoffScreen";
import { WorkspaceSwitcher } from "./screens/WorkspaceSwitcher";

const TABS: Array<{ key: RouteKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "chats", label: "Chats" },
  { key: "new", label: "New" },
  { key: "settings", label: "Settings" },
  { key: "more", label: "More" },
];

function TabBar() {
  const { route, navigate } = useAppState();
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => (
        <Pressable key={tab.key} style={route === tab.key ? styles.tabActive : styles.tab} onPress={() => navigate(tab.key)}>
          <Text style={route === tab.key ? styles.tabTextActive : styles.tabText}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CurrentScreen() {
  const { route, navigate, goBack, clientReady, sessions, openSession } = useAppState();

  switch (route) {
    case "home":
      return <HomeScreen apiReady={clientReady} />;
    case "chats":
      return <ChatListScreen sessions={sessions} onOpenSession={openSession} />;
    case "new":
      return <NewChatScreen onStart={() => navigate("chats")} />;
    case "settings":
      return <SettingsHomeScreen onOpenSection={() => navigate("more")} />;
    case "chatDetail":
      return (
        <View style={styles.stack}>
          <Pressable style={styles.back} onPress={goBack}>
            <Text style={styles.backText}>{"< Back"}</Text>
          </Pressable>
          <ChatDetailScreen />
        </View>
      );
    case "more":
    default:
      return <Gallery />;
  }
}

/** Full screen gallery — every implemented surface, reachable from the More tab. */
function Gallery() {
  return (
    <View style={styles.gallery}>
      <SignInScreen redirectUri="echoai://auth/mobile-complete" />
      <AccountScreen />
      <WorkspaceSwitcher workspaces={[]} onSelect={() => undefined} />
      <AuthAuditScreen events={[]} />
      <GatewayDiscoveryScreen />
      <ManualGatewayConnectScreen onConnect={() => undefined} />
      <QrPairingScreen onPair={() => undefined} />
      <PairApprovalScreen onCancel={() => undefined} />
      <TlsPinningScreen onDisconnect={() => undefined} onTrustFingerprint={() => undefined} />
      <PairedDevicesScreen devices={[]} />
      <DeviceRevokeScreen devices={[]} onRevoke={() => undefined} />
      <RemoteTunnelScreen tunnels={[]} onConnect={() => undefined} />
      <ModelPickerScreen models={[]} onSelectModel={() => undefined} />
      <ChatComposerScreen onSend={() => undefined} />
      <StreamingResponseScreen />
      <StopRunScreen onStop={() => undefined} />
      <RetryEditTurnScreen onRetry={() => undefined} />
      <AttachmentPickerScreen attachments={[]} onPick={() => undefined} onRemove={() => undefined} />
      <ShareIntakeScreen onStartChat={() => undefined} />
      <RunStatusScreen runs={[]} />
      <ToolCallCardsScreen toolCalls={[]} />
      <ApprovalInboxScreen approvals={[]} onOpenApproval={() => undefined} />
      <ApprovalDetailsScreen />
      <ApprovalDecisionScreen onDecide={() => undefined} />
      <ApprovalTimeoutScreen approvals={[]} />
      <ApprovalPushScreen onRegister={() => undefined} />
      <SafetyWarningScreen />
      <RemoteLogsScreen lines={[]} />
      <DesktopSnapshotScreen />
      <ProjectListScreen projects={[]} onOpenProject={() => undefined} />
      <ProjectDetailScreen />
      <FileUploadScreen uploads={[]} onPick={() => undefined} />
      <FilePreviewScreen />
      <CameraCaptureScreen onCapture={() => undefined} />
      <AudioCaptureScreen onRecord={() => undefined} onTranscribe={() => undefined} />
      <NoteListScreen notes={[]} onOpenNote={() => undefined} />
      <NoteEditorScreen onSave={() => undefined} />
      <MemoriesScreen memories={[]} onAdd={() => undefined} onDelete={() => undefined} onEdit={() => undefined} />
      <MemorySuggestionsScreen suggestions={[]} onApprove={() => undefined} onDismiss={() => undefined} />
      <DesktopHomeScreen state={{ quickActions: [] }} onAction={() => undefined} />
      <SendToDesktopScreen onSend={() => undefined} />
      <DesktopWorkspaceSelectorScreen workspaces={[]} onSelect={() => undefined} />
      <DesktopTerminalRunScreen />
      <DesktopChangedFilesScreen files={[]} />
      <RemoteDiffApprovalScreen onDecide={() => undefined} />
      <DesktopBrowserTaskScreen />
      <DesktopNotificationControlsScreen onToggle={() => undefined} />
      <WakeDesktopScreen onWake={() => undefined} />
      <WebHandoffScreen onOpen={() => undefined} />
      <PushToTalkScreen onStart={() => undefined} onStop={() => undefined} />
      <IosVoiceWakeFeasibilityScreen />
      <AndroidVoiceWakeScreen onEnable={() => undefined} />
      <TalkModeScreen onToggle={() => undefined} />
      <CameraContextCommandScreen onApprove={() => undefined} onDeny={() => undefined} />
      <LocationContextCommandScreen onShare={() => undefined} />
      <AndroidScreenCaptureScreen onStart={() => undefined} />
      <IosScreenFlowScreen />
      <SmsCapabilityDecisionScreen />
      <OfflineCaptureQueueScreen items={[]} onSync={() => undefined} />
      <ModelSettingsScreen onSelectPreference={() => undefined} />
      <NotificationSettingsScreen onToggle={() => undefined} />
      <PermissionDashboardScreen permissions={[]} />
      <PrivacySettingsScreen onRequest={() => undefined} />
      <CacheEncryptionScreen />
      <DebugLogsScreen lines={[]} onExport={() => undefined} />
    </View>
  );
}

function Shell() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.app}>
        <Text style={styles.brand}>EchoAI</Text>
        <TabBar />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <CurrentScreen />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#101418",
  },
  app: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  brand: {
    color: "#F7FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  tabBar: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    flex: 1,
    paddingVertical: 8,
  },
  tabText: {
    color: "#B8C4CC",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  tabTextActive: {
    color: "#0A1117",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 32,
  },
  stack: {
    gap: 10,
  },
  back: {
    alignSelf: "flex-start",
  },
  backText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "800",
  },
  gallery: {
    gap: 14,
  },
});
