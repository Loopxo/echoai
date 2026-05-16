import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { canRenderDesktopSnapshot, type DesktopSnapshotPreview } from "../tooling";

interface DesktopSnapshotScreenProps {
  snapshot?: DesktopSnapshotPreview;
}

export function DesktopSnapshotScreen({ snapshot }: DesktopSnapshotScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Desktop snapshot</Text>
      {canRenderDesktopSnapshot(snapshot) && snapshot?.imageUri ? (
        <View style={styles.preview}>
          <Image source={{ uri: snapshot.imageUri }} style={styles.image} />
          <Text style={styles.meta}>{snapshot.title} - {snapshot.capturedAt ?? "live"}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>{snapshot?.allowed === false ? "Snapshot access is not allowed" : "No snapshot available"}</Text>
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
  preview: {
    gap: 8,
  },
  image: {
    aspectRatio: 1.6,
    backgroundColor: "#101418",
    borderRadius: 10,
    width: "100%",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
});
