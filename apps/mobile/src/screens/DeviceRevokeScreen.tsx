import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileDevice, MobileEntityId } from "../protocol";

interface DeviceRevokeScreenProps {
  devices?: MobileDevice[];
  onRevoke?: (deviceId: MobileEntityId) => void;
}

export function DeviceRevokeScreen({ devices = [], onRevoke }: DeviceRevokeScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Unpair device</Text>
      {devices.length === 0 ? <Text style={styles.empty}>No devices available to revoke</Text> : null}
      {devices.map((device) => (
        <View key={device.id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.name}>{device.displayName}</Text>
            <Text style={styles.meta}>{device.trustState}</Text>
          </View>
          <Pressable style={styles.button} onPress={() => onRevoke?.(device.id)}>
            <Text style={styles.buttonText}>Revoke</Text>
          </Pressable>
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
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  copy: {
    flexShrink: 1,
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
    marginTop: 3,
  },
  button: {
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
});
