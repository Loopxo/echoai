import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FileUploadKind, FileUploadProgress } from "../files";

interface FileUploadScreenProps {
  uploads?: FileUploadProgress[];
  onPick?: (kind: FileUploadKind) => void;
}

const kinds: FileUploadKind[] = ["photo", "video", "document", "file"];

export function FileUploadScreen({ uploads = [], onPick }: FileUploadScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Upload files</Text>
      <View style={styles.grid}>
        {kinds.map((kind) => (
          <Pressable key={kind} style={styles.kindButton} onPress={() => onPick?.(kind)}>
            <Text style={styles.kindText}>{kind}</Text>
          </Pressable>
        ))}
      </View>
      {uploads.length === 0 ? <Text style={styles.empty}>No uploads in progress</Text> : null}
      {uploads.map((upload) => (
        <View key={upload.file.id} style={styles.upload}>
          <Text style={styles.name}>{upload.file.name}</Text>
          <Text style={styles.meta}>{Math.round(upload.progress * 100)}% - {upload.file.status}</Text>
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
  upload: {
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
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
});
