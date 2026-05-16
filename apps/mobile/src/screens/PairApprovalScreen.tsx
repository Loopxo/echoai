import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PairApprovalState } from "../gateway";

interface PairApprovalScreenProps {
  approval?: PairApprovalState;
  onCancel?: () => void;
}

export function PairApprovalScreen({ approval, onCancel }: PairApprovalScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Desktop approval</Text>
      {approval ? (
        <View style={styles.card}>
          <Text style={styles.code}>{approval.challenge.displayCode}</Text>
          <Text style={styles.meta}>{formatDesktopName(approval)}</Text>
          <Text style={styles.status}>{approval.status}</Text>
          <Text style={styles.meta}>Expires {formatTimestamp(approval.challenge.expiresAt)}</Text>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel pairing</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.empty}>Start pairing to request desktop approval</Text>
      )}
    </View>
  );
}

function formatDesktopName(approval: PairApprovalState): string {
  return approval.challenge.desktopDevice?.displayName ?? "Waiting for desktop approval";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString();
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 10,
    padding: 16,
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  code: {
    color: "#7DD3FC",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  status: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  cancelText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "900",
  },
});
