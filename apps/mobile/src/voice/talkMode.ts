export interface TalkModeSettings {
  enabled: boolean;
  rate: number;
  voiceId?: string;
}

export interface TalkModeUtterance {
  id: string;
  text: string;
}

export function createTalkModeUtterance(text: string): TalkModeUtterance {
  return {
    id: `utterance:${Date.now()}`,
    text,
  };
}
