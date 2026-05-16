import type { EchoAISecureStorageNativeModule, EchoAISecureTokenRecord } from "../native";
import type { EchoAIAuthApi } from "../api";

export type EchoAITokenStoreState = "ready" | "locked" | "unavailable" | "permission-denied" | "corrupted" | "revoked";

export class EchoAITokenStoreError extends Error {
  constructor(
    public readonly state: EchoAITokenStoreState,
    message: string,
  ) {
    super(message);
    this.name = "EchoAITokenStoreError";
  }
}

export class EchoAITokenStore {
  constructor(private readonly secureStorage: EchoAISecureStorageNativeModule) {}

  async status(): Promise<EchoAITokenStoreState> {
    const availability = await this.secureStorage.availability();
    if (availability === "available") return "ready";
    if (availability === "permission-denied") return "permission-denied";
    return "unavailable";
  }

  async requireReady(): Promise<void> {
    const state = await this.status();
    if (state !== "ready") {
      throw new EchoAITokenStoreError(state, `EchoAI secure token storage is ${state}`);
    }
  }

  async save(record: EchoAISecureTokenRecord): Promise<void> {
    await this.requireReady();
    await this.secureStorage.saveToken(record);
  }

  async read(accountId: string, workspaceId: string): Promise<EchoAISecureTokenRecord | null> {
    await this.requireReady();
    const record = await this.secureStorage.readToken(accountId, workspaceId);
    if (!record) return null;

    if (!record.accessToken || !record.expiresAt) {
      throw new EchoAITokenStoreError("corrupted", "EchoAI token record is missing required fields");
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new EchoAITokenStoreError("revoked", "EchoAI token record is expired or revoked");
    }

    return record;
  }

  async clear(accountId: string, workspaceId: string): Promise<void> {
    await this.requireReady();
    return this.secureStorage.clearToken(accountId, workspaceId);
  }

  async clearAll(): Promise<void> {
    await this.requireReady();
    return this.secureStorage.clearAll();
  }

  async refresh(authApi: EchoAIAuthApi, accountId: string, workspaceId: string): Promise<EchoAISecureTokenRecord> {
    const current = await this.read(accountId, workspaceId);
    if (!current?.refreshToken) {
      throw new EchoAITokenStoreError("revoked", "EchoAI refresh token is unavailable");
    }

    const refreshed = await authApi.refresh({
      refreshToken: current.refreshToken,
      workspaceId,
    });

    const next: EchoAISecureTokenRecord = {
      accountId,
      workspaceId: refreshed.authState.activeWorkspaceId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? current.refreshToken,
      expiresAt: refreshed.expiresAt,
    };

    await this.save(next);
    return next;
  }
}

export function createEchoAITokenStore(secureStorage: EchoAISecureStorageNativeModule): EchoAITokenStore {
  return new EchoAITokenStore(secureStorage);
}
