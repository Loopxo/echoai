import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CameraContextCommand } from "../capture";

interface CameraContextCommandScreenProps {
  command?: CameraContextCommand;
  onApprove?: (command: CameraContextCommand) => void;
  onDeny?: (command: CameraContextCommand) => void;
}

export function CameraContextCommandScreen({ command, onApprove, onDeny }: CameraContextCommandScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Camera request</Text>
      {command ? (
        <View style={styles.card}>
          <Text style={styles.prompt}>{command.prompt}</Text>
          <Text style={styles.meta}>{command.status}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.denyButton} onPress={() => onDeny?.(command)}>
              <Text style={styles.denyText}>Deny</Text>
            </Pressable>
            <Pressable style={styles.approveButton} onPress={() => onApprove?.(command)}>
              <Text style={styles.approveText}>Allow camera</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>No camera context request</Text>
      )}
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
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  prompt: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  denyButton: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  approveButton: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    flex: 1,
    padding: 10,
  },
  denyText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
  approveText: {
    color: "#101418",
    fontSize: 12,
    fontWeight: "900",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
});
