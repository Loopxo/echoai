import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface AudioCaptureScreenProps {
  onRecord?: () => void;
  onTranscribe?: () => void;
}

export function AudioCaptureScreen({ onRecord, onTranscribe }: AudioCaptureScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Audio capture</Text>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={onRecord}>
          <Text style={styles.buttonText}>Record</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onTranscribe}>
          <Text style={styles.buttonText}>Transcribe</Text>
        </Pressable>
      </View>
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
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
});
