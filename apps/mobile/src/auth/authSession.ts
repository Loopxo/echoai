import type { EchoAIAuthApi } from "../api";

import type { EchoAITokenStore } from "./tokenStore";

export interface EchoAIAuthSessionOptions {
  authApi: EchoAIAuthApi;
  tokenStore: EchoAITokenStore;
}

export class EchoAIAuthSession {
  constructor(private readonly options: EchoAIAuthSessionOptions) {}

  async logout(): Promise<void> {
    await this.options.authApi.logout();
    await this.options.tokenStore.clearAll();
  }
}

export function createEchoAIAuthSession(options: EchoAIAuthSessionOptions): EchoAIAuthSession {
  return new EchoAIAuthSession(options);
}
