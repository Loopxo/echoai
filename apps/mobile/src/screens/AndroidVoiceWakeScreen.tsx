import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createAndroidVoiceWakeConfig, type AndroidVoiceWakeConfig } from "../voice";

interface AndroidVoiceWakeScreenProps {
  onEnable?: (config: AndroidVoiceWakeConfig) => void;
}

export function AndroidVoiceWakeScreen({ onEnable }: AndroidVoiceWakeScreenProps) {
  const [wakePhrase, setWakePhrase] = useState("Hey EchoAI");

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Android voice wake</Text>
      <TextInput
        onChangeText={setWakePhrase}
        placeholder="Wake phrase"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={wakePhrase}
      />
      <Pressable style={styles.button} onPress={() => onEnable?.(createAndroidVoiceWakeConfig(wakePhrase))}>
        <Text style={styles.buttonText}>Enable foreground listener</Text>
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
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
});
