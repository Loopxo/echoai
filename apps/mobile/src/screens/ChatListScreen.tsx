import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileSessionSummary } from "../protocol";

interface ChatListScreenProps {
  sessions?: MobileSessionSummary[];
  onOpenSession?: (session: MobileSessionSummary) => void;
}

export function ChatListScreen({ sessions = [], onOpenSession }: ChatListScreenProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Chats</Text>
        <Text style={styles.count}>{sessions.length}</Text>
      </View>
      {sessions.length === 0 ? <Text style={styles.empty}>No synced chats yet</Text> : null}
      {sessions.map((session) => (
        <Pressable key={session.id} style={styles.session} onPress={() => onOpenSession?.(session)}>
          <View style={styles.copy}>
            <Text style={styles.title}>{session.title}</Text>
            <Text style={styles.meta}>{formatSessionMeta(session)}</Text>
          </View>
          <Text style={styles.source}>{session.source}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatSessionMeta(session: MobileSessionSummary): string {
  return `${session.status} - ${session.messageCount} messages - ${session.updatedAt}`;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    color: "#F7FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  count: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "800",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  session: {
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
  title: {
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
