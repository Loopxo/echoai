import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { MobileEntityId, MobileModelRef, MobileProjectSummary, MobileSessionSource } from "../protocol";

export interface NewChatRequest {
  model?: MobileModelRef;
  projectId?: MobileEntityId;
  source: MobileSessionSource;
  text: string;
}

interface NewChatScreenProps {
  models?: MobileModelRef[];
  projects?: MobileProjectSummary[];
  onStart?: (request: NewChatRequest) => void;
}

export function NewChatScreen({ models = [], projects = [], onStart }: NewChatScreenProps) {
  const [source, setSource] = useState<MobileSessionSource>("cloud");
  const [projectId, setProjectId] = useState<MobileEntityId | undefined>(projects[0]?.id);
  const [modelId, setModelId] = useState<string | undefined>(models[0]?.id);
  const [text, setText] = useState("");
  const model = models.find((item) => item.id === modelId);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>New chat</Text>
      <View style={styles.segment}>
        <Pressable style={source === "cloud" ? styles.segmentActive : styles.segmentButton} onPress={() => setSource("cloud")}>
          <Text style={styles.segmentText}>Cloud</Text>
        </Pressable>
        <Pressable style={source === "desktop-gateway" ? styles.segmentActive : styles.segmentButton} onPress={() => setSource("desktop-gateway")}>
          <Text style={styles.segmentText}>Desktop</Text>
        </Pressable>
      </View>
      <TextInput
        onChangeText={setText}
        placeholder="Ask EchoAI"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={text}
      />
      <View style={styles.picker}>
        <Text style={styles.label}>Project</Text>
        <Text style={styles.value}>{projects.find((project) => project.id === projectId)?.name ?? "None"}</Text>
      </View>
      {projects.map((project) => (
        <Pressable key={project.id} style={project.id === projectId ? styles.optionActive : styles.option} onPress={() => setProjectId(project.id)}>
          <Text style={styles.optionText}>{project.name}</Text>
        </Pressable>
      ))}
      <View style={styles.picker}>
        <Text style={styles.label}>Model</Text>
        <Text style={styles.value}>{model?.displayName ?? "Default"}</Text>
      </View>
      {models.map((item) => (
        <Pressable key={item.id} style={item.id === modelId ? styles.optionActive : styles.option} onPress={() => setModelId(item.id)}>
          <Text style={styles.optionText}>{item.displayName}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.button} onPress={() => onStart?.({ model, projectId, source, text })}>
        <Text style={styles.buttonText}>Start chat</Text>
      </Pressable>
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
  segment: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  segmentActive: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    flex: 1,
    padding: 10,
  },
  segmentText: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "900",
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
  picker: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "800",
  },
  value: {
    color: "#F7FAFC",
    fontSize: 12,
    fontWeight: "800",
  },
  option: {
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  optionActive: {
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  optionText: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    padding: 12,
  },
  buttonText: {
    color: "#101418",
    fontSize: 14,
    fontWeight: "900",
  },
});
