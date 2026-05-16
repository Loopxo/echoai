import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { tailRemoteLogs, type RemoteLogLine } from "../tooling";

interface RemoteLogsScreenProps {
  lines?: RemoteLogLine[];
}

export function RemoteLogsScreen({ lines = [] }: RemoteLogsScreenProps) {
  const visibleLines = tailRemoteLogs(lines, 50);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Remote logs</Text>
      {visibleLines.length === 0 ? <Text style={styles.empty}>No remote log output</Text> : null}
      {visibleLines.map((line) => (
        <Text key={line.id} style={line.level === "error" ? styles.errorLine : styles.line}>
          {line.timestamp} [{line.level}] {line.message}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 6,
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
  line: {
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
  },
  errorLine: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "700",
  },
});
