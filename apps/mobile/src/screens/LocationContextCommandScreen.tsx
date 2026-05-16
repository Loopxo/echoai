import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LocationContextCommand, LocationPrecision } from "../capture";

interface LocationContextCommandScreenProps {
  command?: LocationContextCommand;
  onShare?: (precision: LocationPrecision) => void;
}

export function LocationContextCommandScreen({ command, onShare }: LocationContextCommandScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Location request</Text>
      {command ? (
        <View style={styles.card}>
          <Text style={styles.prompt}>{command.prompt}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={() => onShare?.("approximate")}>
              <Text style={styles.buttonText}>Approximate</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => onShare?.("precise")}>
              <Text style={styles.buttonText}>Precise</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>No location context request</Text>
      )}
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
  card: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  prompt: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    alignItems: "center",
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
});
