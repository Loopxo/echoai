export interface AndroidVoiceWakeConfig {
  enabled: boolean;
  foregroundService: boolean;
  requiresMicrophonePermission: true;
  wakePhrase?: string;
}

export function createAndroidVoiceWakeConfig(wakePhrase?: string): AndroidVoiceWakeConfig {
  return {
    enabled: Boolean(wakePhrase?.trim()),
    foregroundService: true,
    requiresMicrophonePermission: true,
    wakePhrase,
  };
}
