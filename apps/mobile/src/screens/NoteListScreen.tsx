import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { searchNotes, type MobileNoteSummary } from "../notes";

interface NoteListScreenProps {
  notes?: MobileNoteSummary[];
  onOpenNote?: (note: MobileNoteSummary) => void;
}

export function NoteListScreen({ notes = [], onOpenNote }: NoteListScreenProps) {
  const [query, setQuery] = useState("");
  const visibleNotes = searchNotes(notes, query);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Notes</Text>
      <TextInput
        onChangeText={setQuery}
        placeholder="Search notes"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={query}
      />
      {visibleNotes.length === 0 ? <Text style={styles.empty}>No notes found</Text> : null}
      {visibleNotes.map((note) => (
        <Pressable key={note.id} style={styles.note} onPress={() => onOpenNote?.(note)}>
          <Text style={styles.title}>{note.title}</Text>
          <Text style={styles.meta}>{note.updatedAt}</Text>
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
  note: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  title: {
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
