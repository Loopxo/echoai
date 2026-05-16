import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GatewayDiscoveryEndpoint } from "../gateway";
import type { EchoAINativeAvailability } from "../native";

interface GatewayDiscoveryScreenProps {
  availability?: EchoAINativeAvailability;
  discoveredEndpoints?: GatewayDiscoveryEndpoint[];
  manualEndpoints?: GatewayDiscoveryEndpoint[];
  onSelectEndpoint?: (endpoint: GatewayDiscoveryEndpoint) => void;
}

export function GatewayDiscoveryScreen({
  availability = "unavailable",
  discoveredEndpoints = [],
  manualEndpoints = [],
  onSelectEndpoint,
}: GatewayDiscoveryScreenProps) {
  const endpoints = [...discoveredEndpoints, ...manualEndpoints];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Pair desktop</Text>
        <Text style={styles.availability}>{availability}</Text>
      </View>
      {endpoints.length === 0 ? <Text style={styles.empty}>No desktop gateways found</Text> : null}
      {endpoints.map((endpoint) => (
        <Pressable key={endpoint.id} style={styles.endpoint} onPress={() => onSelectEndpoint?.(endpoint)}>
          <View style={styles.endpointCopy}>
            <Text style={styles.name}>{endpoint.displayName}</Text>
            <Text style={styles.meta}>{formatEndpoint(endpoint)}</Text>
          </View>
          <Text style={styles.action}>Connect</Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatEndpoint(endpoint: GatewayDiscoveryEndpoint): string {
  const transport = endpoint.tls ? "TLS" : "Local";
  return `${endpoint.source} - ${transport} - ${endpoint.host}:${endpoint.port}`;
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
  availability: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  empty: {
    color: "#7F8C96",
    fontSize: 13,
    fontWeight: "600",
  },
  endpoint: {
    alignItems: "center",
    borderColor: "#26313A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  endpointCopy: {
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
  action: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
  },
});
