import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { defaultLocalCacheEncryptionState, type LocalCacheEncryptionState } from "../settings";

interface CacheEncryptionScreenProps {
  state?: LocalCacheEncryptionState;
}

export function CacheEncryptionScreen({ state = defaultLocalCacheEncryptionState }: CacheEncryptionScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Cache encryption</Text>
      <Text style={styles.status}>{state.enabled ? "Enabled" : "Disabled"}</Text>
      <Text style={styles.meta}>Algorithm: {state.algorithm}</Text>
      <Text style={styles.meta}>Collections: {state.encryptedCollections.join(", ")}</Text>
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
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
});
