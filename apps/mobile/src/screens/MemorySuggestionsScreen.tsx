import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MemorySuggestion } from "../memories";

interface MemorySuggestionsScreenProps {
  onApprove?: (suggestion: MemorySuggestion) => void;
  onDismiss?: (suggestion: MemorySuggestion) => void;
  suggestions?: MemorySuggestion[];
}

export function MemorySuggestionsScreen({ suggestions = [], onApprove, onDismiss }: MemorySuggestionsScreenProps) {
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "pending");

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Memory suggestions</Text>
      {pendingSuggestions.length === 0 ? <Text style={styles.empty}>No pending memory suggestions</Text> : null}
      {pendingSuggestions.map((suggestion) => (
        <View key={suggestion.id} style={styles.suggestion}>
          <Text style={styles.content}>{suggestion.content}</Text>
          {suggestion.reason ? <Text style={styles.meta}>{suggestion.reason}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.dismissButton} onPress={() => onDismiss?.(suggestion)}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
            <Pressable style={styles.approveButton} onPress={() => onApprove?.(suggestion)}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
          </View>
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
  suggestion: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  content: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  dismissButton: {
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
  dismissText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
  approveText: {
    color: "#101418",
    fontSize: 12,
    fontWeight: "900",
  },
});
