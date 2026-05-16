export interface WakeDesktopRequest {
  desktopDeviceId: string;
  reason?: string;
  requestedAt: string;
}

export function createWakeDesktopRequest(desktopDeviceId: string, reason?: string): WakeDesktopRequest {
  return {
    desktopDeviceId,
    reason,
    requestedAt: new Date().toISOString(),
  };
}
