import {
  type MobileAuthAuditEvent,
  type MobileAuthCompleteRequest,
  type MobileAuthRefreshRequest,
  type MobileAuthRefreshResponse,
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

  startSignUp(request: MobileAuthStartRequest): Promise<MobileAuthStartResponse> {
    return this.client.request(MobileProtocolMethods.AUTH_SIGN_UP_START, request);
  }

  completeSignUp(request: MobileAuthCompleteRequest): Promise<MobileAuthState> {
    return this.client.request(MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE, request);
  }

  refresh(request: MobileAuthRefreshRequest): Promise<MobileAuthRefreshResponse> {
    return this.client.request(MobileProtocolMethods.AUTH_REFRESH, request);
  }

  getState(): Promise<MobileAuthState> {
    return this.client.request(MobileProtocolMethods.AUTH_STATE_GET, {});
  }

  logout(): Promise<{ signedOut: true }> {
    return this.client.request(MobileProtocolMethods.AUTH_LOGOUT, {});
  }

  listAuditEvents(options: { accountId?: string; workspaceId?: string; limit?: number } = {}): Promise<{ events: MobileAuthAuditEvent[] }> {
    return this.client.request(MobileProtocolMethods.AUTH_AUDIT_LIST, options);
  }
}

export function createEchoAIAuthApi(client: EchoAIMobileClient): EchoAIAuthApi {
  return new EchoAIAuthApi(client);
}
