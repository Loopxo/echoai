import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getApprovedDesktopWorkspaces, type DesktopWorkspace } from "../desktop";

interface DesktopWorkspaceSelectorScreenProps {
  onSelect?: (workspace: DesktopWorkspace) => void;
  workspaces?: DesktopWorkspace[];
}

export function DesktopWorkspaceSelectorScreen({ workspaces = [], onSelect }: DesktopWorkspaceSelectorScreenProps) {
  const approvedWorkspaces = getApprovedDesktopWorkspaces(workspaces);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Desktop workspaces</Text>
      {approvedWorkspaces.length === 0 ? <Text style={styles.empty}>No desktop-approved workspaces</Text> : null}
      {approvedWorkspaces.map((workspace) => (
        <Pressable key={workspace.id} style={styles.workspace} onPress={() => onSelect?.(workspace)}>
          <Text style={styles.name}>{workspace.name}</Text>
          <Text style={styles.path}>{workspace.path}</Text>
        </Pressable>
      ))}
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
  workspace: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  name: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  path: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
});
