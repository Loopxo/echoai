import type { MobileEntityId, MobileRunStatus } from "../protocol";

export type ToolCallKind = "file" | "shell" | "browser" | "mcp" | "desktop";

export interface ToolCallTrace {
  id: MobileEntityId;
  inputPreview?: string;
  kind: ToolCallKind;
  outputPreview?: string;
  risk?: "low" | "medium" | "high";
  status: MobileRunStatus;
  title: string;
}

export function formatToolCallKind(kind: ToolCallKind): string {
  if (kind === "mcp") return "MCP";
  return kind;
}
