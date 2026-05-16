export interface DebugLogLine {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

export function redactDebugLog(line: DebugLogLine): DebugLogLine {
  return {
    ...line,
    message: line.message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]"),
  };
}

export function exportDebugLogs(lines: DebugLogLine[]): string {
  return lines.map(redactDebugLog).map((line) => `${line.timestamp} [${line.level}] ${line.message}`).join("\n");
}
