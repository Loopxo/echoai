import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import { createEchoAIMobileClient } from "./api";
import { AccountScreen } from "./screens/AccountScreen";
import { ApprovalDecisionScreen } from "./screens/ApprovalDecisionScreen";
import { ApprovalDetailsScreen } from "./screens/ApprovalDetailsScreen";
import { ApprovalInboxScreen } from "./screens/ApprovalInboxScreen";
import { ApprovalTimeoutScreen } from "./screens/ApprovalTimeoutScreen";
import { AttachmentPickerScreen } from "./screens/AttachmentPickerScreen";
import { AuthAuditScreen } from "./screens/AuthAuditScreen";
import { ChatComposerScreen } from "./screens/ChatComposerScreen";
import { ChatDetailScreen } from "./screens/ChatDetailScreen";
import { ChatListScreen } from "./screens/ChatListScreen";
import { DeviceRevokeScreen } from "./screens/DeviceRevokeScreen";
import { GatewayDiscoveryScreen } from "./screens/GatewayDiscoveryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ManualGatewayConnectScreen } from "./screens/ManualGatewayConnectScreen";
import { ModelPickerScreen } from "./screens/ModelPickerScreen";
import { NewChatScreen } from "./screens/NewChatScreen";
import { PairedDevicesScreen } from "./screens/PairedDevicesScreen";
import { PairApprovalScreen } from "./screens/PairApprovalScreen";
import { QrPairingScreen } from "./screens/QrPairingScreen";
import { RemoteTunnelScreen } from "./screens/RemoteTunnelScreen";
import { RetryEditTurnScreen } from "./screens/RetryEditTurnScreen";
import { RunStatusScreen } from "./screens/RunStatusScreen";
import { ShareIntakeScreen } from "./screens/ShareIntakeScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { StreamingResponseScreen } from "./screens/StreamingResponseScreen";
import { StopRunScreen } from "./screens/StopRunScreen";
import { TlsPinningScreen } from "./screens/TlsPinningScreen";
import { ToolCallCardsScreen } from "./screens/ToolCallCardsScreen";
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
