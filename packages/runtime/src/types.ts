import type { ToolDefinition } from "@echoai/core";

export type KernelSessionMode = "default" | "plan";
export type KernelTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PermissionDecision = "allow" | "ask" | "deny";

export interface KernelAttachment {
  id: string;
  kind: "file" | "image" | "audio" | "artifact";
  name: string;
  path?: string;
  mediaType?: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface KernelToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface KernelMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: number;
  name?: string;
  toolCallId?: string;
  toolCalls?: KernelToolCall[];
  attachments?: KernelAttachment[];
  metadata?: Record<string, unknown>;
}

export interface KernelApprovalRecord {
  id: string;
  toolName: string;
  decision: "approved" | "denied";
  reason?: string;
  createdAt: number;
  input?: Record<string, unknown>;
}

export interface KernelTaskRecord {
  id: string;
  kind: "shell" | "agent" | "review" | "workflow" | "other";
  title: string;
  status: KernelTaskStatus;
  createdAt: number;
  updatedAt: number;
  detail?: string;
  outputPath?: string;
  metadata?: Record<string, unknown>;
}

export interface KernelArtifact {
  id: string;
  label: string;
  type: "diff" | "file" | "report" | "log" | "other";
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface KernelBackgroundState {
  status: "idle" | "running" | "stopped" | "failed";
  processId?: number;
  logPath?: string;
  startedAt?: number;
}

export interface KernelWorktreeState {
  enabled: boolean;
  path?: string;
  branch?: string;
}

export interface KernelSession {
  id: string;
  title: string;
  provider?: string;
  model?: string;
  mode: KernelSessionMode;
  messages: KernelMessage[];
  approvals: KernelApprovalRecord[];
  tasks: KernelTaskRecord[];
  artifacts: KernelArtifact[];
  background: KernelBackgroundState;
  worktree: KernelWorktreeState;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  compactedAt?: number;
}

export interface KernelPermissionPolicy {
  read: PermissionDecision;
  write: PermissionDecision;
  network: PermissionDecision;
  process: PermissionDecision;
}

export interface KernelToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
  artifacts?: KernelArtifact[];
  summary?: string;
}

export interface KernelToolContext {
  session: KernelSession;
  workspaceRoot?: string;
  abortSignal?: AbortSignal;
}

export interface KernelTool {
  name: string;
  description: string;
  inputSchema: ToolDefinition["parameters"];
  permission?: Partial<KernelPermissionPolicy>;
  renderer?: {
    kind: "text" | "diff" | "json" | "file" | "task";
    collapsible?: boolean;
  };
  execute(input: Record<string, unknown>, context: KernelToolContext): Promise<KernelToolResult>;
}

export interface KernelCompletionRequest {
  session: KernelSession;
  messages: KernelMessage[];
  tools: KernelTool[];
  systemPrompt?: string;
  abortSignal?: AbortSignal;
}

export interface KernelCompletionResponse {
  content: string;
  toolCalls?: KernelToolCall[];
  metadata?: Record<string, unknown>;
}

export interface KernelStreamingChunk {
  type: "text" | "tool_call" | "done";
  text?: string;
  toolCall?: KernelToolCall;
}

export interface KernelCompletionProvider {
  complete(request: KernelCompletionRequest): Promise<KernelCompletionResponse>;
  stream?(
    request: KernelCompletionRequest,
    onChunk: (chunk: KernelStreamingChunk) => void
  ): Promise<KernelCompletionResponse>;
}

export interface SessionRegistryOptions {
  stateDir?: string;
  namespace?: string;
}

export interface SessionListFilter {
  query?: string;
  provider?: string;
  mode?: KernelSessionMode;
}

export interface SessionExportOptions {
  includeMetadata?: boolean;
  includeTasks?: boolean;
  includeApprovals?: boolean;
}

export interface KernelRunOptions {
  sessionId?: string;
  title?: string;
  input: string;
  provider?: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  workspaceRoot?: string;
  abortSignal?: AbortSignal;
  stream?: boolean;
}

export interface KernelRunResult {
  session: KernelSession;
  response: string;
  turns: number;
  toolCalls: number;
}

export interface KernelEventPayloads {
  "session.created": KernelSession;
  "session.updated": KernelSession;
  "message.created": { sessionId: string; message: KernelMessage };
  "tool.started": { sessionId: string; call: KernelToolCall };
  "tool.completed": { sessionId: string; call: KernelToolCall; result: KernelToolResult };
  "approval.recorded": { sessionId: string; approval: KernelApprovalRecord };
  "session.compacted": KernelSession;
}
