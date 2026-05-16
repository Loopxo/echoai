export type OfflineCaptureKind = "note" | "photo" | "audio";

export interface OfflineCaptureItem {
  id: string;
  capturedAt: string;
  kind: OfflineCaptureKind;
  status: "queued" | "syncing" | "synced" | "failed";
  uri?: string;
  value?: string;
}

export function enqueueOfflineCapture(kind: OfflineCaptureKind, value?: string, uri?: string): OfflineCaptureItem {
  return {
    capturedAt: new Date().toISOString(),
    id: `offline:${kind}:${Date.now()}`,
    kind,
    status: "queued",
    uri,
    value,
  };
}

export function getQueuedOfflineCaptures(items: OfflineCaptureItem[]): OfflineCaptureItem[] {
  return items.filter((item) => item.status === "queued" || item.status === "failed");
}
