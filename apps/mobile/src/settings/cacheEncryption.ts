export interface LocalCacheEncryptionState {
  algorithm: "platform-keystore";
  encryptedCollections: Array<"tokens" | "sessions" | "files" | "settings">;
  enabled: boolean;
  lastRotatedAt?: string;
}

export const defaultLocalCacheEncryptionState: LocalCacheEncryptionState = {
  algorithm: "platform-keystore",
  encryptedCollections: ["tokens", "sessions", "files"],
  enabled: true,
};
