import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ChatStreamingState } from "../chat";

interface StreamingResponseScreenProps {
  stream?: ChatStreamingState;
}

export function StreamingResponseScreen({ stream }: StreamingResponseScreenProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Live response</Text>
        <Text style={styles.status}>{stream?.status ?? "idle"}</Text>
      </View>
      {stream?.text ? <Text style={styles.body}>{stream.text}</Text> : <Text style={styles.empty}>No active stream</Text>}
      {stream?.toolCallId ? <Text style={styles.meta}>Tool: {stream.toolCallId}</Text> : null}
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
  status: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
});
