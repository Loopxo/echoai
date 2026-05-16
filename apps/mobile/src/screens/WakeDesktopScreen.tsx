import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createWakeDesktopRequest, type WakeDesktopRequest } from "../desktop";

interface WakeDesktopScreenProps {
  desktopDeviceId?: string;
  onWake?: (request: WakeDesktopRequest) => void;
}

export function WakeDesktopScreen({ desktopDeviceId, onWake }: WakeDesktopScreenProps) {
  const [reason, setReason] = useState("");
  const canWake = Boolean(desktopDeviceId);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Wake desktop</Text>
      <TextInput
        onChangeText={setReason}
        placeholder="Reason"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={reason}
      />
      <Pressable
        style={canWake ? styles.button : styles.buttonDisabled}
        onPress={() => {
          if (desktopDeviceId) {
            onWake?.(createWakeDesktopRequest(desktopDeviceId, reason));
          }
        }}
      >
        <Text style={styles.buttonText}>Wake</Text>
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
