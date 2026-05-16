import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { EchoAIAuthApi } from "../api";
import { completeMobileAuthCallback } from "../auth/mobileAuthCallback";

interface SignInScreenProps {
  authApi?: EchoAIAuthApi;
  redirectUri: string;
}

export function SignInScreen({ authApi, redirectUri }: SignInScreenProps) {
  const [status, setStatus] = useState<"idle" | "opening-sign-in" | "opening-sign-up" | "error">("idle");

  useEffect(() => {
    if (!authApi) return undefined;

    let cancelled = false;

    async function complete(url: string) {
      try {
        const mode = status === "opening-sign-up" ? "sign-up" : "sign-in";
        const result = await completeMobileAuthCallback(authApi!, redirectUri, url, mode);
        if (result && !cancelled) {
          setStatus("idle");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) void complete(url);
    });

    const subscription = Linking.addEventListener("url", (event) => {
      void complete(event.url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [authApi, redirectUri, status]);

  async function startSignIn() {
    if (!authApi) {
      setStatus("error");
      return;
    }

    setStatus("opening-sign-in");
    try {
      const result = await authApi.startSignIn({ redirectUri });
      await Linking.openURL(result.authUrl);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function startSignUp() {
    if (!authApi) {
      setStatus("error");
      return;
    }

    setStatus("opening-sign-up");
    try {
      const result = await authApi.startSignUp({ redirectUri });
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
        <Text style={styles.actionText}>{status === "opening-sign-in" ? "Opening..." : "Continue"}</Text>
      </Pressable>
      <Pressable style={styles.secondaryAction} onPress={startSignUp}>
        <Text style={styles.secondaryActionText}>{status === "opening-sign-up" ? "Opening..." : "Create account"}</Text>
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
  secondaryAction: {
    alignItems: "center",
    borderColor: "#3C4650",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: "#F7FAFC",
    fontSize: 15,
    fontWeight: "700",
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "600",
  },
});
