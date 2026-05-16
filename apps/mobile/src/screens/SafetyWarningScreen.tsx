import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { getApprovalSafetyLevel } from "../approvals";
import type { MobileApprovalRequest } from "../protocol";

interface SafetyWarningScreenProps {
  approval?: MobileApprovalRequest;
}

export function SafetyWarningScreen({ approval }: SafetyWarningScreenProps) {
  const level = approval ? getApprovalSafetyLevel(approval) : "normal";

  return (
    <View style={level === "strong-confirmation" ? styles.warningPanel : styles.panel}>
      <Text style={styles.heading}>Safety check</Text>
      <Text style={level === "strong-confirmation" ? styles.warningText : styles.meta}>
        {approval ? formatWarning(level) : "No approval selected"}
      </Text>
    </View>
  );
}

function formatWarning(level: ReturnType<typeof getApprovalSafetyLevel>): string {
  if (level === "strong-confirmation") {
    return "This action needs stronger confirmation before it can continue.";
  }
  return "This action can use the standard approval confirmation.";
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 8,
    padding: 16,
  },
  warningPanel: {
    backgroundColor: "#151C22",
    borderColor: "#F59E0B",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "700",
  },
  warningText: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "800",
  },
});
