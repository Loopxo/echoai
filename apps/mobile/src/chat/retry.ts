import type { MobileEntityId } from "../protocol";

export interface RetryTurnDraft {
  messageId: MobileEntityId;
  originalText: string;
  retryText: string;
}

export function createRetryTurnDraft(messageId: MobileEntityId, originalText: string): RetryTurnDraft {
  return {
    messageId,
    originalText,
    retryText: originalText,
  };
}

export function updateRetryTurnDraft(draft: RetryTurnDraft, retryText: string): RetryTurnDraft {
  return {
    ...draft,
    retryText,
  };
}
