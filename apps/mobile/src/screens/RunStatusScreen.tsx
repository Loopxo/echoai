import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { sortRunsByUpdatedAt, type MobileRunTraceSummary } from "../tooling";

interface RunStatusScreenProps {
  runs?: MobileRunTraceSummary[];
}

export function RunStatusScreen({ runs = [] }: RunStatusScreenProps) {
  const sortedRuns = sortRunsByUpdatedAt(runs);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Runs</Text>
        <Text style={styles.count}>{runs.length}</Text>
      </View>
      {sortedRuns.length === 0 ? <Text style={styles.empty}>No active or completed runs</Text> : null}
      {sortedRuns.map((run) => (
        <View key={run.id} style={styles.run}>
          <View style={styles.row}>
            <Text style={styles.title}>{run.title}</Text>
            <Text style={styles.status}>{run.status}</Text>
          </View>
          <Text style={styles.meta}>{run.toolCallCount} tool calls - {run.updatedAt}</Text>
        </View>
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  count: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "800",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  run: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#F7FAFC",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  status: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
});
