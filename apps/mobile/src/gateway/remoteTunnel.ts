import type { GatewayDiscoveryEndpoint } from "./discovery";

export type RemoteTunnelState = "disabled" | "available" | "connecting" | "connected" | "blocked";

export interface RemoteTunnelDescriptor {
  desktopDeviceId: string;
  endpoint: GatewayDiscoveryEndpoint;
  relayRegion?: string;
  state: RemoteTunnelState;
  workspaceId: string;
}

export function createRemoteTunnelEndpoint(input: {
  desktopDeviceId: string;
  host: string;
  port: number;
  relayRegion?: string;
  workspaceId: string;
}): RemoteTunnelDescriptor {
  return {
    desktopDeviceId: input.desktopDeviceId,
    endpoint: {
      displayName: `Remote desktop ${input.desktopDeviceId}`,
      host: input.host,
      id: `remote-tunnel:${input.desktopDeviceId}`,
      port: input.port,
      source: "remote-tunnel",
      tls: true,
      workspaceId: input.workspaceId,
    },
    relayRegion: input.relayRegion,
    state: "available",
    workspaceId: input.workspaceId,
  };
}
