import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { extractApprovalDetails } from "../approvals";
import type { MobileApprovalRequest } from "../protocol";

interface ApprovalDetailsScreenProps {
  approval?: MobileApprovalRequest;
}

export function ApprovalDetailsScreen({ approval }: ApprovalDetailsScreenProps) {
  const details = approval ? extractApprovalDetails(approval) : undefined;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Approval details</Text>
      {!approval || !details ? <Text style={styles.empty}>No approval selected</Text> : null}
      {approval && details ? (
        <View style={styles.card}>
          <Text style={styles.title}>{approval.title}</Text>
          <DetailRow label="Tool" value={details.toolName} />
          <DetailRow label="Risk" value={details.risk} />
          <DetailRow label="Command" value={details.command ?? "not provided"} />
          <DetailRow label="Path" value={details.path ?? "not provided"} />
          <DetailRow label="Reason" value={details.reason ?? "not provided"} />
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  title: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  label: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "800",
  },
  value: {
    color: "#CAD2D9",
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
});
