import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { DesktopBrowserTask } from "../desktop";

interface DesktopBrowserTaskScreenProps {
  task?: DesktopBrowserTask;
}

export function DesktopBrowserTaskScreen({ task }: DesktopBrowserTaskScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Browser task</Text>
      {task ? (
        <View style={styles.card}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.meta}>{task.status} - {task.currentUrl ?? "no url"}</Text>
          {task.lastScreenshotUri ? <Image source={{ uri: task.lastScreenshotUri }} style={styles.image} /> : null}
        </View>
      ) : (
        <Text style={styles.empty}>No browser automation task</Text>
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
  image: {
    aspectRatio: 1.6,
    backgroundColor: "#101418",
    borderRadius: 10,
    width: "100%",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
});
