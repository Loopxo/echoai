export type ModelPreference = "free" | "premium" | "byok" | "desktop-local";

export interface ModelSettings {
  defaultModelId?: string;
  preference: ModelPreference;
}

export function updateModelSettings(settings: ModelSettings, patch: Partial<ModelSettings>): ModelSettings {
  return { ...settings, ...patch };
}
