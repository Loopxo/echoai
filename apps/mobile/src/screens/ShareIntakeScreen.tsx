import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { normalizeShareIntake, type ShareIntakePayload } from "../chat";

interface ShareIntakeScreenProps {
  payload?: ShareIntakePayload;
  onStartChat?: (payload: ReturnType<typeof normalizeShareIntake>) => void;
}

export function ShareIntakeScreen({ payload, onStartChat }: ShareIntakeScreenProps) {
  const draft = payload ? normalizeShareIntake(payload) : undefined;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Shared into EchoAI</Text>
      {draft ? (
        <View style={styles.card}>
          <Text style={styles.meta}>Text: {draft.text || "none"}</Text>
          <Text style={styles.meta}>Attachments: {draft.attachments.length}</Text>
          <Pressable style={styles.button} onPress={() => onStartChat?.(draft)}>
            <Text style={styles.buttonText}>Start chat</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.empty}>No shared content waiting</Text>
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
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  meta: {
    color: "#CAD2D9",
    fontSize: 13,
    fontWeight: "700",
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
