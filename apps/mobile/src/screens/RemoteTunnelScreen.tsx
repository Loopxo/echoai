import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { RemoteTunnelDescriptor } from "../gateway";

interface RemoteTunnelScreenProps {
  tunnels?: RemoteTunnelDescriptor[];
  onConnect?: (tunnel: RemoteTunnelDescriptor) => void;
}

export function RemoteTunnelScreen({ tunnels = [], onConnect }: RemoteTunnelScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Remote tunnel</Text>
      {tunnels.length === 0 ? <Text style={styles.empty}>No remote desktop tunnels enabled</Text> : null}
      {tunnels.map((tunnel) => (
        <View key={tunnel.desktopDeviceId} style={styles.tunnel}>
          <View style={styles.copy}>
            <Text style={styles.name}>{tunnel.endpoint.displayName}</Text>
            <Text style={styles.meta}>{formatTunnel(tunnel)}</Text>
          </View>
          <Pressable style={styles.button} onPress={() => onConnect?.(tunnel)}>
            <Text style={styles.buttonText}>Open</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function formatTunnel(tunnel: RemoteTunnelDescriptor): string {
  const region = tunnel.relayRegion ? ` - ${tunnel.relayRegion}` : "";
  return `${tunnel.state}${region} - ${tunnel.endpoint.host}:${tunnel.endpoint.port}`;
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
  tunnel: {
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
  button: {
    borderColor: "#7DD3FC",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "900",
  },
});
