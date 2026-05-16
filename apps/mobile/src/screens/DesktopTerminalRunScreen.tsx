import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { tailTerminalRun, type DesktopTerminalRun } from "../desktop";

interface DesktopTerminalRunScreenProps {
  run?: DesktopTerminalRun;
}

export function DesktopTerminalRunScreen({ run }: DesktopTerminalRunScreenProps) {
  const lines = run ? tailTerminalRun(run, 60) : [];

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Terminal run</Text>
      {!run ? <Text style={styles.empty}>No desktop command running</Text> : null}
      {run ? <Text style={styles.command}>{run.command}</Text> : null}
      {lines.map((line) => (
        <Text key={line.id} style={line.stream === "stderr" ? styles.stderr : styles.stdout}>
          {line.text}
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
  command: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
  stdout: {
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
  },
  stderr: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "700",
  },
});
