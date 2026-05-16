import type { MobileAttachmentRef, MobileChatSendRequest, MobileEntityId, MobileModelRef, MobileSessionSource } from "../protocol";

export interface BuildChatSendRequestInput {
  attachments?: MobileAttachmentRef[];
  desktopDeviceId?: MobileEntityId;
  model?: MobileModelRef;
  projectId?: MobileEntityId;
  sessionId?: MobileEntityId;
  source: MobileSessionSource;
  text: string;
}

export function buildChatSendRequest(input: BuildChatSendRequestInput): MobileChatSendRequest {
  return {
    attachments: input.attachments,
    desktopDeviceId: input.desktopDeviceId,
    model: input.model,
    projectId: input.projectId,
    sessionId: input.sessionId,
    source: input.source,
    text: input.text.trim(),
  };
}
