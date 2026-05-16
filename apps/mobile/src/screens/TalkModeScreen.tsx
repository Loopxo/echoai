import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TalkModeSettings } from "../voice";

interface TalkModeScreenProps {
  onToggle?: () => void;
  settings?: TalkModeSettings;
}

export function TalkModeScreen({ settings = { enabled: false, rate: 1 }, onToggle }: TalkModeScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Talk mode</Text>
      <Text style={styles.meta}>{settings.enabled ? "Assistant speech enabled" : "Assistant speech disabled"}</Text>
      <Text style={styles.meta}>Rate: {settings.rate}</Text>
      <Pressable style={styles.button} onPress={onToggle}>
        <Text style={styles.buttonText}>{settings.enabled ? "Disable" : "Enable"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 8,
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
  button: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
});
