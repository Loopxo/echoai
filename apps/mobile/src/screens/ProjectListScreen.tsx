import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { searchProjects } from "../projects";
import type { MobileProjectSummary } from "../protocol";

interface ProjectListScreenProps {
  onOpenProject?: (project: MobileProjectSummary) => void;
  projects?: MobileProjectSummary[];
}

export function ProjectListScreen({ projects = [], onOpenProject }: ProjectListScreenProps) {
  const [query, setQuery] = useState("");
  const visibleProjects = searchProjects(projects, query);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Projects</Text>
      <TextInput
        onChangeText={setQuery}
        placeholder="Search projects"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={query}
      />
      {visibleProjects.length === 0 ? <Text style={styles.empty}>No projects found</Text> : null}
      {visibleProjects.map((project) => (
        <Pressable key={project.id} style={styles.project} onPress={() => onOpenProject?.(project)}>
          <Text style={styles.name}>{project.name}</Text>
          <Text style={styles.meta}>{project.sessionCount} chats - {project.fileCount} files</Text>
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
  input: {
    backgroundColor: "#101418",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  project: {
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
