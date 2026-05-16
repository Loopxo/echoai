import type { EchoAIGatewayEndpoint, EchoAIGatewayNativeModule, EchoAINativeAvailability } from "../native";

export type GatewayDiscoverySource = "bonjour" | "mdns" | "manual" | "remote-tunnel";

export interface GatewayDiscoveryEndpoint extends EchoAIGatewayEndpoint {
  source: GatewayDiscoverySource;
  fingerprintSha256?: string;
  workspaceId?: string;
}

export interface ManualGatewayEndpointInput {
  displayName?: string;
  host: string;
  port: number;
  tls?: boolean;
  token?: string;
}

export interface GatewayDiscoveryResult {
  availability: EchoAINativeAvailability;
  endpoints: GatewayDiscoveryEndpoint[];
  discoveredAt: string;
}

export class EchoAIGatewayDiscovery {
  constructor(private readonly gateway: EchoAIGatewayNativeModule) {}

  async discover(): Promise<GatewayDiscoveryResult> {
    const availability = await this.gateway.availability();
    if (availability !== "available") {
      return { availability, discoveredAt: new Date().toISOString(), endpoints: [] };
    }

    const endpoints = await this.gateway.discover();
    return {
      availability,
      discoveredAt: new Date().toISOString(),
      endpoints: endpoints.map((endpoint) => ({
        ...endpoint,
        source: endpoint.tls ? "bonjour" : "mdns",
      })),
    };
  }

  createManualEndpoint(input: ManualGatewayEndpointInput): GatewayDiscoveryEndpoint {
    const host = input.host.trim();
    const tls = input.tls ?? true;
    return {
      displayName: input.displayName?.trim() || host,
      host,
      id: `manual:${tls ? "tls" : "plain"}:${host}:${input.port}`,
      lastSeenAt: new Date().toISOString(),
      port: input.port,
      source: "manual",
      tls,
    };
  }
}

export function createEchoAIGatewayDiscovery(gateway: EchoAIGatewayNativeModule): EchoAIGatewayDiscovery {
  return new EchoAIGatewayDiscovery(gateway);
}
