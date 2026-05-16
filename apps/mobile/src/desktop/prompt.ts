import type { MobileEntityId } from "../protocol";

export interface DesktopPromptRequest {
  desktopDeviceId: MobileEntityId;
  localWorkspacePath?: string;
  prompt: string;
}

export function buildDesktopPromptRequest(input: DesktopPromptRequest): DesktopPromptRequest {
  return {
    ...input,
    prompt: input.prompt.trim(),
  };
}
