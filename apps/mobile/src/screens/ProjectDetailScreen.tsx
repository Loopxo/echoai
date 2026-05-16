import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { GroupedProjectDetail } from "../projects";

interface ProjectDetailScreenProps {
  detail?: GroupedProjectDetail;
}

export function ProjectDetailScreen({ detail }: ProjectDetailScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{detail?.project.name ?? "Project detail"}</Text>
      {!detail ? <Text style={styles.empty}>Open a project to view detail</Text> : null}
      {detail ? (
        <View style={styles.grid}>
          <Metric label="Chats" value={detail.chats.length} />
          <Metric label="Notes" value={detail.notes.length} />
          <Metric label="Files" value={detail.files.length} />
          <Metric label="Memories" value={detail.memories.length} />
          <Metric label="Automations" value={detail.automations.length} />
          <Metric label="Outputs" value={detail.outputs.length} />
        </View>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metric: {
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 96,
    padding: 10,
  },
  metricValue: {
    color: "#7DD3FC",
    fontSize: 18,
    fontWeight: "900",
  },
  metricLabel: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
});
