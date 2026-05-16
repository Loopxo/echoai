import type {
  EchoAIAutomation,
  EchoAIBackgroundRun,
  EchoAIBillingAccount,
  EchoAIChatSession,
  EchoAIDevice,
  EchoAIFeatureFlags,
  EchoAIIntegration,
  EchoAIKnowledgeFile,
  EchoAIMcpServer,
  EchoAIMemory,
  EchoAIModelRoute,
  EchoAINote,
  EchoAIOrgMember,
  EchoAIOutputArtifact,
  EchoAIProject,
  EchoAISkill,
  EchoAIStoredObject,
  EchoAIToolPolicy,
  EchoAIWorkspaceState,
} from "@echoai/contracts";
import { authAuditEvents } from "./audit";
import { defaultFeatureFlags } from "./flags";

export const members: EchoAIOrgMember[] = [
  { id: "user_founder", name: "Founder", email: "founder@echoai.local", role: "owner", status: "active" },
  { id: "user_ops", name: "Ops Admin", email: "ops@echoai.local", role: "admin", status: "active" },
  { id: "user_builder", name: "Builder", email: "builder@echoai.local", role: "member", status: "active" },
];

export const featureFlags: EchoAIFeatureFlags = defaultFeatureFlags;

export const modelRoutes: EchoAIModelRoute[] = [
  {
    id: "model_echoai_code",
    label: "EchoAI Code",
    provider: "EchoAI Cloud",
    model: "echoai-code-premium",
    lane: "hosted",
    contextWindow: 200000,
    inputPerMillion: 3,
    outputPerMillion: 12,
    capabilities: ["tools", "vision", "reasoning"],
    status: "ready",
  },
  {
    id: "model_free_router",
    label: "Free Router",
    provider: "OpenRouter",
    model: "openrouter/free-pool",
    lane: "free",
    contextWindow: 32000,
    inputPerMillion: 0,
    outputPerMillion: 0,
    capabilities: ["tools"],
    status: "rate-limited",
  },
  {
    id: "model_byok_reason",
    label: "BYOK Reason",
    provider: "User Vault",
    model: "user-selected-reasoning",
    lane: "byok",
    contextWindow: 128000,
    inputPerMillion: 0,
    outputPerMillion: 0,
    capabilities: ["tools", "vision", "reasoning", "audio"],
    status: "needs-key",
  },
  {
    id: "model_desktop_local",
    label: "Desktop Local",
    provider: "Paired Desktop",
    model: "local-workspace",
    lane: "local",
    contextWindow: 64000,
    inputPerMillion: 0,
    outputPerMillion: 0,
    capabilities: ["tools", "local-workspace"],
    status: "ready",
  },
];

export const chats: EchoAIChatSession[] = [
  {
    id: "chat_launch",
    title: "Build EchoAI Web launch plan",
    projectId: "project_web",
    mode: "code",
    modelId: "model_echoai_code",
    status: "active",
    updatedAt: "2026-05-16T08:00:00.000Z",
    messages: [
      {
        id: "msg_1",
        role: "user",
        content: "Create the private web app and keep the CLI package clean.",
        createdAt: "2026-05-16T07:58:00.000Z",
        attachments: [
          { id: "att_plan", name: "echoai-webapp-overlay-plan.md", mimeType: "text/markdown", sizeBytes: 18432, status: "indexed" },
        ],
      },
      {
        id: "msg_2",
        role: "assistant",
        content: "The app router shell is ready. Auth, runtime, models, knowledge, tools, automations, billing, and devices are wired through private-service boundaries.",
        createdAt: "2026-05-16T08:00:00.000Z",
        modelId: "model_echoai_code",
        runId: "run_web_launch",
        reasoningSummary: "Use contracts and demo workspace data to validate product UX before private cloud services are attached.",
        toolCalls: [
          { id: "tool_read", kind: "file", title: "Read plan", status: "complete", policy: "allow", summary: "Loaded W-001..W-100 acceptance criteria." },
          { id: "tool_shell", kind: "shell", title: "Typecheck", status: "queued", policy: "ask", summary: "Run TypeScript checks before release." },
        ],
      },
    ],
  },
  {
    id: "chat_mobile_handoff",
    title: "Send approval request to mobile",
    projectId: "project_mobile",
    mode: "act",
    modelId: "model_free_router",
    status: "paused",
    updatedAt: "2026-05-16T07:30:00.000Z",
    messages: [
      { id: "msg_3", role: "user", content: "Notify mobile when a desktop command needs approval.", createdAt: "2026-05-16T07:28:00.000Z" },
      { id: "msg_4", role: "assistant", content: "Mobile handoff is queued through paired device capabilities.", createdAt: "2026-05-16T07:30:00.000Z", modelId: "model_free_router" },
    ],
  },
];

export const files: EchoAIKnowledgeFile[] = [
  {
    id: "file_plan",
    projectId: "project_web",
    name: "echoai-webapp-overlay-plan.md",
    path: "/plans/echoai-webapp-overlay-plan.md",
    mimeType: "text/markdown",
    kind: "markdown",
    sizeBytes: 18432,
    uploadProgress: 100,
    extractionStatus: "indexed",
    chunks: [
      {
        id: "chunk_plan_foundation",
        fileId: "file_plan",
        text: "Private app scaffold, Next.js app router, contracts, env validation, feature flags, audit, and demo workspace.",
        lexicalScore: 0.98,
        semanticScore: 0.94,
        citation: "docs/plans/echoai-webapp-overlay-plan.md#foundation",
      },
    ],
  },
  {
    id: "file_customer_pdf",
    projectId: "project_web",
    name: "customer-upload.pdf",
    path: "/uploads/customer-upload.pdf",
    mimeType: "application/pdf",
    kind: "pdf",
    sizeBytes: 742391,
    uploadProgress: 68,
    extractionStatus: "queued",
    chunks: [],
  },
  {
    id: "file_runtime",
    projectId: "project_runtime",
    name: "runtime/kernel.ts",
    path: "/runtime/kernel.ts",
    mimeType: "text/typescript",
    kind: "code",
    sizeBytes: 52124,
    uploadProgress: 100,
    extractionStatus: "indexed",
    chunks: [
      {
        id: "chunk_runtime_kernel",
        fileId: "file_runtime",
        text: "AgentKernel lifecycle, tool approvals, session memory, and task events.",
        lexicalScore: 0.91,
        semanticScore: 0.89,
        citation: "packages/runtime/src/kernel.ts",
      },
    ],
  },
];

export const notes: EchoAINote[] = [
  {
    id: "note_boundary",
    projectId: "project_web",
    title: "Private backend boundary",
    markdown: "# Boundary\nBilling, hosted routing, vault, and user data stay outside the public CLI package.",
    pinned: true,
    archived: false,
    updatedAt: "2026-05-16T08:05:00.000Z",
  },
  {
    id: "note_model_policy",
    projectId: "project_web",
    title: "Model lane policy",
    markdown: "- Free lane is rate-limited\n- Hosted lane writes usage\n- BYOK keys stay encrypted",
    pinned: false,
    archived: false,
    updatedAt: "2026-05-16T08:06:00.000Z",
  },
];

export const memories: EchoAIMemory[] = [
  {
    id: "memory_design",
    scope: "workspace",
    text: "EchoAI product surfaces should feel like a dense command center, not a marketing landing page.",
    tags: ["design", "web"],
    status: "approved",
    reason: "Repeated product direction across web tickets.",
  },
  {
    id: "memory_project",
    projectId: "project_web",
    scope: "project",
    text: "Use the desktop gateway for local terminal and browser actions from web chat.",
    tags: ["desktop", "handoff"],
    status: "proposed",
    reason: "Derived from chat and device handoff flows.",
  },
];

export const projects: EchoAIProject[] = [
  {
    id: "project_web",
    name: "EchoAI Web Launch",
    description: "Private web product, Overlay-style workspace, and runtime integration.",
    status: "active",
    chatIds: ["chat_launch"],
    noteIds: ["note_boundary", "note_model_policy"],
    fileIds: ["file_plan", "file_customer_pdf"],
    memoryIds: ["memory_design", "memory_project"],
    automationIds: ["automation_digest"],
    outputIds: ["output_report"],
  },
  {
    id: "project_mobile",
    name: "Mobile Control",
    description: "Mobile pairing, approvals, camera, voice, and web handoff.",
    status: "active",
    chatIds: ["chat_mobile_handoff"],
    noteIds: [],
    fileIds: [],
    memoryIds: [],
    automationIds: [],
    outputIds: [],
  },
  {
    id: "project_runtime",
    name: "Runtime Core",
    description: "AgentKernel, tools, permissions, sessions, and background runs.",
    status: "active",
    chatIds: [],
    noteIds: [],
    fileIds: ["file_runtime"],
    memoryIds: [],
    automationIds: [],
    outputIds: [],
  },
];

export const toolPolicies: EchoAIToolPolicy[] = [
  { id: "policy_files", category: "files", policy: "ask", reason: "Writes and deletes require confirmation." },
  { id: "policy_process", category: "process", policy: "ask", reason: "Shell commands can affect local workspaces." },
  { id: "policy_network", category: "network", policy: "ask", reason: "External calls need scoped consent." },
  { id: "policy_mcp", category: "mcp", policy: "ask", reason: "Server tools are inspected before exposure." },
  { id: "policy_browser", category: "browser", policy: "ask", reason: "Browser sessions run in hosted sandboxes." },
  { id: "policy_code", category: "code", policy: "deny", reason: "Hosted code sandbox requires quota entitlement." },
];

export const mcpServers: EchoAIMcpServer[] = [
  { id: "mcp_filesystem", name: "Filesystem", command: "echoai mcp filesystem", status: "enabled", tools: ["read_file", "write_file", "search"] },
  { id: "mcp_github", name: "GitHub", command: "echoai mcp github", status: "disabled", tools: ["issues", "pull_requests", "ci"] },
  { id: "mcp_browser", name: "Browser", command: "echoai mcp browser", status: "enabled", tools: ["open", "click", "screenshot"] },
];

export const integrations: EchoAIIntegration[] = [
  { id: "integration_github", name: "GitHub", category: "developer", status: "available", exposedTools: ["issues", "pull requests", "CI status"] },
  { id: "integration_slack", name: "Slack", category: "communication", status: "needs-oauth", exposedTools: ["messages", "channels", "notifications"] },
  { id: "integration_drive", name: "Google Drive", category: "knowledge", status: "needs-oauth", exposedTools: ["docs", "sheets", "slides"] },
  { id: "integration_desktop", name: "Desktop Gateway", category: "developer", status: "connected", exposedTools: ["terminal", "files", "browser"] },
];

export const skills: EchoAISkill[] = [
  { id: "skill_code", name: "Coding", status: "installed", capabilities: ["patch", "test", "review"] },
  { id: "skill_docs", name: "Documents", status: "available", capabilities: ["docx", "redline", "export"] },
  { id: "skill_browser", name: "Browser", status: "installed", capabilities: ["open", "inspect", "screenshot"] },
  { id: "skill_custom", name: "Custom support triage", status: "draft", capabilities: ["inbox", "summaries"] },
];

export const automations: EchoAIAutomation[] = [
  {
    id: "automation_digest",
    name: "Daily project digest",
    schedule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
    context: "Recent sessions, changed files, notes, memories, and run outputs.",
    outputTarget: "Email, Slack, and EchoAI notification center",
    status: "active",
    retryPolicy: "3 attempts with exponential backoff",
    auditTrail: ["created", "last-run-complete", "next-run-scheduled"],
  },
  {
    id: "automation_dependency_watch",
    name: "Dependency watch",
    schedule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=10",
    context: "Selected package manifests and known vulnerabilities.",
    outputTarget: "Issue draft",
    status: "draft",
    retryPolicy: "manual review before enabling",
    auditTrail: ["draft-created"],
  },
];

export const outputs: EchoAIOutputArtifact[] = [
  { id: "output_report", projectId: "project_web", title: "Launch readiness report", kind: "report", url: "/app/outputs/output_report", createdAt: "2026-05-16T08:15:00.000Z" },
  { id: "output_patch", projectId: "project_runtime", title: "Runtime adapter patch", kind: "code", url: "/app/outputs/output_patch", createdAt: "2026-05-16T08:18:00.000Z" },
  { id: "output_media", projectId: "project_web", title: "Product walkthrough stills", kind: "media", url: "/app/outputs/output_media", createdAt: "2026-05-16T08:20:00.000Z" },
];

export const billing: EchoAIBillingAccount = {
  workspaceId: "workspace_echoai",
  plan: "team",
  creditsRemaining: 842,
  monthlySpend: 128.32,
  entitlements: ["hosted-premium", "byok-vault", "automations", "desktop-handoff", "mobile-handoff"],
  invoices: [
    { id: "invoice_may", amount: 149, status: "open", issuedAt: "2026-05-01T00:00:00.000Z" },
    { id: "invoice_apr", amount: 119, status: "paid", issuedAt: "2026-04-01T00:00:00.000Z" },
  ],
};

export const devices: EchoAIDevice[] = [
  { id: "device_mac", name: "MacBook Pro gateway", type: "desktop", status: "online", capabilities: ["terminal", "files", "browser", "approvals"], lastSeenAt: "2026-05-16T08:21:00.000Z" },
  { id: "device_android", name: "Android mobile", type: "mobile", status: "pairing", capabilities: ["chat", "voice", "camera", "approvals", "location"], lastSeenAt: "2026-05-16T08:19:00.000Z" },
  { id: "device_cli", name: "EchoAI CLI", type: "cli", status: "online", capabilities: ["sessions", "mcp", "tasks"], lastSeenAt: "2026-05-16T08:20:00.000Z" },
  { id: "device_relay", name: "Cloud relay", type: "gateway", status: "offline", capabilities: ["remote tunnel", "durable stream"], lastSeenAt: "2026-05-15T20:00:00.000Z" },
];

export const backgroundRuns: EchoAIBackgroundRun[] = [
  { id: "run_web_launch", sessionId: "chat_launch", status: "running", survivesRefresh: true, updatedAt: "2026-05-16T08:22:00.000Z" },
  { id: "run_mobile_approval", sessionId: "chat_mobile_handoff", status: "waiting_for_approval", survivesRefresh: true, updatedAt: "2026-05-16T08:17:00.000Z" },
];

export const storedObjects: EchoAIStoredObject[] = [];

export const workspaceState: EchoAIWorkspaceState = {
  session: {
    id: "session_web_owner",
    userId: "user_founder",
    email: "founder@echoai.local",
    workspaceId: "workspace_echoai",
    roles: ["owner", "admin"],
    expiresAt: "2026-06-16T00:00:00.000Z",
    refreshedAt: "2026-05-16T08:18:00.000Z",
  },
  members,
  flags: featureFlags,
  auditEvents: authAuditEvents,
  models: modelRoutes,
  chats,
  projects,
  files,
  notes,
  memories,
  toolPolicies,
  mcpServers,
  integrations,
  skills,
  automations,
  outputs,
  billing,
  usageEvents: [
    {
      id: "usage_seed_model",
      workspaceId: "workspace_echoai",
      source: "model",
      label: "EchoAI Code seed run",
      units: 1,
      costUsd: 0.42,
      runId: "run_web_launch",
      createdAt: "2026-05-16T08:22:00.000Z",
    },
  ],
  providerKeys: [
    {
      id: "provider_key_seed",
      workspaceId: "workspace_echoai",
      provider: "openai",
      label: "OpenAI BYOK",
      status: "needs_rotation",
      encryptedRef: "vault://workspace_echoai/provider/openai",
      createdAt: "2026-05-16T08:12:00.000Z",
    },
  ],
  storedObjects,
  externalAdapters: [
    {
      id: "adapter_local_store",
      name: "Local file workspace store",
      category: "realtime",
      status: "ready",
      requiredEnv: [],
      capability: "Durable local development state and mutation testing.",
    },
    {
      id: "adapter_desktop_gateway",
      name: "EchoAI desktop gateway",
      category: "sandbox",
      status: "ready",
      requiredEnv: [],
      capability: "Local terminal, files, browser, and approvals through paired desktop.",
    },
  ],
  devices,
  backgroundRuns,
};
