import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ApprovalPushRegistration } from "../approvals";

interface ApprovalPushScreenProps {
  registration?: ApprovalPushRegistration;
  onRegister?: () => void;
}

export function ApprovalPushScreen({ registration, onRegister }: ApprovalPushScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Approval push</Text>
      <Text style={styles.meta}>{registration ? `Registered ${registration.device.displayName}` : "Not registered for approval push"}</Text>
      <Pressable style={styles.button} onPress={onRegister}>
        <Text style={styles.buttonText}>Enable approval push</Text>
      </Pressable>
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
  meta: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
});
