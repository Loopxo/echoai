import type { ToolDefinition } from "@echoai/core";

export type KernelSessionMode = "default" | "plan";
export type KernelTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PermissionDecision = "allow" | "ask" | "deny";
export type KernelToolExecutionMode = "parallel" | "serial";
export type KernelCompactionStrategy = "microcompact" | "summary" | "truncate";
export type KernelPromptSectionMode = "static" | "dynamic";
export type KernelPermissionRuleLayer = "policy" | "flag" | "local" | "project" | "user" | "safe_path";

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
  source?: string;
  resolver?: string;
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
  systemPrompt?: string | KernelSystemPromptConfig;
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
  compaction?: KernelCompactionReport;
}

export interface KernelCompactionReport {
  beforeCount: number;
  afterCount: number;
  removedMessages: number;
  summarizedMessages: number;
  appliedStrategies: KernelCompactionStrategy[];
}

export interface KernelPromptSectionContext {
  session: KernelSession;
  workspaceRoot?: string;
  currentDate: string;
  sessionMemory?: string;
}

export interface KernelPromptSection {
  name: string;
  mode: KernelPromptSectionMode;
  compute(context: KernelPromptSectionContext): Promise<string | null> | string | null;
}

export interface KernelSystemPromptConfig {
  basePrompt?: string;
  sections?: KernelPromptSection[];
}

export interface KernelToolBeforeHookPayload {
  session: KernelSession;
  call: KernelToolCall;
  workspaceRoot?: string;
  abortSignal?: AbortSignal;
  skip?: boolean;
  result?: KernelToolResult;
}

export interface KernelToolAfterHookPayload {
  session: KernelSession;
  call: KernelToolCall;
  result: KernelToolResult;
}

export interface KernelSessionHookPayload {
  session: KernelSession;
  options?: KernelRunOptions;
}

export interface KernelMessageHookPayload {
  session: KernelSession;
  message: KernelMessage;
}

export interface KernelPermissionHookPayload {
  session: KernelSession;
  call: KernelToolCall;
  permissionRequest: {
    id: string;
    sessionId: string;
    toolName: string;
    scope: "read" | "write" | "network" | "process";
    decision: PermissionDecision;
    risk: "low" | "medium" | "high" | "critical";
    reason: string;
    resource?: string;
    metadata?: Record<string, unknown>;
  };
  decision?: {
    decision: "approved" | "denied";
    reason?: string;
    source?: string;
    resolver?: string;
  };
}

export interface KernelForkOptions {
  title?: string;
  provider?: string;
  model?: string;
  includeMessages?: boolean;
  includeMetadata?: boolean;
  worktree?: {
    enabled: boolean;
    path?: string;
    branch?: string;
    createMode?: "copy";
  };
}

export interface KernelSessionEventRecord {
  id: string;
  sessionId: string;
  type: string;
  createdAt: number;
  payload: Record<string, unknown>;
}

export type KernelRunEvent =
  | { type: "run.started"; session: KernelSession }
  | { type: "message.created"; sessionId: string; message: KernelMessage }
  | { type: "assistant.delta"; sessionId: string; text: string }
  | { type: "assistant.tool_call"; sessionId: string; call: KernelToolCall }
  | { type: "tool.batch.started"; sessionId: string; mode: KernelToolExecutionMode; calls: KernelToolCall[] }
  | { type: "tool.started"; sessionId: string; call: KernelToolCall }
  | { type: "tool.completed"; sessionId: string; call: KernelToolCall; result: KernelToolResult }
  | { type: "approval.recorded"; sessionId: string; approval: KernelApprovalRecord }
  | { type: "session.compacted"; session: KernelSession; report: KernelCompactionReport }
  | { type: "run.completed"; result: KernelRunResult };

export interface KernelShellTaskOptions {
  title?: string;
  cwd?: string;
}

export interface KernelEventPayloads {
  "session.created": KernelSession;
  "session.updated": KernelSession;
  "message.created": { sessionId: string; message: KernelMessage };
  "tool.batch.started": { sessionId: string; mode: KernelToolExecutionMode; calls: KernelToolCall[] };
  "tool.started": { sessionId: string; call: KernelToolCall };
  "tool.completed": { sessionId: string; call: KernelToolCall; result: KernelToolResult };
  "approval.recorded": { sessionId: string; approval: KernelApprovalRecord };
  "task.started": { sessionId: string; task: KernelTaskRecord };
  "task.updated": { sessionId: string; task: KernelTaskRecord };
  "session.compacted": { session: KernelSession; report: KernelCompactionReport };
}
