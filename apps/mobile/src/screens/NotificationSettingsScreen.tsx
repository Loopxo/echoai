import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { NotificationSettings } from "../settings";

interface NotificationSettingsScreenProps {
  onToggle?: (key: keyof NotificationSettings) => void;
  settings?: NotificationSettings;
}

const defaults: NotificationSettings = {
  approvals: true,
  automations: true,
  billing: true,
  devices: true,
  runCompleted: true,
};

export function NotificationSettingsScreen({ settings = defaults, onToggle }: NotificationSettingsScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Notifications</Text>
      {(Object.keys(settings) as Array<keyof NotificationSettings>).map((key) => (
        <Pressable key={key} style={styles.row} onPress={() => onToggle?.(key)}>
          <Text style={styles.label}>{key}</Text>
          <Text style={styles.value}>{settings[key] ? "On" : "Off"}</Text>
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
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  label: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  value: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
});
