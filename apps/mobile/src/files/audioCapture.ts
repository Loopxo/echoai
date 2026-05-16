import type { EchoAICaptureNativeModule, EchoAICapturedAsset } from "../native";

export class AudioCaptureService {
  constructor(private readonly capture: EchoAICaptureNativeModule) {}

  async recordAudio(maxDurationSeconds = 120): Promise<EchoAICapturedAsset> {
    const availability = await this.capture.microphoneAvailability();
    if (availability !== "available") {
      throw new Error(`Microphone unavailable: ${availability}`);
    }
    return this.capture.recordAudio(maxDurationSeconds);
  }
}

export function createAudioCaptureService(capture: EchoAICaptureNativeModule): AudioCaptureService {
  return new AudioCaptureService(capture);
}
