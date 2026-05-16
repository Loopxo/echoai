import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { parseEchoAIPairingQr, type EchoAIPairingQrPayload } from "../gateway";

interface QrPairingScreenProps {
  onPair?: (payload: EchoAIPairingQrPayload) => void;
}

export function QrPairingScreen({ onPair }: QrPairingScreenProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>QR pairing</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={(nextValue) => {
          setValue(nextValue);
          setError(null);
        }}
        placeholder="Paste EchoAI desktop QR payload"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={value}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={styles.button}
        onPress={() => {
          try {
            onPair?.(parseEchoAIPairingQr(value));
          } catch (currentError) {
            setError(currentError instanceof Error ? currentError.message : "Invalid QR payload");
          }
        }}
      >
        <Text style={styles.buttonText}>Pair from QR</Text>
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
  error: {
    color: "#F87171",
    fontSize: 12,
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
