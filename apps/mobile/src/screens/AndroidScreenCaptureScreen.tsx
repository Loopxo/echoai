import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AndroidScreenCaptureSession } from "../capture";

interface AndroidScreenCaptureScreenProps {
  onStart?: (mode: AndroidScreenCaptureSession["mode"]) => void;
  session?: AndroidScreenCaptureSession;
}

export function AndroidScreenCaptureScreen({ session, onStart }: AndroidScreenCaptureScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Android screen capture</Text>
      <Text style={styles.meta}>{session?.status ?? "idle"}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => onStart?.("snapshot")}>
          <Text style={styles.buttonText}>Snapshot</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => onStart?.("stream")}>
          <Text style={styles.buttonText}>Stream</Text>
        </Pressable>
      </View>
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
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
});
