import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MobileAuthState, MobileDevice } from "../protocol";

export interface AccountUsageSummary {
  periodLabel: string;
  creditsUsed?: number;
  creditsLimit?: number;
  runCount?: number;
}

interface AccountScreenProps {
  authState?: MobileAuthState;
  devices?: MobileDevice[];
  usage?: AccountUsageSummary;
}

export function AccountScreen({ authState, devices = [], usage }: AccountScreenProps) {
  const account = authState?.account;
  const workspace = authState?.workspaces.find((item) => item.id === authState.activeWorkspaceId);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Account</Text>
      <View style={styles.row}>
        <Text style={styles.label}>User</Text>
        <Text style={styles.value}>{account?.displayName ?? account?.email ?? "Not signed in"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Plan</Text>
        <Text style={styles.value}>{account?.planTier ?? "Unavailable"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Workspace</Text>
        <Text style={styles.value}>{workspace?.name ?? "No workspace"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Devices</Text>
        <Text style={styles.value}>{devices.length}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Usage</Text>
        <Text style={styles.value}>{formatUsage(usage)}</Text>
      </View>
    </View>
  );
}

function formatUsage(usage?: AccountUsageSummary): string {
  if (!usage) return "Unavailable";
  if (usage.creditsUsed !== undefined && usage.creditsLimit !== undefined) {
    return `${usage.creditsUsed}/${usage.creditsLimit} credits, ${usage.periodLabel}`;
  }
  if (usage.runCount !== undefined) {
    return `${usage.runCount} runs, ${usage.periodLabel}`;
  }
  return usage.periodLabel;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 12,
    padding: 16,
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  label: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "700",
  },
  value: {
    color: "#F7FAFC",
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
});
