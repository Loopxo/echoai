import type { MobileEntityId } from "../protocol";

export interface RemoteLogLine {
  id: MobileEntityId;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

export function tailRemoteLogs(lines: RemoteLogLine[], limit = 100): RemoteLogLine[] {
  return lines.slice(Math.max(lines.length - limit, 0));
}
