import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileModelRef } from "../protocol";

type ModelCapability = MobileModelRef["capabilities"][number];

interface ModelPickerScreenProps {
  models?: MobileModelRef[];
  onSelectModel?: (model: MobileModelRef) => void;
}

const capabilityFilters: Array<ModelCapability | "all"> = ["all", "text", "vision", "tools", "audio", "reasoning"];

export function ModelPickerScreen({ models = [], onSelectModel }: ModelPickerScreenProps) {
  const [capability, setCapability] = useState<ModelCapability | "all">("all");
  const filteredModels = capability === "all" ? models : models.filter((model) => model.capabilities.includes(capability));

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Models</Text>
      <View style={styles.filters}>
        {capabilityFilters.map((filter) => (
          <Pressable key={filter} style={filter === capability ? styles.filterActive : styles.filter} onPress={() => setCapability(filter)}>
            <Text style={styles.filterText}>{filter}</Text>
          </Pressable>
        ))}
      </View>
      {filteredModels.length === 0 ? <Text style={styles.empty}>No models match this capability</Text> : null}
      {filteredModels.map((model) => (
        <Pressable key={model.id} style={styles.model} onPress={() => onSelectModel?.(model)}>
          <View style={styles.copy}>
            <Text style={styles.name}>{model.displayName}</Text>
            <Text style={styles.meta}>{model.capabilities.join(", ")}</Text>
          </View>
          <Text style={styles.source}>{model.source}</Text>
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
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filter: {
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterActive: {
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterText: {
    color: "#F7FAFC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  model: {
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
  source: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
