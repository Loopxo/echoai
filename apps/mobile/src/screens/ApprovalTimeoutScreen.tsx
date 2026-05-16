import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { getApprovalEffectiveStatus } from "../approvals";
import type { MobileApprovalRequest } from "../protocol";

interface ApprovalTimeoutScreenProps {
  approvals?: MobileApprovalRequest[];
}

export function ApprovalTimeoutScreen({ approvals = [] }: ApprovalTimeoutScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Approval timeouts</Text>
      {approvals.length === 0 ? <Text style={styles.empty}>No approvals to evaluate</Text> : null}
      {approvals.map((approval) => {
        const status = getApprovalEffectiveStatus(approval);
        return (
          <View key={approval.id} style={styles.row}>
            <Text style={styles.title}>{approval.title}</Text>
            <Text style={status === "expired" ? styles.expired : styles.status}>{status}</Text>
          </View>
        );
      })}
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
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  title: {
    color: "#F7FAFC",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  status: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  expired: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
