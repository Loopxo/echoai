import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getQueuedOfflineCaptures, type OfflineCaptureItem } from "../capture";

interface OfflineCaptureQueueScreenProps {
  items?: OfflineCaptureItem[];
  onSync?: (items: OfflineCaptureItem[]) => void;
}

export function OfflineCaptureQueueScreen({ items = [], onSync }: OfflineCaptureQueueScreenProps) {
  const queuedItems = getQueuedOfflineCaptures(items);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Offline queue</Text>
      {queuedItems.length === 0 ? <Text style={styles.empty}>No offline captures waiting</Text> : null}
      {queuedItems.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.kind}>{item.kind}</Text>
          <Text style={styles.meta}>{item.status} - {item.capturedAt}</Text>
        </View>
      ))}
      <Pressable style={styles.button} onPress={() => onSync?.(queuedItems)}>
        <Text style={styles.buttonText}>Sync queue</Text>
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
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  item: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  kind: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
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
