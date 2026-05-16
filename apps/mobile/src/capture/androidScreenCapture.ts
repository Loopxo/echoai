export interface AndroidScreenCaptureSession {
  id: string;
  mode: "snapshot" | "stream";
  startedAt: string;
  status: "idle" | "requesting-permission" | "capturing" | "stopped";
}

export function startAndroidScreenCapture(mode: AndroidScreenCaptureSession["mode"]): AndroidScreenCaptureSession {
  return {
    id: `screen:${Date.now()}`,
    mode,
    startedAt: new Date().toISOString(),
    status: "requesting-permission",
  };
}
