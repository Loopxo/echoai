import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getPendingApprovals } from "../approvals";
import type { MobileApprovalRequest } from "../protocol";

interface ApprovalInboxScreenProps {
  approvals?: MobileApprovalRequest[];
  onOpenApproval?: (approval: MobileApprovalRequest) => void;
}

export function ApprovalInboxScreen({ approvals = [], onOpenApproval }: ApprovalInboxScreenProps) {
  const pendingApprovals = getPendingApprovals(approvals);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Approvals</Text>
        <Text style={styles.count}>{pendingApprovals.length}</Text>
      </View>
      {pendingApprovals.length === 0 ? <Text style={styles.empty}>No pending approvals</Text> : null}
      {pendingApprovals.map((approval) => (
        <Pressable key={approval.id} style={styles.approval} onPress={() => onOpenApproval?.(approval)}>
          <View style={styles.copy}>
            <Text style={styles.title}>{approval.title}</Text>
            <Text style={styles.meta}>{approval.toolName} - {approval.requestedAt}</Text>
          </View>
          <Text style={styles.risk}>{approval.risk}</Text>
        </Pressable>
      ))}
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  count: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "800",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  approval: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  copy: {
    flexShrink: 1,
  },
  title: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  risk: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
