export interface PushToTalkState {
  isRecording: boolean;
  startedAt?: string;
  transcriptDraft?: string;
}

export function startPushToTalk(now: Date = new Date()): PushToTalkState {
  return { isRecording: true, startedAt: now.toISOString() };
}

export function stopPushToTalk(state: PushToTalkState, transcriptDraft?: string): PushToTalkState {
  return { ...state, isRecording: false, transcriptDraft };
}
