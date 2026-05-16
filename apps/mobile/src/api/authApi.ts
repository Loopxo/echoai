import {
  type MobileAuthCompleteRequest,
  type MobileAuthStartRequest,
  type MobileAuthStartResponse,
  type MobileAuthState,
  MobileProtocolMethods,
} from "../protocol";

import type { EchoAIMobileClient } from "./mobileClient";

export class EchoAIAuthApi {
  constructor(private readonly client: EchoAIMobileClient) {}

  startSignIn(request: MobileAuthStartRequest): Promise<MobileAuthStartResponse> {
    return this.client.request(MobileProtocolMethods.AUTH_SIGN_IN_START, request);
  }

  completeSignIn(request: MobileAuthCompleteRequest): Promise<MobileAuthState> {
    return this.client.request(MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE, request);
  }

  getState(): Promise<MobileAuthState> {
    return this.client.request(MobileProtocolMethods.AUTH_STATE_GET, {});
  }

  logout(): Promise<{ signedOut: true }> {
    return this.client.request(MobileProtocolMethods.AUTH_LOGOUT, {});
  }
}

export function createEchoAIAuthApi(client: EchoAIMobileClient): EchoAIAuthApi {
  return new EchoAIAuthApi(client);
}
