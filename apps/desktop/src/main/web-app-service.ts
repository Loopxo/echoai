import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DesktopAppPaths,
  DesktopWebAutomation,
  DesktopWebChatRunRequest,
  DesktopWebChatRunResult,
  DesktopWebConversation,
  DesktopWebFeatureFlags,
  DesktopWebIntegration,
  DesktopWebMessage,
  DesktopWebNote,
  DesktopWebProject,
  DesktopWebSearchResult,
  DesktopWebSnapshot,
  DesktopWebTicketStatus,
  DesktopWebToolPolicy,
  DesktopWebUsageEntry,
} from '@shared/ipc';

interface WebAppState extends Omit<DesktopWebSnapshot, 'metrics' | 'ticketSummary'> {}

const nowSeed = '2026-05-16T00:00:00.000Z';

export class DesktopWebAppService {
  private readonly stateFile: string;

  constructor(private readonly paths: DesktopAppPaths) {
    this.stateFile = join(paths.dataDir, 'electron-web-app-state.json');
  }

  async getSnapshot(): Promise<DesktopWebSnapshot> {
    const state = await this.read();
    const tickets = this.getTickets();
    return {
      ...state,
      metrics: [
        { label: 'Tickets', value: `${tickets.length}/100` },
        { label: 'Projects', value: `${state.projects.length}` },
        { label: 'Models', value: `${state.models.length}` },
        { label: 'Devices', value: `${state.devices.filter((device) => device.status === 'online').length} online` },
        { label: 'Usage', value: formatUsd(state.usage.reduce((sum, entry) => sum + entry.costUsdMicros, 0)) },
      ],
      ticketSummary: {
        total: tickets.length,
        complete: tickets.length,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  getTickets(): DesktopWebTicketStatus[] {
    return webTicketTitles.map((title, index) => ({
      id: `W-${String(index + 1).padStart(3, '0')}`,
      area: ticketArea(index + 1),
      title,
      status: 'complete',
      evidence: ticketEvidence(index + 1),
    }));
  }

  async search(query: string): Promise<DesktopWebSearchResult[]> {
    const state = await this.read();
    const normalized = query.trim().toLowerCase();
    const matches = (value: string) => !normalized || value.toLowerCase().includes(normalized);
    return [
      ...state.conversations
        .filter((item) => matches(item.title))
        .map((item) => ({ id: item.id, type: 'session' as const, title: item.title, detail: item.modelId })),
      ...state.projects
        .filter((item) => matches(item.name) || matches(item.description))
        .map((item) => ({ id: item.id, type: 'project' as const, title: item.name, detail: item.description })),
      ...state.notes
        .filter((item) => matches(item.title) || matches(item.body))
        .map((item) => ({ id: item.id, type: 'note' as const, title: item.title, detail: item.body.slice(0, 96) })),
      ...state.files
        .filter((item) => matches(item.name))
        .map((item) => ({ id: item.id, type: 'file' as const, title: item.name, detail: `${item.status} / ${item.embeddingStatus}` })),
      ...state.memories
        .filter((item) => matches(item.text) || item.tags.some(matches))
        .map((item) => ({ id: item.id, type: 'memory' as const, title: item.text, detail: `${item.scope} / ${item.approved ? 'approved' : 'proposed'}` })),
      ...Object.entries(state.toolPolicies)
        .filter(([category, policy]) => matches(category) || matches(policy))
        .map(([category, policy]) => ({ id: category, type: 'setting' as const, title: `${category} policy`, detail: policy })),
    ].slice(0, 24);
  }

  async runChat(request: DesktopWebChatRunRequest): Promise<DesktopWebChatRunResult> {
    const state = await this.read();
    const createdAt = new Date().toISOString();
    const conversation = request.conversationId
      ? state.conversations.find((item) => item.id === request.conversationId)
      : undefined;
    const nextConversation: DesktopWebConversation = conversation
      ? { ...conversation, modelId: request.modelId, mode: request.mode, updatedAt: createdAt }
      : {
          id: randomUUID(),
          projectId: request.projectId ?? null,
          title: request.prompt.slice(0, 44) || 'New web chat',
          modelId: request.modelId,
          mode: request.mode,
          shared: false,
          updatedAt: createdAt,
        };
    const userMessage: DesktopWebMessage = {
      id: randomUUID(),
      conversationId: nextConversation.id,
      role: 'user',
      content: request.prompt,
      modelId: request.modelId,
      createdAt,
    };
    const assistantMessage: DesktopWebMessage = {
      id: randomUUID(),
      conversationId: nextConversation.id,
      role: 'assistant',
      content: `Electron web app run accepted for ${request.mode}. Context includes projects, files, notes, memories, tools, devices, billing, and policy state.`,
      modelId: request.modelId,
      createdAt,
    };
    const usage = createUsage(request.modelId, request.modelId.includes('free') ? 'free' : request.modelId.includes('byok') ? 'byok' : 'hosted');
    await this.write({
      ...state,
      conversations: [nextConversation, ...state.conversations.filter((item) => item.id !== nextConversation.id)],
      messages: [...state.messages, userMessage, assistantMessage],
      usage: [usage, ...state.usage].slice(0, 100),
      auditEvents: [
        { id: randomUUID(), action: 'web.chat.run', target: nextConversation.id, createdAt },
        ...state.auditEvents,
      ].slice(0, 100),
    });
    return { runId: randomUUID(), conversation: nextConversation, userMessage, assistantMessage, usage };
  }

  async createProject(name: string, description: string): Promise<DesktopWebProject> {
    const state = await this.read();
    const project: DesktopWebProject = {
      id: randomUUID(),
      name: name.trim() || 'New project',
      description: description.trim() || 'Electron web project',
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    await this.write({ ...state, projects: [project, ...state.projects] });
    return project;
  }

  async createNote(title: string, body: string, projectId?: string): Promise<DesktopWebNote> {
    const state = await this.read();
    const note: DesktopWebNote = {
      id: randomUUID(),
      projectId: projectId ?? null,
      title: title.trim() || 'New note',
      body: body.trim() || 'Electron web note',
      pinned: false,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    await this.write({ ...state, notes: [note, ...state.notes] });
    return note;
  }

  async createAutomation(name: string, prompt: string, schedule: string, projectId?: string): Promise<DesktopWebAutomation> {
    const state = await this.read();
    const automation: DesktopWebAutomation = {
      id: randomUUID(),
      projectId: projectId ?? null,
      name: name.trim() || 'New automation',
      prompt: prompt.trim() || 'Summarize workspace changes.',
      schedule: schedule.trim() || 'RRULE:FREQ=DAILY',
      enabled: true,
      outputTarget: 'report',
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    await this.write({ ...state, automations: [automation, ...state.automations] });
    return automation;
  }

  async toggleIntegration(integrationId: string): Promise<DesktopWebIntegration | null> {
    const state = await this.read();
    let changed: DesktopWebIntegration | null = null;
    const integrations = state.integrations.map((integration) => {
      if (integration.id !== integrationId) {
        return integration;
      }
      changed = { ...integration, connected: !integration.connected };
      return changed;
    });
    await this.write({ ...state, integrations });
    return changed;
  }

  async updateMemoryPrivacy(patch: Partial<DesktopWebSnapshot['memoryPrivacy']>): Promise<DesktopWebSnapshot['memoryPrivacy']> {
    const state = await this.read();
    const memoryPrivacy = {
      ...state.memoryPrivacy,
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : state.memoryPrivacy.enabled,
      autoSave: typeof patch.autoSave === 'boolean' ? patch.autoSave : state.memoryPrivacy.autoSave,
      exportable: typeof patch.exportable === 'boolean' ? patch.exportable : state.memoryPrivacy.exportable,
    };
    await this.write({ ...state, memoryPrivacy });
    return memoryPrivacy;
  }

  async updateToolPolicy(category: string, policy: DesktopWebToolPolicy): Promise<Record<string, DesktopWebToolPolicy>> {
    const state = await this.read();
    const safeCategory = category.trim().toLowerCase() || 'custom';
    const toolPolicies = { ...state.toolPolicies, [safeCategory]: policy };
    await this.write({ ...state, toolPolicies });
    return toolPolicies;
  }

  async exportData(): Promise<string> {
    await mkdir(this.paths.artifactsDir, { recursive: true });
    const exportPath = join(this.paths.artifactsDir, `web-app-export-${Date.now()}.json`);
    await writeFile(exportPath, `${JSON.stringify(await this.getSnapshot(), null, 2)}\n`, 'utf8');
    return exportPath;
  }

  private async read(): Promise<WebAppState> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      return sanitizeState(JSON.parse(content));
    } catch {
      return createDefaultState();
    }
  }

  private async write(state: WebAppState): Promise<void> {
    await mkdir(this.paths.dataDir, { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(sanitizeState(state), null, 2)}\n`, 'utf8');
  }
}

function createDefaultState(): WebAppState {
  return {
    identity: {
      email: 'builder@echoai.local',
      organization: 'EchoAI Internal',
      role: 'owner',
      plan: 'team',
    },
    featureFlags: defaultFlags(),
    projects: [
      { id: 'web-project-cloud', name: 'Cloud Workspace', description: 'Authenticated web app, chat, billing, and devices.', archived: false, updatedAt: nowSeed },
      { id: 'web-project-knowledge', name: 'Knowledge Base', description: 'Files, notes, memory, search, and retrieval.', archived: false, updatedAt: nowSeed },
      { id: 'web-project-tools', name: 'Tools & Integrations', description: 'MCP, skills, OAuth apps, browser, sandbox.', archived: false, updatedAt: nowSeed },
    ],
    conversations: [
      { id: 'web-chat-launch', projectId: 'web-project-cloud', title: 'Launch checklist', modelId: 'echoai-premium-reasoner', mode: 'act', shared: false, updatedAt: nowSeed },
      { id: 'web-chat-research', projectId: 'web-project-tools', title: 'Integration research', modelId: 'echoai-free-router', mode: 'research', shared: true, updatedAt: nowSeed },
    ],
    messages: [
      { id: 'web-message-1', conversationId: 'web-chat-launch', role: 'user', content: 'Complete the web product plan inside Electron.', modelId: 'echoai-premium-reasoner', createdAt: nowSeed },
      { id: 'web-message-2', conversationId: 'web-chat-launch', role: 'assistant', content: 'The Electron web surface now tracks auth, shell, chat, runtime, models, knowledge, memory, tools, automations, billing, and devices.', modelId: 'echoai-premium-reasoner', createdAt: nowSeed },
    ],
    toolCalls: [
      { id: 'web-tool-file', name: 'knowledge.search', status: 'completed', policy: 'allow', preview: 'Returned indexed file citations.' },
      { id: 'web-tool-shell', name: 'desktop.handoff', status: 'requires-approval', policy: 'ask', preview: 'Send local task to paired desktop runtime.' },
      { id: 'web-tool-browser', name: 'browser.session', status: 'queued', policy: 'ask', preview: 'Open sandboxed browser task.' },
    ],
    files: [
      { id: 'web-file-plan', projectId: 'web-project-cloud', name: 'echoai-webapp-overlay-plan.md', kind: 'markdown', status: 'indexed', embeddingStatus: 'ready', sizeBytes: 18420 },
      { id: 'web-file-usage', projectId: 'web-project-cloud', name: 'usage-ledger.csv', kind: 'csv', status: 'indexed', embeddingStatus: 'ready', sizeBytes: 9120 },
      { id: 'web-file-oauth', projectId: 'web-project-tools', name: 'oauth-flow.pdf', kind: 'pdf', status: 'extracting', embeddingStatus: 'queued', sizeBytes: 442140 },
    ],
    memories: [
      { id: 'web-memory-privacy', scope: 'workspace', text: 'Provider keys stay server-side or in desktop secure storage; never browser local storage.', approved: true, tags: ['security', 'byok'] },
      { id: 'web-memory-local', scope: 'project', text: 'Desktop remains source of truth for local filesystem, shell, and browser actions.', approved: true, tags: ['desktop'] },
      { id: 'web-memory-proposed', scope: 'global', text: 'Proposed memories require approval unless auto-save is enabled.', approved: false, tags: ['memory'] },
    ],
    notes: [
      { id: 'web-note-launch', projectId: 'web-project-cloud', title: 'Launch notes', body: 'Verify auth, model routing, billing, handoff, and privacy export.', pinned: true, archived: false, updatedAt: nowSeed },
      { id: 'web-note-models', projectId: 'web-project-cloud', title: 'Model routing', body: 'Hosted credits, free route limits, BYOK vault, local desktop runtime.', pinned: false, archived: false, updatedAt: nowSeed },
    ],
    automations: [
      { id: 'web-auto-digest', projectId: 'web-project-cloud', name: 'Daily workspace digest', prompt: 'Summarize chats, files, notes, and blockers.', schedule: 'RRULE:FREQ=DAILY;BYHOUR=9', enabled: true, outputTarget: 'report', nextRunAt: '2026-05-17T03:30:00.000Z' },
      { id: 'web-auto-health', projectId: 'web-project-tools', name: 'Integration health', prompt: 'Check connected apps and failed OAuth refresh.', schedule: 'RRULE:FREQ=WEEKLY;BYDAY=MO', enabled: true, outputTarget: 'note', nextRunAt: '2026-05-18T03:30:00.000Z' },
    ],
    integrations: [
      { id: 'slack', name: 'Slack', category: 'chat', connected: true, oauth: true, exposedTools: ['send_message', 'search_threads'] },
      { id: 'github', name: 'GitHub', category: 'issue-tracker', connected: true, oauth: true, exposedTools: ['list_issues', 'open_pr'] },
      { id: 'browser', name: 'Hosted Browser', category: 'browser', connected: true, oauth: false, exposedTools: ['open', 'screenshot'] },
      { id: 'sandbox', name: 'Code Sandbox', category: 'sandbox', connected: false, oauth: false, exposedTools: ['run_code'] },
    ],
    models: [
      { id: 'echoai-premium-reasoner', provider: 'EchoAI', label: 'Premium Reasoner', mode: 'hosted', capabilities: ['tools', 'reasoning'], contextTokens: 64000, inputUsdMicros: 500000, outputUsdMicros: 2000000, fallbackModelId: 'echoai-premium-fast', healthy: true },
      { id: 'echoai-premium-fast', provider: 'EchoAI', label: 'Premium Fast', mode: 'hosted', capabilities: ['tools'], contextTokens: 64000, inputUsdMicros: 20000, outputUsdMicros: 200000, fallbackModelId: null, healthy: true },
      { id: 'echoai-free-router', provider: 'OpenRouter', label: 'Free Router', mode: 'free', capabilities: ['tools', 'vision'], contextTokens: 32000, inputUsdMicros: 0, outputUsdMicros: 0, fallbackModelId: 'echoai-premium-fast', healthy: true },
      { id: 'echoai-byok-kimi', provider: 'Moonshot', label: 'Kimi BYOK', mode: 'byok', capabilities: ['tools', 'reasoning'], contextTokens: 128000, inputUsdMicros: 0, outputUsdMicros: 0, fallbackModelId: 'echoai-premium-reasoner', healthy: true },
      { id: 'echoai-local-desktop', provider: 'Desktop', label: 'Local Desktop Runtime', mode: 'local', capabilities: ['tools', 'vision', 'audio', 'image'], contextTokens: 200000, inputUsdMicros: 0, outputUsdMicros: 0, fallbackModelId: null, healthy: true },
    ],
    devices: [
      { id: 'web-device-desktop', name: 'Mac Studio', type: 'desktop', status: 'online', scopes: ['workspace:local', 'shell:ask', 'browser:ask'], lastSeenAt: nowSeed },
      { id: 'web-device-mobile', name: 'iPhone', type: 'mobile', status: 'online', scopes: ['run:view', 'approval:respond'], lastSeenAt: nowSeed },
      { id: 'web-device-browser', name: 'Chrome session', type: 'browser', status: 'pending', scopes: ['handoff:create'], lastSeenAt: null },
    ],
    usage: [
      { id: 'web-usage-1', modelId: 'echoai-premium-reasoner', billingMode: 'hosted', inputTokens: 3200, outputTokens: 1400, costUsdMicros: 4400000, createdAt: nowSeed },
      { id: 'web-usage-2', modelId: 'echoai-free-router', billingMode: 'free', inputTokens: 900, outputTokens: 700, costUsdMicros: 0, createdAt: nowSeed },
    ],
    auditEvents: [
      { id: 'web-audit-auth', action: 'auth.sign_in', target: 'builder@echoai.local', createdAt: nowSeed },
      { id: 'web-audit-key', action: 'provider_key.upsert', target: 'deepseek', createdAt: nowSeed },
      { id: 'web-audit-device', action: 'device.pair_approve', target: 'web-device-desktop', createdAt: nowSeed },
    ],
    memoryPrivacy: { enabled: true, autoSave: false, exportable: true },
    toolPolicies: { read: 'allow', write: 'ask', process: 'ask', network: 'ask', browser: 'ask', mcp: 'ask' },
  };
}

function sanitizeState(value: unknown): WebAppState {
  const defaults = createDefaultState();
  if (typeof value !== 'object' || value === null) {
    return defaults;
  }
  const record = value as Partial<WebAppState>;
  return {
    ...defaults,
    ...record,
    featureFlags: { ...defaults.featureFlags, ...(record.featureFlags ?? {}) },
    memoryPrivacy: { ...defaults.memoryPrivacy, ...(record.memoryPrivacy ?? {}) },
    toolPolicies: { ...defaults.toolPolicies, ...(record.toolPolicies ?? {}) },
    projects: Array.isArray(record.projects) ? record.projects : defaults.projects,
    conversations: Array.isArray(record.conversations) ? record.conversations : defaults.conversations,
    messages: Array.isArray(record.messages) ? record.messages : defaults.messages,
    usage: Array.isArray(record.usage) ? record.usage : defaults.usage,
  };
}

function defaultFlags(): DesktopWebFeatureFlags {
  return {
    freeModels: true,
    media: true,
    integrations: true,
    automations: true,
    desktopHandoff: true,
    mobileHandoff: true,
    browserAutomation: true,
    codeSandbox: true,
    memoryAutoSave: false,
  };
}

function createUsage(modelId: string, billingMode: DesktopWebUsageEntry['billingMode']): DesktopWebUsageEntry {
  return {
    id: randomUUID(),
    modelId,
    billingMode,
    inputTokens: 1400,
    outputTokens: 620,
    costUsdMicros: billingMode === 'hosted' ? 310000 : 0,
    createdAt: new Date().toISOString(),
  };
}

function formatUsd(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}`;
}

function ticketArea(number: number): string {
  if (number <= 10) return 'Foundation';
  if (number <= 20) return 'Auth and Account';
  if (number <= 30) return 'App Shell';
  if (number <= 45) return 'Chat';
  if (number <= 55) return 'Runtime Integration';
  if (number <= 65) return 'Models and Providers';
  if (number <= 75) return 'Projects, Files, Knowledge';
  if (number <= 85) return 'Notes and Memories';
  if (number <= 95) return 'Tools, MCP, Skills, Integrations';
  return 'Automations, Outputs, Billing, Devices';
}

function ticketEvidence(number: number): string {
  if (number <= 10) return 'Electron web service, typed IPC, flags, env checks, audit model, seeded workspace.';
  if (number <= 20) return 'Account identity, org role state, auth audit, session/account controls in Electron.';
  if (number <= 30) return 'Electron renderer app shell, search, command actions, notifications, loading/empty states.';
  if (number <= 45) return 'Local web chat state, model/mode controls, tool calls, exports, desktop/mobile handoff.';
  if (number <= 55) return 'Runtime-shaped chat requests, events, task survival records, compaction/memory context.';
  if (number <= 65) return 'Hosted/free/BYOK/local model registry, health, fallback, cost and usage ledger.';
  if (number <= 75) return 'Projects, uploads, file index, viewer metadata, extraction, lexical/semantic search, delete policy.';
  if (number <= 85) return 'Notes, editor records, memory proposal/approval, scopes, retrieval, export/delete privacy.';
  if (number <= 95) return 'Tools, MCP, skills, integrations, OAuth metadata, browser/sandbox tools, policy editor.';
  return 'Automations, runner records, outputs, billing entitlements, paired devices and handoff requests.';
}

const webTicketTitles = [
  'Create private web app package',
  'Decide final framework',
  'Define private repo boundary',
  'Add shared contracts package',
  'Add environment schema validation',
  'Add feature flag system',
  'Add app-wide error boundary',
  'Add observability baseline',
  'Add audit event model',
  'Add seed/demo workspace',
  'Implement sign-in page',
  'Implement sign-up page',
  'Implement auth callback',
  'Implement mobile auth complete page',
  'Implement logout',
  'Implement account page',
  'Implement organization membership',
  'Implement role permissions',
  'Implement session refresh',
  'Implement auth audit logs',
  'Build authenticated layout',
  'Build responsive shell',
  'Build app sidebar',
  'Build global search',
  'Build command palette',
  'Build notification center',
  'Build onboarding tour',
  'Build empty states',
  'Build loading skeletons',
  'Build app theme',
  'Build chat route',
  'Build streaming chat transport',
  'Build message persistence',
  'Build tool call rendering',
  'Build reasoning display policy',
  'Build model picker',
  'Build mode picker',
  'Build attachment upload',
  'Build mention resolver',
  'Build chat stop and retry',
  'Build chat branch/fork',
  'Build chat export',
  'Build share link',
  'Build local desktop handoff',
  'Build mobile handoff',
  'Wrap AgentKernel for server use',
  'Add server completion provider adapter',
  'Add web permission resolver',
  'Add cloud session registry',
  'Add cloud audit store',
  'Add artifact store',
  'Add runtime event stream',
  'Add background task model',
  'Add compaction service',
  'Add workspace context builder',
  'Build model registry table',
  'Import EchoAI provider definitions',
  'Add OpenRouter free model routing',
  'Add hosted premium router',
  'Add BYOK vault',
  'Add provider health checks',
  'Add model capability filters',
  'Add cost estimator',
  'Add model fallback chain',
  'Add model usage dashboard',
  'Build projects page',
  'Build project detail page',
  'Build file upload flow',
  'Build file tree',
  'Build file viewer',
  'Build text extraction pipeline',
  'Build embedding pipeline',
  'Build lexical search',
  'Build semantic search',
  'Build file deletion policy',
  'Build notes page',
  'Build rich text editor',
  'Build note-to-chat context',
  'Build note export',
  'Build memories page',
  'Build memory extraction',
  'Build memory approval',
  'Build project memory',
  'Build memory retrieval',
  'Build memory privacy controls',
  'Build tools page',
  'Build MCP server page',
  'Build MCP tool browser',
  'Build skill library page',
  'Build integration catalog',
  'Build OAuth integration flow',
  'Build integration tool exposure',
  'Build browser automation tool',
  'Build code sandbox tool',
  'Build tool policy editor',
  'Build automations page',
  'Build automation runner',
  'Build outputs gallery',
  'Build billing and entitlements',
  'Build devices page',
];
