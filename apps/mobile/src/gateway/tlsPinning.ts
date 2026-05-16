import type { EchoAIGatewayNativeModule } from "../native";

import type { GatewayDiscoveryEndpoint } from "./discovery";

export type GatewayTlsPinStatus = "unverified" | "trusted" | "mismatch";

export interface GatewayTlsPinState {
  endpointId: string;
  expectedFingerprintSha256?: string;
  presentedFingerprintSha256?: string;
  status: GatewayTlsPinStatus;
}

export class EchoAIGatewayTlsPinning {
  constructor(private readonly gateway: EchoAIGatewayNativeModule) {}

  evaluate(endpoint: GatewayDiscoveryEndpoint, rememberedFingerprintSha256?: string): GatewayTlsPinState {
    const presentedFingerprintSha256 = endpoint.fingerprintSha256;
    if (!presentedFingerprintSha256 || !rememberedFingerprintSha256) {
      return {
        endpointId: endpoint.id,
        expectedFingerprintSha256: rememberedFingerprintSha256,
        presentedFingerprintSha256,
        status: "unverified",
      };
    }

    return {
      endpointId: endpoint.id,
      expectedFingerprintSha256: rememberedFingerprintSha256,
      presentedFingerprintSha256,
      status: rememberedFingerprintSha256 === presentedFingerprintSha256 ? "trusted" : "mismatch",
    };
  }

  async remember(endpoint: GatewayDiscoveryEndpoint, fingerprintSha256: string): Promise<GatewayTlsPinState> {
    await this.gateway.rememberTlsIdentity(endpoint.id, fingerprintSha256);
    return {
      endpointId: endpoint.id,
      expectedFingerprintSha256: fingerprintSha256,
      presentedFingerprintSha256: fingerprintSha256,
      status: "trusted",
    };
  }
}

export function createEchoAIGatewayTlsPinning(gateway: EchoAIGatewayNativeModule): EchoAIGatewayTlsPinning {
  return new EchoAIGatewayTlsPinning(gateway);
}
