import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { buildChatSendRequest } from "../chat";
import type { MobileAttachmentRef, MobileChatSendRequest, MobileEntityId, MobileModelRef, MobileSessionSource } from "../protocol";

interface ChatComposerScreenProps {
  attachments?: MobileAttachmentRef[];
  desktopDeviceId?: MobileEntityId;
  model?: MobileModelRef;
  projectId?: MobileEntityId;
  sessionId?: MobileEntityId;
  source?: MobileSessionSource;
  onSend?: (request: MobileChatSendRequest) => void;
}

export function ChatComposerScreen({
  attachments = [],
  desktopDeviceId,
  model,
  projectId,
  sessionId,
  source = "cloud",
  onSend,
}: ChatComposerScreenProps) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Send prompt</Text>
      <TextInput
        onChangeText={setText}
        placeholder="Message EchoAI"
        placeholderTextColor="#7F8C96"
        style={styles.input}
        value={text}
      />
      <Text style={styles.meta}>{source} - {attachments.length} attachments</Text>
      <Pressable
        style={canSend ? styles.button : styles.buttonDisabled}
        onPress={() => {
          if (canSend) {
            onSend?.(buildChatSendRequest({ attachments, desktopDeviceId, model, projectId, sessionId, source, text }));
            setText("");
          }
        }}
      >
        <Text style={styles.buttonText}>Send</Text>
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
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#7DD3FC",
    borderRadius: 10,
    padding: 12,
  },
  buttonDisabled: {
    alignItems: "center",
    backgroundColor: "#26313A",
    borderRadius: 10,
    padding: 12,
  },
  buttonText: {
    color: "#101418",
    fontSize: 14,
    fontWeight: "900",
  },
});
