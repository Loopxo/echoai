import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileEntityId, MobileSessionSource } from "../protocol";

interface StopRunScreenProps {
  runId?: MobileEntityId;
  sessionId?: MobileEntityId;
  source?: MobileSessionSource;
  onStop?: (request: { runId: MobileEntityId; sessionId: MobileEntityId; source: MobileSessionSource }) => void;
}

export function StopRunScreen({ runId, sessionId, source = "cloud", onStop }: StopRunScreenProps) {
  const canStop = Boolean(runId && sessionId);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Active run</Text>
      <Text style={styles.meta}>{runId ? `Run ${runId}` : "No active run"}</Text>
      <Pressable
        style={canStop ? styles.button : styles.buttonDisabled}
        onPress={() => {
          if (runId && sessionId) {
            onStop?.({ runId, sessionId, source });
          }
        }}
      >
        <Text style={styles.buttonText}>Stop</Text>
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
    fontSize: 12,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonDisabled: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonText: {
    color: "#F87171",
    fontSize: 14,
    fontWeight: "900",
  },
});
