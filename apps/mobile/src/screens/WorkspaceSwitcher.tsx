import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileEntityId, MobileWorkspace } from "../protocol";

interface WorkspaceSwitcherProps {
  activeWorkspaceId?: MobileEntityId;
  workspaces: MobileWorkspace[];
  onSelect: (workspaceId: MobileEntityId) => void;
}

export function WorkspaceSwitcher({ activeWorkspaceId, workspaces, onSelect }: WorkspaceSwitcherProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Workspace</Text>
      {workspaces.length === 0 ? <Text style={styles.empty}>No workspaces available</Text> : null}
      {workspaces.map((workspace) => {
        const selected = workspace.id === activeWorkspaceId;
        const rowStyle = selected ? { ...styles.row, ...styles.selected } : styles.row;
        return (
          <Pressable key={workspace.id} style={rowStyle} onPress={() => onSelect(workspace.id)}>
            <View>
              <Text style={styles.name}>{workspace.name}</Text>
              <Text style={styles.meta}>
                {workspace.role} - {workspace.planTier}
              </Text>
            </View>
            <Text style={styles.state}>{selected ? "Active" : "Switch"}</Text>
          </Pressable>
        );
      })}
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
  row: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  selected: {
    borderColor: "#7DD3FC",
  },
  name: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  state: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
  },
});
