import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileMemory } from "../memories";

interface MemoriesScreenProps {
  memories?: MobileMemory[];
  onAdd?: () => void;
  onDelete?: (memoryId: string) => void;
  onEdit?: (memory: MobileMemory) => void;
}

export function MemoriesScreen({ memories = [], onAdd, onDelete, onEdit }: MemoriesScreenProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Memories</Text>
        <Pressable style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {memories.length === 0 ? <Text style={styles.empty}>No memories saved</Text> : null}
      {memories.map((memory) => (
        <View key={memory.id} style={styles.memory}>
          <Text style={styles.content}>{memory.content}</Text>
          <Text style={styles.meta}>{memory.updatedAt}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={() => onEdit?.(memory)}>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => onDelete?.(memory.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  addButton: {
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  memory: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  content: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
  deleteButton: {
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
});
