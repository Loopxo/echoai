import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { RemoteDiffApproval } from "../desktop";

interface RemoteDiffApprovalScreenProps {
  approval?: RemoteDiffApproval;
  onDecide?: (decision: "approved" | "rejected") => void;
}

export function RemoteDiffApprovalScreen({ approval, onDecide }: RemoteDiffApprovalScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Patch approval</Text>
      {approval ? (
        <View style={styles.card}>
          <Text style={styles.title}>{approval.title}</Text>
          <Text style={styles.meta}>{approval.changedFiles.length} changed files</Text>
          <Text style={styles.patch}>{approval.patchPreview}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.rejectButton} onPress={() => onDecide?.("rejected")}>
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
            <Pressable style={styles.approveButton} onPress={() => onDecide?.("approved")}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>No pending patch approval</Text>
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
    gap: 8,
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
  patch: {
    backgroundColor: "#101418",
    borderRadius: 8,
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
    padding: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  rejectButton: {
    alignItems: "center",
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  approveButton: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    flex: 1,
    padding: 10,
  },
  rejectText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
  approveText: {
    color: "#101418",
    fontSize: 12,
    fontWeight: "900",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
});
