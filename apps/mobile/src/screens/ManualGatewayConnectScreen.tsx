import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { ManualGatewayConnectRequest } from "../gateway";

interface ManualGatewayConnectScreenProps {
  onConnect?: (request: ManualGatewayConnectRequest) => void;
}

export function ManualGatewayConnectScreen({ onConnect }: ManualGatewayConnectScreenProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("49321");
  const [token, setToken] = useState("");
  const [tls, setTls] = useState(true);

  const numericPort = Number.parseInt(port, 10);
  const canConnect = host.trim().length > 0 && Number.isInteger(numericPort) && numericPort > 0 && token.trim().length > 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Manual gateway</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setHost}
        placeholder="Host or IP"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={host}
      />
      <TextInput
        keyboardType="number-pad"
        onChangeText={setPort}
        placeholder="Port"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={port}
      />
      <TextInput
        autoCapitalize="none"
        onChangeText={setToken}
        placeholder="Pairing token"
        placeholderTextColor="#7F8C96"
        secureTextEntry
        style={styles.input}
        value={token}
      />
      <Pressable style={styles.toggle} onPress={() => setTls((value) => !value)}>
        <Text style={styles.toggleLabel}>TLS</Text>
        <Text style={styles.toggleValue}>{tls ? "On" : "Off"}</Text>
      </Pressable>
      <Pressable
        style={canConnect ? styles.button : styles.buttonDisabled}
        onPress={() => {
          if (canConnect) {
            onConnect?.({ host, port: numericPort, tls, token });
          }
        }}
      >
        <Text style={styles.buttonText}>Connect</Text>
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
  toggle: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  toggleLabel: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  toggleValue: {
    color: "#7DD3FC",
    fontSize: 14,
    fontWeight: "800",
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
