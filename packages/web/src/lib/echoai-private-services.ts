import {
  automations,
  devices,
  fileAssets,
  integrations,
  modelRoutes,
  notes,
  projects,
  sessions,
  toolSurfaces,
} from "./echoai-app-data";

export const privateServiceState = {
  auth: {
    session: "mock-authenticated",
    user: "founder@echoai.local",
    workspace: "EchoAI Private Workspace",
    roles: ["owner", "admin"],
    refresh: "ready",
    auditEvents: ["sign-in", "session-refresh", "device-pair", "provider-key-rotated"],
  },
  runtime: {
    kernel: "AgentKernel-compatible web adapter",
    eventStream: ["assistant.delta", "tool.call", "tool.result", "approval.request", "artifact.created"],
    permissions: toolSurfaces.map((tool) => ({ tool: tool.name, policy: tool.policy })),
    taskSurvival: "durable-run-record",
    compaction: "summary-plus-memory",
    contextBuilder: ["project files", "notes", "memories", "selected tools", "device state"],
  },
  models: {
    routes: modelRoutes,
    providerHealth: modelRoutes.map((route) => ({
      route: route.name,
      status: route.mode === "BYOK" ? "needs-vault-key" : "ready",
    })),
    costEstimate: {
      inputTokens: 12000,
      outputTokens: 2400,
      estimatedCredits: 0.42,
    },
    fallback: ["EchoAI Code", "Free Router", "Desktop Local"],
  },
  knowledge: {
    files: fileAssets,
    extraction: ["pdf", "docx", "markdown", "code", "csv", "text"],
    indexes: ["lexical", "semantic", "citations"],
    deletion: "records-storage-chunks-embeddings",
  },
  workspace: {
    projects,
    sessions,
    notes,
    memories: ["global preferences", "workspace rules", "project decisions"],
  },
  tools: {
    toolSurfaces,
    mcpServers: ["filesystem", "github", "browser", "custom"],
    skills: ["coding", "docs", "spreadsheets", "presentations", "browser", "imagegen"],
    integrations,
    sandboxes: ["hosted-code", "browser-session", "desktop-gateway"],
  },
  operations: {
    automations,
    outputs: ["reports", "code patches", "media", "automation runs"],
    billing: ["free lane", "pro credits", "team entitlements", "BYOK visibility"],
    devices,
  },
};

