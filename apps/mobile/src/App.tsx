import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import { createEchoAIMobileClient } from "./api";
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
import { CameraCaptureScreen } from "./screens/CameraCaptureScreen";
import { CameraContextCommandScreen } from "./screens/CameraContextCommandScreen";
import { ChatComposerScreen } from "./screens/ChatComposerScreen";
import { ChatDetailScreen } from "./screens/ChatDetailScreen";
import { ChatListScreen } from "./screens/ChatListScreen";
import { DeviceRevokeScreen } from "./screens/DeviceRevokeScreen";
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
import { NewChatScreen } from "./screens/NewChatScreen";
import { NoteEditorScreen } from "./screens/NoteEditorScreen";
import { NoteListScreen } from "./screens/NoteListScreen";
import { PairedDevicesScreen } from "./screens/PairedDevicesScreen";
import { PairApprovalScreen } from "./screens/PairApprovalScreen";
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
import { ShareIntakeScreen } from "./screens/ShareIntakeScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { StreamingResponseScreen } from "./screens/StreamingResponseScreen";
import { StopRunScreen } from "./screens/StopRunScreen";
import { TalkModeScreen } from "./screens/TalkModeScreen";
import { TlsPinningScreen } from "./screens/TlsPinningScreen";
import { ToolCallCardsScreen } from "./screens/ToolCallCardsScreen";
import { WakeDesktopScreen } from "./screens/WakeDesktopScreen";
import { WebHandoffScreen } from "./screens/WebHandoffScreen";
import { WorkspaceSwitcher } from "./screens/WorkspaceSwitcher";

const clientFactoryReady = typeof createEchoAIMobileClient === "function";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.app}>
        <Text style={styles.brand}>EchoAI</Text>
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
        <ChatListScreen sessions={[]} onOpenSession={() => undefined} />
        <ChatDetailScreen />
        <NewChatScreen onStart={() => undefined} />
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
        <HomeScreen apiReady={clientFactoryReady} />
      </View>
    </SafeAreaView>
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
    marginBottom: 16,
  },
});
