import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { EchoAIProviderKeyRecord, EchoAIWorkspaceState } from "@echoai/contracts";
import { createAuditEvent, makeId } from "./store";

function now() {
  return new Date().toISOString();
}

function keyMaterial() {
  const raw = process.env.ECHOAI_WEB_ENCRYPTION_KEY || "mock-encryption-key-for-local";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [iv, tag, encrypted] = payload.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted secret payload");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function upsertProviderKey(
  state: EchoAIWorkspaceState,
  input: { provider: string; label: string; secret: string },
): EchoAIProviderKeyRecord {
  const existing = state.providerKeys.find((key) => key.provider === input.provider && key.workspaceId === state.session.workspaceId);
  const encryptedRef = `vault://local/${encryptSecret(input.secret)}`;
  const record: EchoAIProviderKeyRecord = {
    id: existing?.id ?? makeId("provider_key"),
    workspaceId: state.session.workspaceId,
    provider: input.provider,
    label: input.label,
    status: "active",
    encryptedRef,
    createdAt: existing?.createdAt ?? now(),
    rotatedAt: existing ? now() : undefined,
  };

  if (existing) {
    Object.assign(existing, record);
  } else {
    state.providerKeys.push(record);
  }
  state.auditEvents.push(createAuditEvent("provider_key.changed", `Stored provider key reference for ${record.provider}`, state));
  return { ...record, encryptedRef: "redacted" };
}
