import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AttachmentPickKind } from "../chat";
import type { MobileAttachmentRef } from "../protocol";

interface AttachmentPickerScreenProps {
  attachments?: MobileAttachmentRef[];
  onPick?: (kind: AttachmentPickKind) => void;
  onRemove?: (attachmentId: string) => void;
}

const pickerKinds: AttachmentPickKind[] = ["image", "document", "audio", "file"];

export function AttachmentPickerScreen({ attachments = [], onPick, onRemove }: AttachmentPickerScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Attachments</Text>
      <View style={styles.grid}>
        {pickerKinds.map((kind) => (
          <Pressable key={kind} style={styles.kindButton} onPress={() => onPick?.(kind)}>
            <Text style={styles.kindText}>{kind}</Text>
          </Pressable>
        ))}
      </View>
      {attachments.length === 0 ? <Text style={styles.empty}>No attachments selected</Text> : null}
      {attachments.map((attachment) => (
        <View key={attachment.id} style={styles.attachment}>
          <View style={styles.copy}>
            <Text style={styles.name}>{attachment.name ?? attachment.kind}</Text>
            <Text style={styles.meta}>{attachment.mimeType ?? attachment.uri ?? "local file"}</Text>
          </View>
          <Pressable style={styles.removeButton} onPress={() => onRemove?.(attachment.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
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
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindButton: {
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kindText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  attachment: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  copy: {
    flexShrink: 1,
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
  removeButton: {
    borderColor: "#F87171",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
});
