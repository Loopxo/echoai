import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ModelPreference, ModelSettings } from "../settings";

interface ModelSettingsScreenProps {
  onSelectPreference?: (preference: ModelPreference) => void;
  settings?: ModelSettings;
}

const preferences: ModelPreference[] = ["free", "premium", "byok", "desktop-local"];

export function ModelSettingsScreen({ settings = { preference: "free" }, onSelectPreference }: ModelSettingsScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Model settings</Text>
      <Text style={styles.meta}>Default: {settings.defaultModelId ?? "system"}</Text>
      {preferences.map((preference) => (
        <Pressable key={preference} style={preference === settings.preference ? styles.optionActive : styles.option} onPress={() => onSelectPreference?.(preference)}>
          <Text style={styles.optionText}>{preference}</Text>
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
  meta: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "700",
  },
  option: {
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  optionActive: {
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  optionText: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
