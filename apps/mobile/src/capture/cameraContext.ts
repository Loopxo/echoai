export interface CameraContextCommand {
  id: string;
  prompt: string;
  requestedAt: string;
  status: "pending-permission" | "approved" | "denied" | "captured";
}

export function approveCameraContextCommand(command: CameraContextCommand): CameraContextCommand {
  return { ...command, status: "approved" };
}

export function denyCameraContextCommand(command: CameraContextCommand): CameraContextCommand {
  return { ...command, status: "denied" };
}
