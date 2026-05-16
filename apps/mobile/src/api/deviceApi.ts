import {
  type MobileDevice,
  type MobileEntityId,
  type MobilePairingChallenge,
  MobileProtocolMethods,
} from "../protocol";

import type { EchoAIMobileClient } from "./mobileClient";

export class EchoAIDeviceApi {
  constructor(private readonly client: EchoAIMobileClient) {}

  list(workspaceId: MobileEntityId): Promise<{ devices: MobileDevice[] }> {
    return this.client.request(MobileProtocolMethods.DEVICE_LIST, { workspaceId });
  }

  register(device: MobileDevice): Promise<{ device: MobileDevice }> {
    return this.client.request(MobileProtocolMethods.DEVICE_REGISTER, { device });
  }

  startPairing(deviceId: MobileEntityId, desktopDeviceId?: MobileEntityId): Promise<MobilePairingChallenge> {
    return this.client.request(MobileProtocolMethods.DEVICE_PAIRING_START, { deviceId, desktopDeviceId });
  }

  revoke(deviceId: MobileEntityId): Promise<{ deviceId: MobileEntityId; trustState: "revoked" }> {
    return this.client.request(MobileProtocolMethods.DEVICE_REVOKE, { deviceId });
  }
}

export function createEchoAIDeviceApi(client: EchoAIMobileClient): EchoAIDeviceApi {
  return new EchoAIDeviceApi(client);
}
