import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createWebHandoffUrl, type WebHandoffTarget } from "../desktop";

interface WebHandoffScreenProps {
  onOpen?: (target: WebHandoffTarget) => void;
  target?: WebHandoffTarget;
}

export function WebHandoffScreen({ target, onOpen }: WebHandoffScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Open in web</Text>
      <Text style={styles.meta}>{target ? createWebHandoffUrl(target) : "No session selected"}</Text>
      <Pressable style={target ? styles.button : styles.buttonDisabled} onPress={() => target ? onOpen?.(target) : undefined}>
        <Text style={styles.buttonText}>Open web session</Text>
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
    fontSize: 12,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  buttonDisabled: {
    alignItems: "center",
    borderColor: "#26313A",
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
