import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { settingsSections, type SettingsSection } from "../settings";

interface SettingsHomeScreenProps {
  onOpenSection?: (section: SettingsSection) => void;
}

export function SettingsHomeScreen({ onOpenSection }: SettingsHomeScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Settings</Text>
      {settingsSections.map((section) => (
        <Pressable key={section} style={styles.row} onPress={() => onOpenSection?.(section)}>
          <Text style={styles.label}>{section}</Text>
          <Text style={styles.action}>Open</Text>
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
    textTransform: "capitalize",
  },
  action: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
});
