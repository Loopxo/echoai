import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PrivacyAction } from "../settings";

interface PrivacySettingsScreenProps {
  onRequest?: (action: PrivacyAction) => void;
}

const actions: PrivacyAction[] = ["export-local-cache", "delete-local-cache", "request-account-export", "request-account-delete"];

export function PrivacySettingsScreen({ onRequest }: PrivacySettingsScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Privacy</Text>
      {actions.map((action) => (
        <Pressable key={action} style={action.includes("delete") ? styles.dangerRow : styles.row} onPress={() => onRequest?.(action)}>
          <Text style={styles.label}>{action}</Text>
        </Pressable>
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
  row: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  dangerRow: {
    borderColor: "#F87171",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  label: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "800",
  },
});
