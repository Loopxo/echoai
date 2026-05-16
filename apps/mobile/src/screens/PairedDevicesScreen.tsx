import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MobileDevice, MobileEntityId } from "../protocol";

interface PairedDevicesScreenProps {
  activeWorkspaceId?: MobileEntityId;
  devices?: MobileDevice[];
}

export function PairedDevicesScreen({ activeWorkspaceId, devices = [] }: PairedDevicesScreenProps) {
  const trustedDevices = devices.filter((device) => device.trustState === "trusted");

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Paired devices</Text>
        <Text style={styles.count}>{trustedDevices.length}</Text>
      </View>
      {trustedDevices.length === 0 ? <Text style={styles.empty}>No trusted desktop devices</Text> : null}
      {trustedDevices.map((device) => (
        <View key={device.id} style={styles.device}>
          <View style={styles.row}>
            <Text style={styles.name}>{device.displayName}</Text>
            <Text style={styles.status}>{device.platform}</Text>
          </View>
          <Text style={styles.meta}>Workspace: {activeWorkspaceId ?? "not selected"}</Text>
          <Text style={styles.meta}>Capabilities: {device.capabilities.join(", ")}</Text>
          <Text style={styles.meta}>Last seen: {device.lastSeenAt ?? "never"}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  count: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "800",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  device: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  name: {
    color: "#F7FAFC",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  status: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
});
