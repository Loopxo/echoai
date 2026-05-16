export type PermissionStatus = "granted" | "denied" | "not-determined" | "restricted";

export interface PermissionDashboardItem {
  key: "camera" | "microphone" | "location" | "notifications" | "local-network" | "photos" | "screen";
  reason: string;
  status: PermissionStatus;
}

export function getDeniedPermissions(items: PermissionDashboardItem[]): PermissionDashboardItem[] {
  return items.filter((item) => item.status === "denied" || item.status === "restricted");
}
