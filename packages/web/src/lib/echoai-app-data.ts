export type AppNavItem = {
  label: string;
  href: string;
  key: string;
};

export type StatusMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warn" | "neutral";
};

export type ModelRoute = {
  name: string;
  provider: string;
  mode: "Hosted" | "Free" | "BYOK" | "Local";
  capabilities: string[];
  status: string;
};

export type ProjectSnapshot = {
  name: string;
  scope: string;
  sessions: number;
  files: number;
  memory: string;
  nextAction: string;
};

export type ToolSurface = {
  name: string;
  category: string;
  policy: "Allow" | "Ask" | "Deny";
  source: string;
  detail: string;
};

export type AutomationDraft = {
  name: string;
  schedule: string;
  context: string;
  output: string;
  status: "Draft" | "Ready" | "Needs setup";
};

export type SessionSnapshot = {
  title: string;
  source: "Web" | "Desktop" | "CLI" | "Mobile";
  model: string;
  status: "Active" | "Paused" | "Completed";
  context: string;
};

export type FileAsset = {
  name: string;
  kind: string;
  project: string;
  indexStatus: "Indexed" | "Queued" | "Skipped";
  use: string;
};

export type NoteAsset = {
  title: string;
  project: string;
  updated: string;
  use: string;
};

export type IntegrationSurface = {
  name: string;
  category: string;
  status: "Connected" | "Available" | "Private backend";
  tools: string;
};

export type DeviceEndpoint = {
  name: string;
  type: "Desktop" | "Mobile" | "CLI" | "Gateway";
  status: "Online" | "Offline" | "Pairing";
  capability: string;
};

export type BuildMilestone = {
  id: string;
  name: string;
  tickets: string;
  state: "Now" | "Next" | "Later";
  outcome: string;
};

export const appNav: AppNavItem[] = [
  { label: "Command Center", href: "/app", key: "home" },
  { label: "Chat", href: "/app/chat", key: "chat" },
  { label: "Sessions", href: "/app/sessions", key: "sessions" },
  { label: "Projects", href: "/app/projects", key: "projects" },
  { label: "Files", href: "/app/files", key: "files" },
  { label: "Knowledge", href: "/app/knowledge", key: "knowledge" },
  { label: "Notes", href: "/app/notes", key: "notes" },
  { label: "Memories", href: "/app/memories", key: "memories" },
  { label: "Tools", href: "/app/tools", key: "tools" },
  { label: "Integrations", href: "/app/integrations", key: "integrations" },
  { label: "Automations", href: "/app/automations", key: "automations" },
  { label: "Outputs", href: "/app/outputs", key: "outputs" },
  { label: "Devices", href: "/app/devices", key: "devices" },
  { label: "Usage", href: "/app/usage", key: "usage" },
  { label: "Billing", href: "/app/billing", key: "billing" },
  { label: "Settings", href: "/app/settings", key: "settings" },
  { label: "Admin", href: "/app/admin", key: "admin" },
];

export const statusMetrics: StatusMetric[] = [
  {
    label: "Runtime",
    value: "AgentKernel",
    detail: "Web shell is aligned to packages/runtime sessions, tools, permissions, and tasks.",
    tone: "good",
  },
  {
    label: "Model router",
    value: "4 lanes",
    detail: "Hosted, free, BYOK, and local desktop models are represented in the UI.",
    tone: "good",
  },
  {
    label: "Private backend",
    value: "Planned",
    detail: "Auth, billing, vault, and hosted routing remain private product services.",
    tone: "warn",
  },
  {
    label: "Devices",
    value: "Gateway ready",
    detail: "Desktop, mobile, CLI, and web converge around EchoAI gateway concepts.",
    tone: "neutral",
  },
];

export const modelRoutes: ModelRoute[] = [
  {
    name: "EchoAI Code",
    provider: "EchoAI hosted",
    mode: "Hosted",
    capabilities: ["tools", "code", "long context"],
    status: "Premium route with usage ledger",
  },
  {
    name: "Free Router",
    provider: "OpenRouter/free pool",
    mode: "Free",
    capabilities: ["chat", "light tools", "fallback"],
    status: "Rate limited web entry lane",
  },
  {
    name: "Claude / OpenAI BYOK",
    provider: "User vault",
    mode: "BYOK",
    capabilities: ["reasoning", "vision", "tools"],
    status: "Requires encrypted key vault",
  },
  {
    name: "Desktop Local",
    provider: "Paired gateway",
    mode: "Local",
    capabilities: ["workspace", "terminal", "browser"],
    status: "Runs through paired desktop",
  },
];

export const projects: ProjectSnapshot[] = [
  {
    name: "EchoAI Web Launch",
    scope: "Private SaaS workspace",
    sessions: 18,
    files: 42,
    memory: "Product architecture, pricing, app shell decisions",
    nextAction: "Wire chat transport to cloud runtime adapter",
  },
  {
    name: "Desktop Cowork",
    scope: "Electron + local runtime",
    sessions: 11,
    files: 27,
    memory: "Sandbox, MCP, permissions, pairing",
    nextAction: "Expose desktop capabilities to web handoff",
  },
  {
    name: "Mobile Control",
    scope: "iOS and Android",
    sessions: 9,
    files: 31,
    memory: "Gateway pairing, approvals, capture",
    nextAction: "Add device trust contract",
  },
];

export const toolSurfaces: ToolSurface[] = [
  {
    name: "Workspace files",
    category: "Runtime",
    policy: "Ask",
    source: "packages/runtime built-in tools",
    detail: "Read, write, patch, diff, grep, glob, diagnostics, and symbol actions.",
  },
  {
    name: "MCP tools",
    category: "Extensions",
    policy: "Ask",
    source: "src/cli/mcp.ts and packages/gateway",
    detail: "Server registry, schemas, tool calls, and audit trail.",
  },
  {
    name: "Browser automation",
    category: "Automation",
    policy: "Ask",
    source: "packages/browser plus desktop gateway",
    detail: "Cloud browser sessions or paired desktop browser tasks.",
  },
  {
    name: "Knowledge retrieval",
    category: "Context",
    policy: "Allow",
    source: "packages/memory and web knowledge index",
    detail: "Project files, notes, memories, and citations for model context.",
  },
  {
    name: "Shell tasks",
    category: "Desktop handoff",
    policy: "Ask",
    source: "packages/runtime tasks",
    detail: "Desktop executes local commands with approvals and logs.",
  },
  {
    name: "Network actions",
    category: "Security",
    policy: "Ask",
    source: "web tool policy",
    detail: "Fetch, app integrations, and external writes require scoped consent.",
  },
];

export const automations: AutomationDraft[] = [
  {
    name: "Daily project digest",
    schedule: "Weekdays at 9:00",
    context: "Recent sessions, files changed, tasks, and memory updates",
    output: "Email, Slack, and app notification",
    status: "Ready",
  },
  {
    name: "Dependency watch",
    schedule: "Every Monday",
    context: "Selected repositories and package manifests",
    output: "Issue draft with upgrade risk notes",
    status: "Draft",
  },
  {
    name: "Customer support triage",
    schedule: "Every 30 minutes",
    context: "Connected inbox, docs, known incidents",
    output: "Prioritized response queue",
    status: "Needs setup",
  },
];

export const sessions: SessionSnapshot[] = [
  {
    title: "Build EchoAI Web foundation",
    source: "Web",
    model: "EchoAI Code",
    status: "Active",
    context: "Plan W-001..W-100, Overlay-style web shell, runtime adapter contract",
  },
  {
    title: "Desktop cowork sandbox review",
    source: "Desktop",
    model: "Desktop Local",
    status: "Paused",
    context: "Electron, local workspace, terminal approvals, MCP tools",
  },
  {
    title: "CLI release readiness",
    source: "CLI",
    model: "EchoAI Reason",
    status: "Completed",
    context: "Tests, providers, docs, package readiness",
  },
  {
    title: "Mobile pairing UX",
    source: "Mobile",
    model: "Free Router",
    status: "Active",
    context: "Device trust, approval notifications, QR pairing",
  },
];

export const fileAssets: FileAsset[] = [
  {
    name: "echoai-webapp-overlay-plan.md",
    kind: "Plan",
    project: "EchoAI Web Launch",
    indexStatus: "Indexed",
    use: "Primary ticket source for the private web product",
  },
  {
    name: "runtime/kernel.ts",
    kind: "Code",
    project: "EchoAI Runtime",
    indexStatus: "Indexed",
    use: "AgentKernel event, tool, permission, and session behavior",
  },
  {
    name: "gateway/protocol/index.ts",
    kind: "Protocol",
    project: "EchoAI Ecosystem",
    indexStatus: "Indexed",
    use: "Web, desktop, mobile, and CLI JSON-RPC contract",
  },
  {
    name: "customer-upload.pdf",
    kind: "Document",
    project: "Demo workspace",
    indexStatus: "Queued",
    use: "Example uploaded knowledge file for retrieval",
  },
];

export const notes: NoteAsset[] = [
  {
    title: "Private backend boundary",
    project: "EchoAI Web Launch",
    updated: "Today",
    use: "Billing, hosted routing, vault, and user data stay out of the public CLI package",
  },
  {
    title: "Model lane policy",
    project: "EchoAI Web Launch",
    updated: "Today",
    use: "Hosted, free, BYOK, and local desktop models need separate usage and trust rules",
  },
  {
    title: "Device handoff contract",
    project: "EchoAI Ecosystem",
    updated: "Today",
    use: "Web can ask desktop to act locally and mobile can approve sensitive actions",
  },
];

export const integrations: IntegrationSurface[] = [
  {
    name: "GitHub",
    category: "Developer",
    status: "Available",
    tools: "Issues, pull requests, repositories, CI status",
  },
  {
    name: "Slack",
    category: "Team",
    status: "Available",
    tools: "Messages, channels, summaries, notifications",
  },
  {
    name: "Google Drive",
    category: "Knowledge",
    status: "Private backend",
    tools: "Docs, Sheets, Slides, file sync",
  },
  {
    name: "Desktop Gateway",
    category: "Local action",
    status: "Connected",
    tools: "Terminal, files, browser, app approvals",
  },
  {
    name: "MCP servers",
    category: "Extension",
    status: "Available",
    tools: "User-installed external tool servers",
  },
];

export const devices: DeviceEndpoint[] = [
  {
    name: "MacBook Pro gateway",
    type: "Desktop",
    status: "Online",
    capability: "Local workspace, terminal, browser, approvals",
  },
  {
    name: "EchoAI CLI",
    type: "CLI",
    status: "Online",
    capability: "Sessions, tasks, MCP, diagnostics",
  },
  {
    name: "Android node",
    type: "Mobile",
    status: "Pairing",
    capability: "Chat, camera, voice, approvals, location",
  },
  {
    name: "Cloud relay",
    type: "Gateway",
    status: "Offline",
    capability: "Remote tunnel and durable streaming relay",
  },
];

export const milestones: BuildMilestone[] = [
  {
    id: "W-001..W-030",
    name: "Private web foundation",
    tickets: "App shell, auth shape, navigation, data domains, feature flags",
    state: "Now",
    outcome: "A real EchoAI web command center can be reviewed and iterated.",
  },
  {
    id: "W-031..W-055",
    name: "Runtime chat",
    tickets: "Streaming, sessions, permissions, artifacts, event transport",
    state: "Next",
    outcome: "Web chat runs through EchoAI runtime instead of static demo data.",
  },
  {
    id: "W-056..W-075",
    name: "Models and knowledge",
    tickets: "Hosted/free/BYOK routing, usage, files, search, embeddings",
    state: "Next",
    outcome: "The web app becomes a model and context workspace.",
  },
  {
    id: "W-076..W-100",
    name: "Ecosystem closure",
    tickets: "Notes, memories, MCP, skills, automations, billing, devices",
    state: "Later",
    outcome: "Web, desktop, mobile, and CLI operate as one product.",
  },
];
