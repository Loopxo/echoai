import type { EchoAICaptureNativeModule, EchoAICapturedAsset } from "../native";

export type CameraCaptureMode = "image" | "video";

export class CameraCaptureService {
  constructor(private readonly capture: EchoAICaptureNativeModule) {}

  async captureCamera(mode: CameraCaptureMode): Promise<EchoAICapturedAsset> {
    const availability = await this.capture.cameraAvailability();
    if (availability !== "available") {
      throw new Error(`Camera unavailable: ${availability}`);
    }
    return mode === "image" ? this.capture.captureImage() : this.capture.captureVideo();
  }
}

export function createCameraCaptureService(capture: EchoAICaptureNativeModule): CameraCaptureService {
  return new CameraCaptureService(capture);
}
