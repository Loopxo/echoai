import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getDesktopHomeStatus, type DesktopHomeState } from "../desktop";

interface DesktopHomeScreenProps {
  onAction?: (action: DesktopHomeState["quickActions"][number]) => void;
  state?: DesktopHomeState;
}

export function DesktopHomeScreen({ state = { quickActions: [] }, onAction }: DesktopHomeScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Desktop</Text>
      <Text style={styles.status}>{getDesktopHomeStatus(state)}</Text>
      <Text style={styles.meta}>Workspace: {state.workspaceName ?? "none"}</Text>
      <Text style={styles.meta}>Active run: {state.activeRunStatus ?? "none"}</Text>
      <View style={styles.actions}>
        {state.quickActions.map((action) => (
          <Pressable key={action} style={styles.button} onPress={() => onAction?.(action)}>
            <Text style={styles.buttonText}>{action}</Text>
          </Pressable>
        ))}
      </View>
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
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
});
