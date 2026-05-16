import type { EchoAISecureStorageNativeModule, EchoAISecureTokenRecord } from "../native";

export class EchoAITokenStore {
  constructor(private readonly secureStorage: EchoAISecureStorageNativeModule) {}

  async save(record: EchoAISecureTokenRecord): Promise<void> {
    await this.secureStorage.saveToken(record);
  }

  read(accountId: string, workspaceId: string): Promise<EchoAISecureTokenRecord | null> {
    return this.secureStorage.readToken(accountId, workspaceId);
  }

  clear(accountId: string, workspaceId: string): Promise<void> {
    return this.secureStorage.clearToken(accountId, workspaceId);
  }

  clearAll(): Promise<void> {
    return this.secureStorage.clearAll();
  }
}

export function createEchoAITokenStore(secureStorage: EchoAISecureStorageNativeModule): EchoAITokenStore {
  return new EchoAITokenStore(secureStorage);
}
