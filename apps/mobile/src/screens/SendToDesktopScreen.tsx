import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { buildDesktopPromptRequest, type DesktopPromptRequest } from "../desktop";

interface SendToDesktopScreenProps {
  desktopDeviceId?: string;
  localWorkspacePath?: string;
  onSend?: (request: DesktopPromptRequest) => void;
}

export function SendToDesktopScreen({ desktopDeviceId, localWorkspacePath, onSend }: SendToDesktopScreenProps) {
  const [prompt, setPrompt] = useState("");
  const canSend = Boolean(desktopDeviceId && prompt.trim());

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Send to desktop</Text>
      <Text style={styles.meta}>Workspace: {localWorkspacePath ?? "not selected"}</Text>
      <TextInput
        multiline
        onChangeText={setPrompt}
        placeholder="Ask desktop to work here"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={prompt}
      />
      <Pressable
        style={canSend ? styles.button : styles.buttonDisabled}
        onPress={() => {
          if (desktopDeviceId && canSend) {
            onSend?.(buildDesktopPromptRequest({ desktopDeviceId, localWorkspacePath, prompt }));
          }
        }}
      >
        <Text style={styles.buttonText}>Send</Text>
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
  input: {
    backgroundColor: "#101418",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    padding: 12,
  },
  buttonDisabled: {
    alignItems: "center",
    backgroundColor: "#26313A",
    borderRadius: 10,
    padding: 12,
  },
  buttonText: {
    color: "#101418",
    fontSize: 14,
    fontWeight: "900",
  },
});
