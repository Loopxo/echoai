import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MobileMessagePart, MobileSessionDetail } from "../protocol";

interface ChatDetailScreenProps {
  session?: MobileSessionDetail;
  streamingText?: string;
}

export function ChatDetailScreen({ session, streamingText }: ChatDetailScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{session?.title ?? "Chat detail"}</Text>
      {!session ? <Text style={styles.empty}>Open a chat to view messages</Text> : null}
      {session?.messages.map((message) => (
        <View key={message.id} style={styles.message}>
          <Text style={styles.role}>{message.role}</Text>
          {message.parts.map((part, index) => (
            <Text key={`${message.id}:${index}`} style={part.type === "text" ? styles.textPart : styles.blockPart}>
              {formatMessagePart(part)}
            </Text>
          ))}
        </View>
      ))}
      {streamingText ? (
        <View style={styles.message}>
          <Text style={styles.role}>assistant</Text>
          <Text style={styles.textPart}>{streamingText}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatMessagePart(part: MobileMessagePart): string {
  if (part.type === "text") return part.text ?? "";
  if (part.type === "attachment") return `Attachment: ${part.attachment?.name ?? part.attachment?.kind ?? "file"}`;
  if (part.type === "approval-request") return "Approval requested";
  if (part.type === "tool-call") return `Tool call: ${formatToolName(part.data)}`;
  if (part.type === "tool-result") return `Tool result: ${formatToolName(part.data)}`;
  return part.type;
}

function formatToolName(data?: Record<string, unknown>): string {
  const name = data?.toolName ?? data?.name;
  return typeof name === "string" ? name : "unknown";
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
  message: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  role: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  textPart: {
    color: "#F7FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  blockPart: {
    backgroundColor: "#101418",
    borderRadius: 8,
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "700",
    padding: 8,
  },
});
