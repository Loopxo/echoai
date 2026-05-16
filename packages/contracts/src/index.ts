export type EchoAIId = string;

export type EchoAIRole = "owner" | "admin" | "member" | "viewer";
export type EchoAIPolicy = "allow" | "ask" | "deny";
export type EchoAIDeviceType = "desktop" | "mobile" | "cli" | "gateway";
export type EchoAIModelLane = "hosted" | "free" | "byok" | "local";
export type EchoAIRunMode = "ask" | "act" | "code" | "research" | "media" | "automation";
export type EchoAIArtifactKind = "document" | "report" | "code" | "media" | "log";
export type EchoAIStreamEventType =
  | "assistant.delta"
  | "tool.call"
  | "tool.result"
  | "approval.request"
  | "artifact.created"
  | "run.status";

export interface EchoAIOrgMember {
  id: EchoAIId;
  name: string;
  email: string;
  role: EchoAIRole;
  status: "active" | "invited";
}

export interface EchoAIAuthSession {
  id: EchoAIId;
  userId: EchoAIId;
  email: string;
  workspaceId: EchoAIId;
  roles: EchoAIRole[];
  expiresAt: string;
  refreshedAt: string;
}

export interface EchoAIFeatureFlags {
  freeModels: boolean;
  hostedPremiumModels: boolean;
  byokVault: boolean;
  mediaGeneration: boolean;
  integrations: boolean;
  automations: boolean;
  desktopHandoff: boolean;
  mobileHandoff: boolean;
}

export interface EchoAIAuditEvent {
  id: EchoAIId;
  type:
    | "auth.sign_in"
    | "auth.sign_out"
    | "auth.failed"
    | "auth.refresh"
    | "billing.updated"
    | "device.paired"
    | "provider_key.changed"
    | "tool.approved"
    | "tool.denied"
    | "runtime.event";
  actorId: EchoAIId;
  workspaceId: EchoAIId;
  runId?: EchoAIId;
  summary: string;
  createdAt: string;
}

export interface EchoAIModelRoute {
  id: EchoAIId;
  label: string;
  provider: string;
  model: string;
  lane: EchoAIModelLane;
  contextWindow: number;
  inputPerMillion: number;
  outputPerMillion: number;
  capabilities: Array<"tools" | "vision" | "reasoning" | "audio" | "image" | "local-workspace">;
  status: "ready" | "rate-limited" | "needs-key" | "offline";
}

export interface EchoAIToolCall {
  id: EchoAIId;
  kind: "file" | "shell" | "mcp" | "browser" | "code";
  title: string;
  status: "queued" | "running" | "complete" | "blocked";
  policy: EchoAIPolicy;
  summary: string;
}

export interface EchoAIAttachment {
  id: EchoAIId;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: "queued" | "uploaded" | "indexed" | "failed";
}

export interface EchoAIChatMessage {
  id: EchoAIId;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  modelId?: EchoAIId;
  runId?: EchoAIId;
  reasoningSummary?: string;
  attachments?: EchoAIAttachment[];
  toolCalls?: EchoAIToolCall[];
}

export interface EchoAIChatSession {
  id: EchoAIId;
  title: string;
  projectId: EchoAIId;
  mode: EchoAIRunMode;
  modelId: EchoAIId;
  status: "active" | "paused" | "complete" | "failed";
  forkedFromMessageId?: EchoAIId;
  messages: EchoAIChatMessage[];
  updatedAt: string;
}

export interface EchoAIProject {
  id: EchoAIId;
  name: string;
  description: string;
  status: "active" | "archived";
  chatIds: EchoAIId[];
  noteIds: EchoAIId[];
  fileIds: EchoAIId[];
  memoryIds: EchoAIId[];
  automationIds: EchoAIId[];
  outputIds: EchoAIId[];
}

export interface EchoAIKnowledgeFile {
  id: EchoAIId;
  projectId: EchoAIId;
  name: string;
  path: string;
  mimeType: string;
  kind: "pdf" | "image" | "markdown" | "code" | "csv" | "docx" | "text";
  sizeBytes: number;
  uploadProgress: number;
  extractionStatus: "queued" | "indexed" | "skipped" | "failed";
  chunks: EchoAIKnowledgeChunk[];
  deletedAt?: string;
}

export interface EchoAIKnowledgeChunk {
  id: EchoAIId;
  fileId: EchoAIId;
  text: string;
  lexicalScore: number;
  semanticScore: number;
  citation: string;
}

export interface EchoAINote {
  id: EchoAIId;
  projectId: EchoAIId;
  title: string;
  markdown: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
}

export interface EchoAIMemory {
  id: EchoAIId;
  projectId?: EchoAIId;
  scope: "global" | "workspace" | "project";
  text: string;
  tags: string[];
  status: "proposed" | "approved" | "disabled";
  reason: string;
}

export interface EchoAIToolPolicy {
  id: EchoAIId;
  category: "files" | "process" | "network" | "mcp" | "browser" | "code";
  policy: EchoAIPolicy;
  reason: string;
}

export interface EchoAIMcpServer {
  id: EchoAIId;
  name: string;
  command: string;
  status: "enabled" | "disabled" | "error";
  tools: string[];
}

export interface EchoAIIntegration {
  id: EchoAIId;
  name: string;
  category: "developer" | "communication" | "knowledge" | "storage";
  status: "connected" | "available" | "needs-oauth";
  exposedTools: string[];
}

export interface EchoAISkill {
  id: EchoAIId;
  name: string;
  status: "installed" | "available" | "draft";
  capabilities: string[];
}

export interface EchoAIAutomation {
  id: EchoAIId;
  name: string;
  schedule: string;
  context: string;
  outputTarget: string;
  status: "active" | "paused" | "draft";
  retryPolicy: string;
  auditTrail: string[];
}

export interface EchoAIOutputArtifact {
  id: EchoAIId;
  projectId: EchoAIId;
  title: string;
  kind: EchoAIArtifactKind;
  url: string;
  createdAt: string;
}

export interface EchoAIBillingAccount {
  workspaceId: EchoAIId;
  plan: "free" | "pro" | "team" | "enterprise";
  creditsRemaining: number;
  monthlySpend: number;
  entitlements: string[];
  invoices: Array<{ id: EchoAIId; amount: number; status: "paid" | "open"; issuedAt: string }>;
}

export interface EchoAIDevice {
  id: EchoAIId;
  name: string;
  type: EchoAIDeviceType;
  status: "online" | "offline" | "pairing";
  capabilities: string[];
  lastSeenAt: string;
}

export interface EchoAIRuntimeEvent {
  id: EchoAIId;
  type: EchoAIStreamEventType;
  runId: EchoAIId;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface EchoAIBackgroundRun {
  id: EchoAIId;
  sessionId: EchoAIId;
  status: "queued" | "running" | "waiting_for_approval" | "complete" | "failed";
  survivesRefresh: boolean;
  updatedAt: string;
}

export interface EchoAIWorkspaceState {
  session: EchoAIAuthSession;
  members: EchoAIOrgMember[];
  flags: EchoAIFeatureFlags;
  auditEvents: EchoAIAuditEvent[];
  models: EchoAIModelRoute[];
  chats: EchoAIChatSession[];
  projects: EchoAIProject[];
  files: EchoAIKnowledgeFile[];
  notes: EchoAINote[];
  memories: EchoAIMemory[];
  toolPolicies: EchoAIToolPolicy[];
  mcpServers: EchoAIMcpServer[];
  integrations: EchoAIIntegration[];
  skills: EchoAISkill[];
  automations: EchoAIAutomation[];
  outputs: EchoAIOutputArtifact[];
  billing: EchoAIBillingAccount;
  devices: EchoAIDevice[];
  backgroundRuns: EchoAIBackgroundRun[];
}
