import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { iosScreenFlowCapability } from "../capture";

export function IosScreenFlowScreen() {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>iOS screen flow</Text>
      <Text style={styles.meta}>In-app snapshot: {iosScreenFlowCapability.inAppSnapshot}</Text>
      <Text style={styles.meta}>ReplayKit: {iosScreenFlowCapability.replayKitBroadcast}</Text>
      <Text style={styles.meta}>Background capture: {iosScreenFlowCapability.fullDeviceBackgroundCapture}</Text>
      {iosScreenFlowCapability.notes.map((note) => (
        <Text key={note} style={styles.note}>{note}</Text>
      ))}
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
  meta: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
  },
  note: {
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
  },
});
