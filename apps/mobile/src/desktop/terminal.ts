export interface DesktopTerminalLine {
  id: string;
  stream: "stdout" | "stderr";
  text: string;
  timestamp: string;
}

export interface DesktopTerminalRun {
  command: string;
  exitCode?: number;
  lines: DesktopTerminalLine[];
  status: "running" | "completed" | "failed";
}

export function tailTerminalRun(run: DesktopTerminalRun, limit = 100): DesktopTerminalLine[] {
  return run.lines.slice(Math.max(0, run.lines.length - limit));
}
