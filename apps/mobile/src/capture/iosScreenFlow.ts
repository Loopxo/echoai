export interface IosScreenFlowCapability {
  fullDeviceBackgroundCapture: "unsupported";
  inAppSnapshot: "supported";
  replayKitBroadcast: "requires-extension";
  notes: string[];
}

export const iosScreenFlowCapability: IosScreenFlowCapability = {
  fullDeviceBackgroundCapture: "unsupported",
  inAppSnapshot: "supported",
  replayKitBroadcast: "requires-extension",
  notes: [
    "Use in-app snapshots for immediate context.",
    "System-wide streaming requires a ReplayKit broadcast extension and explicit user start.",
    "Background screen capture is not available as a general mobile feature.",
  ],
};
