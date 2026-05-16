import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MobileAuthAuditEvent } from "../protocol";

interface AuthAuditScreenProps {
  events?: MobileAuthAuditEvent[];
}

const statusColors: Record<MobileAuthAuditEvent["status"], string> = {
  blocked: "#F59E0B",
  failed: "#F87171",
  success: "#34D399",
};

export function AuthAuditScreen({ events = [] }: AuthAuditScreenProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Security activity</Text>
        <Text style={styles.count}>{events.length}</Text>
      </View>
      {events.length === 0 ? <Text style={styles.empty}>No recent login or device events</Text> : null}
      {events.map((event) => {
        const badgeStyle = { ...styles.badge, color: statusColors[event.status] };
        return (
          <View key={event.id} style={styles.event}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{formatEventTitle(event)}</Text>
              <Text style={badgeStyle}>{event.status}</Text>
            </View>
            <Text style={styles.meta}>{formatEventMeta(event)}</Text>
            {event.summary ? <Text style={styles.summary}>{event.summary}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function formatEventTitle(event: MobileAuthAuditEvent): string {
  return event.eventType.replace(/-/g, " ");
}

function formatEventMeta(event: MobileAuthAuditEvent): string {
  const location = event.ipCountry ? ` from ${event.ipCountry}` : "";
  const device = event.deviceId ? ` on ${event.deviceId}` : "";
  return `${formatTimestamp(event.createdAt)}${location}${device}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#151C22",
    borderRadius: 14,
    gap: 12,
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
  event: {
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  eventHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  eventTitle: {
    color: "#F7FAFC",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  badge: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  meta: {
    color: "#7F8C96",
    fontSize: 12,
    fontWeight: "600",
  },
  summary: {
    color: "#CAD2D9",
    fontSize: 12,
    fontWeight: "600",
  },
});
