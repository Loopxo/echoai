import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PushToTalkState } from "../voice";

interface PushToTalkScreenProps {
  onStart?: () => void;
  onStop?: () => void;
  state?: PushToTalkState;
}

export function PushToTalkScreen({ state = { isRecording: false }, onStart, onStop }: PushToTalkScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Push to talk</Text>
      <Text style={styles.meta}>{state.isRecording ? "Recording" : state.transcriptDraft ?? "Ready"}</Text>
      <Pressable style={state.isRecording ? styles.stopButton : styles.button} onPress={state.isRecording ? onStop : onStart}>
        <Text style={state.isRecording ? styles.stopText : styles.buttonText}>{state.isRecording ? "Stop" : "Hold to talk"}</Text>
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
    fontSize: 13,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    padding: 12,
  },
  stopButton: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonText: {
    color: "#101418",
    fontSize: 14,
    fontWeight: "900",
  },
  stopText: {
    color: "#F87171",
    fontSize: 14,
    fontWeight: "900",
  },
});
