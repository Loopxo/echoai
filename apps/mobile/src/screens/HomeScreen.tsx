import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MOBILE_PROTOCOL_VERSION } from "../protocol";

interface HomeScreenProps {
  apiReady: boolean;
}

export function HomeScreen({ apiReady }: HomeScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{apiReady ? "API client ready" : "API client unavailable"}</Text>
      </View>

      <Text style={styles.title}>Mobile command center</Text>
      <Text style={styles.body}>
        Chat, desktop pairing, approvals, capture, projects, and notifications will land here ticket by ticket.
      </Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>New chat</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>Pair desktop</Text>
        </Pressable>
      </View>

      <Text style={styles.protocol}>Protocol {MOBILE_PROTOCOL_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 18,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statusDot: {
    backgroundColor: "#2ECC71",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusText: {
    color: "#B8C4CC",
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    color: "#F7FAFC",
    fontSize: 28,
    fontWeight: "800",
  },
  body: {
    color: "#B8C4CC",
    fontSize: 16,
    lineHeight: 23,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  primaryAction: {
    backgroundColor: "#7DD3FC",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: "#0A1117",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryAction: {
    borderColor: "#3C4650",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: "#F7FAFC",
    fontSize: 15,
    fontWeight: "700",
  },
  protocol: {
    color: "#7F8C96",
    fontSize: 12,
    marginTop: "auto",
  },
});
