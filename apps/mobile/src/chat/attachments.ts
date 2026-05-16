import type { MobileAttachmentRef } from "../protocol";

export type AttachmentPickKind = "image" | "document" | "audio" | "file";

export function createPendingAttachment(kind: AttachmentPickKind, name: string, uri: string): MobileAttachmentRef {
  return {
    id: `local:${kind}:${Date.now()}`,
    kind,
    name,
    uri,
  };
}
