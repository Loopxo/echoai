import type { MobileAttachmentRef } from "../protocol";

export type ShareIntakeKind = "text" | "url" | "file";

export interface ShareIntakePayload {
  kind: ShareIntakeKind;
  mimeType?: string;
  name?: string;
  text?: string;
  uri?: string;
}

export interface ShareIntakeDraft {
  attachments: MobileAttachmentRef[];
  text: string;
}

export function normalizeShareIntake(payload: ShareIntakePayload): ShareIntakeDraft {
  if (payload.kind === "text") {
    return { attachments: [], text: payload.text ?? "" };
  }

  if (payload.kind === "url") {
    return {
      attachments: [{
        id: `share:url:${Date.now()}`,
        kind: "url",
        name: payload.name ?? payload.uri ?? payload.text,
        uri: payload.uri ?? payload.text,
      }],
      text: payload.text ?? "",
    };
  }

  return {
    attachments: [{
      id: `share:file:${Date.now()}`,
      kind: "file",
      mimeType: payload.mimeType,
      name: payload.name,
      uri: payload.uri,
    }],
    text: payload.text ?? "",
  };
}
