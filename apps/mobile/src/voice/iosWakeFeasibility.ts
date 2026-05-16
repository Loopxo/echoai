export interface IosVoiceWakeFeasibility {
  backgroundAlwaysListening: "unsupported";
  foregroundPushToTalk: "supported";
  lockScreenWake: "unsupported";
  notes: string[];
}

export const iosVoiceWakeFeasibility: IosVoiceWakeFeasibility = {
  backgroundAlwaysListening: "unsupported",
  foregroundPushToTalk: "supported",
  lockScreenWake: "unsupported",
  notes: [
    "Use foreground push-to-talk for iOS voice prompts.",
    "Background wake requires platform-approved audio modes and cannot behave like always-on hotword listening.",
    "Lock screen wake should route through notifications or Siri Shortcuts where product-approved.",
  ],
};
