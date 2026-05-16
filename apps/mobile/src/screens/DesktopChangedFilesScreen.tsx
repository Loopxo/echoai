import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { summarizeChangedFiles, type DesktopChangedFile } from "../desktop";

interface DesktopChangedFilesScreenProps {
  files?: DesktopChangedFile[];
}

export function DesktopChangedFilesScreen({ files = [] }: DesktopChangedFilesScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Changed files</Text>
      <Text style={styles.meta}>{summarizeChangedFiles(files)}</Text>
      {files.length === 0 ? <Text style={styles.empty}>No desktop file changes</Text> : null}
      {files.map((file) => (
        <View key={file.path} style={styles.file}>
          <Text style={styles.path}>{file.path}</Text>
          <Text style={styles.diff}>{file.status} +{file.additions} -{file.deletions}</Text>
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
  meta: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  file: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  path: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "800",
  },
  diff: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
});
