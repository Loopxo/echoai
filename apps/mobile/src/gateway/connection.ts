import type { MobileDevice } from "../protocol";
import type { EchoAIGatewayNativeModule } from "../native";

import { EchoAIGatewayDiscovery, type ManualGatewayEndpointInput } from "./discovery";

export interface ManualGatewayConnectRequest extends ManualGatewayEndpointInput {
  token: string;
}

export class EchoAIGatewayConnection {
  private readonly discovery: EchoAIGatewayDiscovery;

  constructor(private readonly gateway: EchoAIGatewayNativeModule) {
    this.discovery = new EchoAIGatewayDiscovery(gateway);
  }

  async connectManual(request: ManualGatewayConnectRequest): Promise<MobileDevice> {
    const endpoint = this.discovery.createManualEndpoint(request);
    return this.gateway.connect(endpoint, request.token);
  }
}

export function createEchoAIGatewayConnection(gateway: EchoAIGatewayNativeModule): EchoAIGatewayConnection {
  return new EchoAIGatewayConnection(gateway);
}
