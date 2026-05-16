import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { exportDebugLogs, type DebugLogLine } from "../settings";

interface DebugLogsScreenProps {
  lines?: DebugLogLine[];
  onExport?: (payload: string) => void;
}

export function DebugLogsScreen({ lines = [], onExport }: DebugLogsScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Debug logs</Text>
      <Text style={styles.meta}>{lines.length} log lines</Text>
      <Pressable style={styles.button} onPress={() => onExport?.(exportDebugLogs(lines))}>
        <Text style={styles.buttonText}>Export redacted logs</Text>
      </Pressable>
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
