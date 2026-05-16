import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import { createEchoAIMobileClient } from "./api";
import { AccountScreen } from "./screens/AccountScreen";
import { AuthAuditScreen } from "./screens/AuthAuditScreen";
import { GatewayDiscoveryScreen } from "./screens/GatewayDiscoveryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ManualGatewayConnectScreen } from "./screens/ManualGatewayConnectScreen";
import { PairApprovalScreen } from "./screens/PairApprovalScreen";
import { QrPairingScreen } from "./screens/QrPairingScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { TlsPinningScreen } from "./screens/TlsPinningScreen";
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
