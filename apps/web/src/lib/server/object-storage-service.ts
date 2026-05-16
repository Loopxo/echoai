import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EchoAIStoredObject, EchoAIWorkspaceState } from "@echoai/contracts";
import { createAuditEvent, getWorkspaceDataDir, makeId } from "./store";

function now() {
  return new Date().toISOString();
}

function objectRoot() {
  return join(getWorkspaceDataDir(), "objects");
}

function objectPath(storageKey: string) {
  return join(objectRoot(), storageKey);
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "object";
}

export async function putLocalObject(
  state: EchoAIWorkspaceState,
  input: {
    name: string;
    content: string;
    contentType?: string;
    kind?: EchoAIStoredObject["kind"];
  },
): Promise<EchoAIStoredObject> {
  const id = makeId("object");
  const storageKey = `${state.session.workspaceId}/${id}-${safeName(input.name)}`;
  const bytes = Buffer.from(input.content, "utf8");
  await mkdir(join(objectRoot(), state.session.workspaceId), { recursive: true });
  await writeFile(objectPath(storageKey), bytes);
  const object: EchoAIStoredObject = {
    id,
    workspaceId: state.session.workspaceId,
    ownerId: state.session.userId,
    kind: input.kind ?? "upload",
    name: input.name,
    contentType: input.contentType ?? "text/plain",
    sizeBytes: bytes.byteLength,
    storageKey,
    createdAt: now(),
  };
  state.storedObjects.unshift(object);
  state.auditEvents.push(createAuditEvent("storage.object_created", `Stored object ${object.name}`, state));
  return object;
}

export async function readLocalObject(storageKey: string) {
  return readFile(objectPath(storageKey), "utf8");
}

export async function localObjectMetadata(storageKey: string) {
  const metadata = await stat(objectPath(storageKey));
  return {
    storageKey,
    sizeBytes: metadata.size,
    modifiedAt: metadata.mtime.toISOString(),
  };
}
