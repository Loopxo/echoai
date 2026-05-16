import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { PermissionDashboardItem } from "../settings";

interface PermissionDashboardScreenProps {
  permissions?: PermissionDashboardItem[];
}

export function PermissionDashboardScreen({ permissions = [] }: PermissionDashboardScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Permissions</Text>
      {permissions.length === 0 ? <Text style={styles.empty}>No permission status loaded</Text> : null}
      {permissions.map((permission) => (
        <View key={permission.key} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>{permission.key}</Text>
            <Text style={styles.reason}>{permission.reason}</Text>
          </View>
          <Text style={styles.status}>{permission.status}</Text>
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
  label: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  reason: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  status: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
