import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createApprovalDecision } from "../approvals";
import type { MobileApprovalDecision, MobileApprovalRequest } from "../protocol";

interface ApprovalDecisionScreenProps {
  approval?: MobileApprovalRequest;
  onDecide?: (decision: MobileApprovalDecision) => void;
}

export function ApprovalDecisionScreen({ approval, onDecide }: ApprovalDecisionScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Approve action</Text>
      {approval ? (
        <View style={styles.card}>
          <Text style={styles.title}>{approval.title}</Text>
          <Text style={styles.meta}>{approval.toolName} - {approval.risk}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.denyButton} onPress={() => onDecide?.(createApprovalDecision(approval, "deny"))}>
              <Text style={styles.denyText}>Deny</Text>
            </Pressable>
            <Pressable style={styles.approveButton} onPress={() => onDecide?.(createApprovalDecision(approval, "approve"))}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>Select an approval request</Text>
      )}
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
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  title: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  denyButton: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  approveButton: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    flex: 1,
    padding: 12,
  },
  denyText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "900",
  },
  approveText: {
    color: "#101418",
    fontSize: 13,
    fontWeight: "900",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
});
