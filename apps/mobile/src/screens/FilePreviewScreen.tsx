import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { getFilePreviewKind } from "../files";
import type { MobileFileSummary } from "../protocol";

interface FilePreviewScreenProps {
  file?: MobileFileSummary;
  previewText?: string;
  previewUri?: string;
}

export function FilePreviewScreen({ file, previewText, previewUri }: FilePreviewScreenProps) {
  const kind = file ? getFilePreviewKind(file) : undefined;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>File preview</Text>
      {!file ? <Text style={styles.empty}>Select a file to preview</Text> : null}
      {file ? (
        <View style={styles.card}>
          <Text style={styles.name}>{file.name}</Text>
          <Text style={styles.meta}>{kind} - {file.sizeBytes} bytes</Text>
          {kind === "image" && previewUri ? <Image source={{ uri: previewUri }} style={styles.image} /> : null}
          {kind !== "image" ? <Text style={styles.preview}>{previewText ?? "Metadata preview only"}</Text> : null}
        </View>
      ) : null}
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
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
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
    fontWeight: "700",
  },
  image: {
    aspectRatio: 1.4,
    backgroundColor: "#101418",
    borderRadius: 10,
    width: "100%",
  },
  preview: {
    backgroundColor: "#101418",
    borderRadius: 8,
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
    padding: 8,
  },
});
