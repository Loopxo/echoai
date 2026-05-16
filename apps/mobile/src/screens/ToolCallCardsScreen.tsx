import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatToolCallKind, type ToolCallTrace } from "../tooling";

interface ToolCallCardsScreenProps {
  toolCalls?: ToolCallTrace[];
}

export function ToolCallCardsScreen({ toolCalls = [] }: ToolCallCardsScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Tool calls</Text>
      {toolCalls.length === 0 ? <Text style={styles.empty}>No tool calls recorded</Text> : null}
      {toolCalls.map((toolCall) => (
        <View key={toolCall.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>{toolCall.title}</Text>
            <Text style={styles.kind}>{formatToolCallKind(toolCall.kind)}</Text>
          </View>
          <Text style={styles.meta}>{toolCall.status} - risk {toolCall.risk ?? "low"}</Text>
          {toolCall.inputPreview ? <Text style={styles.preview}>{toolCall.inputPreview}</Text> : null}
          {toolCall.outputPreview ? <Text style={styles.preview}>{toolCall.outputPreview}</Text> : null}
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
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
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
  kind: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
  preview: {
    backgroundColor: "#101418",
    borderRadius: 8,
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
    padding: 8,
  },
});
