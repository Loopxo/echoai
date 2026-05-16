import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { RetryTurnDraft } from "../chat";

interface RetryEditTurnScreenProps {
  draft?: RetryTurnDraft;
  onRetry?: (draft: RetryTurnDraft) => void;
}

export function RetryEditTurnScreen({ draft, onRetry }: RetryEditTurnScreenProps) {
  const [retryText, setRetryText] = useState(draft?.retryText ?? "");
  const nextDraft = draft ? { ...draft, retryText } : undefined;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Retry turn</Text>
      {!draft ? <Text style={styles.empty}>No failed turn selected</Text> : null}
      {draft ? (
        <View style={styles.form}>
          <Text style={styles.meta}>Original</Text>
          <Text style={styles.original}>{draft.originalText}</Text>
          <TextInput
            onChangeText={setRetryText}
            placeholder="Edit and retry"
            placeholderTextColor="#7F8C96"
            style={styles.input}
            value={retryText}
          />
          <Pressable style={styles.button} onPress={() => nextDraft ? onRetry?.(nextDraft) : undefined}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
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
  form: {
    gap: 8,
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "800",
  },
  original: {
    color: "#CAD2D9",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#101418",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    padding: 12,
  },
  buttonText: {
    color: "#101418",
    fontSize: 14,
    fontWeight: "900",
  },
});
