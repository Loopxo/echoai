import type { EchoAIFeatureFlags, EchoAIOrgMember } from "@echoai/contracts";

export const defaultFeatureFlags: EchoAIFeatureFlags = {
  freeModels: true,
  hostedPremiumModels: true,
  byokVault: true,
  mediaGeneration: true,
  integrations: true,
  automations: true,
  desktopHandoff: true,
  mobileHandoff: true,
};

export function resolveFeatureFlags(member: EchoAIOrgMember): EchoAIFeatureFlags {
  if (member.role === "viewer") {
    return {
      ...defaultFeatureFlags,
      byokVault: false,
      automations: false,
    };
  }

  return defaultFeatureFlags;
}
