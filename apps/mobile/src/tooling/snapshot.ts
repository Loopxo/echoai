export interface DesktopSnapshotPreview {
  allowed: boolean;
  capturedAt?: string;
  imageUri?: string;
  redacted?: boolean;
  title: string;
}

export function canRenderDesktopSnapshot(snapshot?: DesktopSnapshotPreview): boolean {
  return Boolean(snapshot?.allowed && snapshot.imageUri);
}
