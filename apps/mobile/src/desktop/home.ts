import type { MobileDevice, MobileRunStatus } from "../protocol";

export interface DesktopHomeState {
  activeRunStatus?: MobileRunStatus;
  device?: MobileDevice;
  quickActions: Array<"send-prompt" | "view-terminal" | "view-diff" | "wake-desktop">;
  workspaceName?: string;
}

export function getDesktopHomeStatus(state: DesktopHomeState): string {
  if (!state.device) return "No desktop paired";
  return `${state.device.displayName} - ${state.device.trustState}`;
}
