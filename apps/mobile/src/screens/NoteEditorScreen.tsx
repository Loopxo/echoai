import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { MobileNoteDraft } from "../notes";

interface NoteEditorScreenProps {
  draft?: MobileNoteDraft;
  onSave?: (draft: MobileNoteDraft) => void;
}

export function NoteEditorScreen({ draft, onSave }: NoteEditorScreenProps) {
  const [title, setTitle] = useState(draft?.title ?? "");
  const [body, setBody] = useState(draft?.body ?? "");

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Edit note</Text>
      <TextInput
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={title}
      />
      <TextInput
        multiline
        onChangeText={setBody}
        placeholder="Markdown note"
        placeholderTextColor="#7F8C96"
        style={styles.bodyInput}
        value={body}
      />
      <Pressable style={styles.button} onPress={() => onSave?.({ ...draft, body, title, updatedAt: new Date().toISOString() })}>
        <Text style={styles.buttonText}>Save note</Text>
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
  bodyInput: {
    backgroundColor: "#101418",
    borderColor: "#26313A",
    borderRadius: 10,
    borderWidth: 1,
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "700",
    minHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
