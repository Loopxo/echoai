import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { EchoAIAuthApi } from "../api";

interface SignInScreenProps {
  authApi?: EchoAIAuthApi;
  redirectUri: string;
}

export function SignInScreen({ authApi, redirectUri }: SignInScreenProps) {
  const [status, setStatus] = useState<"idle" | "opening" | "error">("idle");

  async function startSignIn() {
    if (!authApi) {
      setStatus("error");
      return;
    }

    setStatus("opening");
    try {
      const result = await authApi.startSignIn({ redirectUri });
      await Linking.openURL(result.authUrl);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.body}>Use your secure browser session to connect this device to EchoAI.</Text>
      <Pressable style={styles.action} onPress={startSignIn}>
        <Text style={styles.actionText}>{status === "opening" ? "Opening..." : "Continue"}</Text>
      </Pressable>
      {status === "error" ? <Text style={styles.error}>Sign-in could not start.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 12,
    padding: 16,
  },
  title: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  body: {
    color: "#B8C4CC",
    fontSize: 15,
    lineHeight: 22,
  },
  action: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionText: {
    color: "#0A1117",
    fontSize: 15,
    fontWeight: "800",
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "600",
  },
});
