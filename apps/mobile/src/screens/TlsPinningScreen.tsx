import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GatewayTlsPinState } from "../gateway";

interface TlsPinningScreenProps {
  endpointName?: string;
  pinState?: GatewayTlsPinState;
  onDisconnect?: () => void;
  onTrustFingerprint?: () => void;
}

export function TlsPinningScreen({ endpointName = "Desktop gateway", pinState, onDisconnect, onTrustFingerprint }: TlsPinningScreenProps) {
  const isMismatch = pinState?.status === "mismatch";
  const panelStyle = isMismatch ? { ...styles.panel, ...styles.warningPanel } : styles.panel;

  return (
    <View style={panelStyle}>
      <Text style={styles.heading}>Gateway identity</Text>
      <Text style={styles.name}>{endpointName}</Text>
      <Text style={isMismatch ? styles.warningText : styles.meta}>{formatStatus(pinState)}</Text>
      {pinState?.expectedFingerprintSha256 ? <Text style={styles.fingerprint}>Expected: {pinState.expectedFingerprintSha256}</Text> : null}
      {pinState?.presentedFingerprintSha256 ? <Text style={styles.fingerprint}>Presented: {pinState.presentedFingerprintSha256}</Text> : null}
      {isMismatch ? (
        <Pressable style={styles.disconnectButton} onPress={onDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.trustButton} onPress={onTrustFingerprint}>
          <Text style={styles.trustText}>Trust identity</Text>
        </Pressable>
      )}
    </View>
  );
}

function formatStatus(pinState?: GatewayTlsPinState): string {
  if (!pinState) return "No TLS identity has been checked yet";
  if (pinState.status === "mismatch") return "TLS fingerprint mismatch. Do not continue until verified.";
  if (pinState.status === "trusted") return "TLS fingerprint matches the remembered gateway identity.";
  return "No remembered TLS fingerprint for this gateway.";
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 8,
    padding: 16,
  },
  warningPanel: {
    borderColor: "#F87171",
    borderWidth: 1,
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  name: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
  warningText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "800",
  },
  fingerprint: {
    color: "#CAD2D9",
    fontSize: 11,
    fontWeight: "600",
  },
  disconnectButton: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  disconnectText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "900",
  },
  trustButton: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  trustText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
});
