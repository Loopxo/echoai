import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { smsCapabilityDecision } from "../capture";

export function SmsCapabilityDecisionScreen() {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>SMS capability</Text>
      <Text style={styles.status}>{smsCapabilityDecision.decision}</Text>
      <Text style={styles.reason}>{smsCapabilityDecision.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 8,
    padding: 16,
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  status: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  reason: {
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
  },
});
