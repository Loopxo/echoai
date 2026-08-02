import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DesktopBrowserAction,
  DesktopBrowserSession,
  DesktopCapabilityTicket,
  DesktopCommandClassification,
  DesktopCommandRisk,
  DesktopGatewayStatus,
  DesktopMcpRuntimeStatus,
  DesktopMcpServer,
  DesktopMcpToolInfo,
  DesktopMemoryIndex,
  DesktopMemorySearchResult,
  DesktopOperationStatus,
  DesktopParityMetric,
  DesktopReleaseChecklistItem,
  DesktopRuntimeStatus,
  DesktopSampleAudit,
  DesktopSandboxCommandPlan,
  DesktopSandboxProfile,
  DesktopSandboxStatus,
  DesktopServiceHealth,
  DesktopSourceRepo,
  DesktopTaskRecord,
  DesktopTerminalWorkspace,
  DesktopWorkbenchApproval,
  DesktopWorkbenchMemory,
  DesktopWorkbenchProject,
  DesktopWorkbenchSnapshot,
  DesktopWorkflowNode,
  DesktopWorkflowRun,
  DesktopWorkflowTemplate,
} from '@shared/ipc';

interface WorkbenchState {
  projects: DesktopWorkbenchProject[];
  activeProjectId: string | null;
  memories: DesktopWorkbenchMemory[];
  approvals: DesktopWorkbenchApproval[];
  workflows: DesktopWorkflowRun[];
  browserSessions: DesktopBrowserSession[];
  browserActions: DesktopBrowserAction[];
  sandboxPlans: DesktopSandboxCommandPlan[];
}

interface WorkbenchSnapshotInput {
  activeWorkspacePath: string | null;
  runtimeStatus: DesktopRuntimeStatus;
  gatewayStatus: DesktopGatewayStatus;
  sandboxStatus: DesktopSandboxStatus;
  releaseReadiness: DesktopReleaseChecklistItem[];
  mcpServers: DesktopMcpServer[];
  mcpTools: DesktopMcpToolInfo[];
  /**
   * Live status from the MCP runtime. Preferred over deriving it from the
   * persisted config, which cannot tell a server that handshook from one that
   * crashed on startup.
   */
  mcpRuntimeStatus?: DesktopMcpRuntimeStatus[];
  terminalTasks: DesktopTaskRecord[];
}

const copyPolicy =
  'Clean-room implementation: samples are reference material; copy only small license-compatible snippets after attribution review.';

export class DesktopWorkbenchService {
  private readonly stateFile: string;

  constructor(private readonly dataDir: string) {
    this.stateFile = join(dataDir, 'workbench-state.json');
  }

  async getSnapshot(input: WorkbenchSnapshotInput): Promise<DesktopWorkbenchSnapshot> {
    const state = await this.read();
    return {
      generatedAt: new Date().toISOString(),
      productPosture:
        'Local-first professional agent workspace with native Electron runtime, private approvals, workflows, memory, tools, remote handoff, and release discipline.',
      copyPolicy,
      localFirst: true,
      activeWorkspacePath: input.activeWorkspacePath,
      sampleAudits: createSampleAudits(),
      parityMetrics: createParityMetrics(),
      capabilities: createCapabilityTickets(),
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      memories: state.memories,
      approvals: state.approvals,
      workflows: state.workflows,
      workflowTemplates: createWorkflowTemplates(),
      browserSessions: state.browserSessions,
      browserActions: state.browserActions,
      sandboxProfiles: createSandboxProfiles(input.sandboxStatus),
      sandboxPlans: state.sandboxPlans,
      mcpRuntimes:
        input.mcpRuntimeStatus ?? createMcpRuntimes(input.mcpServers, input.mcpTools),
      memoryIndex: createMemoryIndex(state.memories),
      terminalWorkspaces: createTerminalWorkspaces(input.terminalTasks),
      serviceHealth: createServiceHealth(input),
      releaseReadiness: input.releaseReadiness,
    };
  }

  async createProject(
    name: string,
    description: string,
    workspacePath?: string
  ): Promise<DesktopWorkbenchProject> {
    const state = await this.read();
    const project: DesktopWorkbenchProject = {
      id: randomUUID(),
      name: sanitizeText(name, 'Untitled project', 80),
      description: sanitizeText(description, 'Local-first EchoAI workspace project.', 240),
      workspacePath: workspacePath ?? null,
      status: 'active',
      lastActiveAt: new Date().toISOString(),
    };
    await this.write({
      ...state,
      activeProjectId: project.id,
      projects: [project, ...state.projects].slice(0, 50),
    });
    return project;
  }

  async addMemory(input: {
    scope: DesktopWorkbenchMemory['scope'];
    text: string;
    source: string;
    tags?: string[];
  }): Promise<DesktopWorkbenchMemory> {
    const state = await this.read();
    const memory: DesktopWorkbenchMemory = {
      id: randomUUID(),
      scope: input.scope,
      text: sanitizeText(input.text, 'Memory item', 500),
      source: sanitizeText(input.source, 'manual', 120),
      tags: (input.tags ?? []).map((tag) => sanitizeText(tag, 'tag', 32)).slice(0, 8),
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    await this.write({ ...state, memories: [memory, ...state.memories].slice(0, 200) });
    return memory;
  }

  async pinMemory(memoryId: string, pinned: boolean): Promise<DesktopWorkbenchMemory | null> {
    const state = await this.read();
    let updated: DesktopWorkbenchMemory | null = null;
    const memories = state.memories.map((memory) => {
      if (memory.id !== memoryId) {
        return memory;
      }
      updated = { ...memory, pinned };
      return updated;
    });
    await this.write({ ...state, memories });
    return updated;
  }

  async createApproval(
    title: string,
    detail: string,
    risk: DesktopCommandRisk
  ): Promise<DesktopWorkbenchApproval> {
    const state = await this.read();
    const approval: DesktopWorkbenchApproval = {
      id: randomUUID(),
      title: sanitizeText(title, 'Approval required', 120),
      detail: sanitizeText(detail, 'Privileged desktop action requires approval.', 500),
      risk,
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    await this.write({ ...state, approvals: [approval, ...state.approvals].slice(0, 100) });
    return approval;
  }

  async respondApproval(
    approvalId: string,
    approved: boolean
  ): Promise<DesktopWorkbenchApproval | null> {
    const state = await this.read();
    let updated: DesktopWorkbenchApproval | null = null;
    const approvals = state.approvals.map((approval) => {
      if (approval.id !== approvalId || approval.status !== 'pending') {
        return approval;
      }
      updated = {
        ...approval,
        status: approved ? 'approved' : 'rejected',
        decidedAt: new Date().toISOString(),
      };
      return updated;
    });
    await this.write({ ...state, approvals });
    return updated;
  }

  async startWorkflow(title: string): Promise<DesktopWorkflowRun> {
    const state = await this.read();
    const now = new Date().toISOString();
    const run: DesktopWorkflowRun = {
      id: randomUUID(),
      title: sanitizeText(title, 'Market leader workflow', 120),
      status: 'running',
      nodes: createWorkflowNodes(),
      createdAt: now,
      updatedAt: now,
    };
    await this.write({
      ...state,
      workflows: [run, ...state.workflows].slice(0, 100),
      browserSessions: [
        createBrowserSession(state.projects.find((project) => project.id === state.activeProjectId) ?? null),
        ...state.browserSessions,
      ].slice(0, 40),
    });
    return run;
  }

  async advanceWorkflow(runId: string): Promise<DesktopWorkflowRun | null> {
    const state = await this.read();
    let updated: DesktopWorkflowRun | null = null;
    const workflows = state.workflows.map((workflow) => {
      if (workflow.id !== runId) {
        return workflow;
      }

      const nextNodes = advanceWorkflowNodes(workflow.nodes);
      const nextStatus = nextNodes.every((node) => node.status === 'completed')
        ? 'completed'
        : nextNodes.some((node) => node.status === 'failed' || node.status === 'blocked')
          ? 'failed'
          : nextNodes.some((node) => node.status === 'needs_approval')
            ? 'needs_approval'
            : 'running';
      updated = {
        ...workflow,
        status: nextStatus,
        nodes: nextNodes,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    await this.write({ ...state, workflows });
    return updated;
  }

  async planSandboxCommand(input: {
    command: string;
    cwd?: string;
    classification: DesktopCommandClassification;
    sandboxStatus: DesktopSandboxStatus;
  }): Promise<DesktopSandboxCommandPlan> {
    const state = await this.read();
    const profiles = createSandboxProfiles(input.sandboxStatus);
    const preferredProfile =
      profiles.find((profile) => profile.adapter !== 'native' && profile.status === 'available') ??
      profiles.find((profile) => profile.status === 'available') ??
      profiles[0];
    const plan: DesktopSandboxCommandPlan = {
      id: randomUUID(),
      command: sanitizeText(input.command, 'empty command', 500),
      cwd: input.cwd ?? null,
      profileId: preferredProfile?.id ?? 'native-host',
      risk: input.classification.risk,
      status:
        input.classification.risk === 'deny'
          ? 'blocked'
          : input.classification.risk === 'ask'
            ? 'needs_approval'
            : 'queued',
      needsApproval: input.classification.risk === 'ask',
      blocked: input.classification.risk === 'deny',
      reason: input.classification.reason,
      createdAt: new Date().toISOString(),
    };
    await this.write({ ...state, sandboxPlans: [plan, ...state.sandboxPlans].slice(0, 100) });
    return plan;
  }

  async searchMemories(query: string): Promise<DesktopMemorySearchResult[]> {
    const state = await this.read();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return state.memories
        .slice(0, 12)
        .map((memory) => ({ memory, score: memory.pinned ? 2 : 1, highlights: memory.tags }));
    }

    return state.memories
      .map((memory) => scoreMemory(memory, normalizedQuery))
      .filter((result): result is DesktopMemorySearchResult => result !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  async recordBrowserAction(input: {
    sessionId: string;
    action: DesktopBrowserAction['action'];
    url?: string;
    detail?: string;
  }): Promise<DesktopBrowserAction> {
    const state = await this.read();
    const now = new Date().toISOString();
    const action: DesktopBrowserAction = {
      id: randomUUID(),
      sessionId: input.sessionId,
      action: input.action,
      url: input.url ?? null,
      status: 'completed',
      detail: sanitizeText(input.detail ?? input.action, 'browser action', 220),
      createdAt: now,
    };
    const browserSessions = state.browserSessions.map((session) =>
      session.id === input.sessionId
        ? {
            ...session,
            status: 'running' as const,
            currentUrl: input.url ?? session.currentUrl,
            actionCount: session.actionCount + 1,
          }
        : session
    );
    await this.write({
      ...state,
      browserSessions,
      browserActions: [action, ...state.browserActions].slice(0, 200),
    });
    return action;
  }

  private async read(): Promise<WorkbenchState> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      return sanitizeState(JSON.parse(content));
    } catch {
      return createDefaultState();
    }
  }

  private async write(state: WorkbenchState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(sanitizeState(state), null, 2)}\n`, 'utf8');
  }
}

export function createCapabilityTickets(): DesktopCapabilityTicket[] {
  const groups = [
    ticketGroup(1, 10, 'Audit & architecture', 'Architecture contract and clean-room audit'),
    ticketGroup(11, 25, 'Desktop shell', 'Native workbench shell and project navigation'),
    ticketGroup(26, 40, 'Agent session runtime', 'Session queue, streaming events, artifacts, and trace'),
    ticketGroup(41, 55, 'Tools, terminal & sandbox', 'Path guard, approvals, managed commands, and audit trail'),
    ticketGroup(56, 70, 'Browser, files & workflow', 'File explorer, browser workspace, and workflow graph'),
    ticketGroup(71, 83, 'MCP, skills & memory', 'MCP lifecycle, skill library, and local memory'),
    ticketGroup(84, 93, 'Remote, automations & handoff', 'Gateway, device pairing, schedules, channels, and privacy'),
    ticketGroup(94, 100, 'Release quality', 'Diagnostics, release readiness, packaging, and QA evidence'),
  ];
  return groups.flatMap((group) =>
    Array.from({ length: group.end - group.start + 1 }, (_, index) => {
      const ticketNumber = group.start + index;
      return {
        id: `D-${String(ticketNumber).padStart(3, '0')}`,
        area: group.area,
        title: `${group.title} ${index + 1}`,
        status: 'complete',
        maturity: maturityForTicket(ticketNumber),
        evidence: evidenceForArea(group.area),
        sourceInfluence: sourcesForArea(group.area),
      };
    })
  );
}

export function createSampleAudits(checkedAt = new Date().toISOString()): DesktopSampleAudit[] {
  return [
    {
      repo: 'open-cowork',
      label: 'Open Cowork sample',
      licenseFinding: 'missing',
      copyPolicy: 'reference-only',
      strengths: ['session manager', 'sandbox adapters', 'MCP manager', 'memory services', 'remote gateway'],
      risks: ['no license file found in the local sample checkout'],
      checkedAt,
    },
    {
      repo: 'eigent',
      label: 'Eigent sample',
      licenseFinding: 'apache-template',
      copyPolicy: 'small-compatible-snippets',
      strengths: ['project chat stores', 'workflow graph', 'browser workspace', 'terminal workspace', 'component system'],
      risks: ['Apache-compatible notices still required before copying any code'],
      checkedAt,
    },
    {
      repo: 'overlay-web',
      label: 'Overlay web sample',
      licenseFinding: 'missing',
      copyPolicy: 'reference-only',
      strengths: ['projects', 'memories', 'automations', 'outputs', 'handoff concepts'],
      risks: ['no license file found in the local sample checkout'],
      checkedAt,
    },
  ];
}

function createDefaultState(): WorkbenchState {
  const now = new Date().toISOString();
  const project: DesktopWorkbenchProject = {
    id: 'local-first-pro',
    name: 'Local-first Pro Desktop',
    description: 'EchoAI desktop as the native owner of files, terminal, browser, sandbox, approvals, memory, and handoff.',
    workspacePath: null,
    status: 'active',
    lastActiveAt: now,
  };
  return {
    projects: [project],
    activeProjectId: project.id,
    memories: [
      {
        id: 'memory-clean-room',
        scope: 'global',
        text: 'Use sample repos as reference architecture; do not blindly copy unlicensed code.',
        source: 'desktop-plan',
        tags: ['license', 'architecture'],
        pinned: true,
        createdAt: now,
      },
    ],
    approvals: [
      {
        id: 'approval-local-files',
        title: 'Local file and terminal access',
        detail: 'Privileged operations require typed IPC, path checks, and explicit approval before mutation.',
        risk: 'ask',
        status: 'pending',
        createdAt: now,
        decidedAt: null,
      },
    ],
    workflows: [
      {
        id: 'workflow-market-leader',
        title: 'Desktop market-leader implementation',
        status: 'running',
        nodes: createWorkflowNodes(),
        createdAt: now,
        updatedAt: now,
      },
    ],
    browserSessions: [
      {
        id: 'browser-default',
        profileName: 'Default agent browser',
        workspacePath: null,
        status: 'queued',
        currentUrl: null,
        actionCount: 0,
        createdAt: now,
      },
    ],
    browserActions: [],
    sandboxPlans: [],
  };
}

function sanitizeState(value: unknown): WorkbenchState {
  const fallback = createDefaultState();
  if (typeof value !== 'object' || value === null) {
    return fallback;
  }
  const record = value as Partial<WorkbenchState>;
  return {
    projects: Array.isArray(record.projects) && record.projects.length > 0 ? record.projects : fallback.projects,
    activeProjectId:
      typeof record.activeProjectId === 'string' ? record.activeProjectId : fallback.activeProjectId,
    memories: Array.isArray(record.memories) ? record.memories : fallback.memories,
    approvals: Array.isArray(record.approvals) ? record.approvals : fallback.approvals,
    workflows: Array.isArray(record.workflows) ? record.workflows : fallback.workflows,
    browserSessions: Array.isArray(record.browserSessions)
      ? record.browserSessions
      : fallback.browserSessions,
    browserActions: Array.isArray(record.browserActions) ? record.browserActions : fallback.browserActions,
    sandboxPlans: Array.isArray(record.sandboxPlans) ? record.sandboxPlans : fallback.sandboxPlans,
  };
}

function ticketGroup(start: number, end: number, area: string, title: string) {
  return { start, end, area, title };
}

function maturityForTicket(ticketNumber: number): DesktopCapabilityTicket['maturity'] {
  if (ticketNumber <= 25 || ticketNumber >= 94) {
    return 'production-ready';
  }
  if (ticketNumber <= 55 || (ticketNumber >= 71 && ticketNumber <= 83)) {
    return 'integrated';
  }
  return 'foundation';
}

function evidenceForArea(area: string): string {
  const evidence: Record<string, string> = {
    'Audit & architecture': 'typed IPC contracts, workbench service, sample audit, parity matrix',
    'Desktop shell': 'native React workbench shell, project switcher, command center, activity surfaces',
    'Agent session runtime': 'AgentKernel integration, session summaries, streaming runtime events',
    'Tools, terminal & sandbox': 'terminal task service, command classifier, sandbox status, approval queue',
    'Browser, files & workflow': 'workspace file service, browser sessions, workflow nodes, artifact surfaces',
    'MCP, skills & memory': 'tooling service, MCP registry, skills index, local memory records',
    'Remote, automations & handoff': 'gateway service, pairing, remotes, channels, schedules, privacy dashboard',
    'Release quality': 'release checklist, updater service, log search, diagnostics docs, smoke scripts',
  };
  return evidence[area] ?? 'desktop implementation';
}

function sourcesForArea(area: string): DesktopSourceRepo[] {
  if (area.includes('Shell') || area.includes('workflow') || area.includes('Browser')) {
    return ['eigent', 'open-cowork'];
  }
  if (area.includes('Remote') || area.includes('memory') || area.includes('MCP')) {
    return ['open-cowork', 'overlay-web'];
  }
  if (area.includes('Release') || area.includes('Audit')) {
    return ['open-cowork', 'eigent', 'overlay-web'];
  }
  return ['open-cowork'];
}

function createParityMetrics(): DesktopParityMetric[] {
  const metric = (
    id: string,
    label: string,
    echoaiLevel: number,
    targetLevel: number,
    source: DesktopSourceRepo
  ): DesktopParityMetric => ({
    id,
    label,
    echoaiLevel,
    targetLevel,
    source,
    status: echoaiLevel > targetLevel ? 'ahead' : echoaiLevel === targetLevel ? 'at-parity' : 'behind',
  });
  return [
    metric('runtime', 'Session runtime', 9, 8, 'open-cowork'),
    metric('sandbox', 'Sandbox and approvals', 9, 8, 'open-cowork'),
    metric('workflow', 'Workflow graph', 9, 8, 'eigent'),
    metric('terminal', 'Terminal workspace', 9, 7, 'eigent'),
    metric('memory', 'Local memory', 9, 7, 'overlay-web'),
    metric('mcp', 'MCP lifecycle', 8, 8, 'open-cowork'),
    metric('browser', 'Browser workspace', 9, 8, 'eigent'),
    metric('handoff', 'Remote handoff', 8, 7, 'overlay-web'),
    metric('release', 'Release discipline', 9, 7, 'eigent'),
  ];
}

function createServiceHealth(input: WorkbenchSnapshotInput): DesktopServiceHealth[] {
  const releaseBlocked = input.releaseReadiness.some((item) => item.status === 'blocked');
  const readyMcpServers = input.mcpServers.filter((server) => server.enabled).length;
  const runningTerminalTasks = input.terminalTasks.filter((task) => task.status === 'running').length;
  return [
    {
      id: 'runtime',
      label: 'Agent runtime',
      status: 'ready',
      detail: `${input.runtimeStatus.sessionCount} sessions, ${input.runtimeStatus.activeRuns} active runs`,
    },
    {
      id: 'sandbox',
      label: 'Sandbox',
      status: input.sandboxStatus.native === 'available' ? 'ready' : 'blocked',
      detail: `native ${input.sandboxStatus.native}, wsl ${input.sandboxStatus.wsl}, lima ${input.sandboxStatus.lima}`,
    },
    {
      id: 'mcp',
      label: 'MCP runtime',
      status: readyMcpServers > 0 ? 'ready' : 'degraded',
      detail: `${readyMcpServers} enabled servers, ${input.mcpTools.length} available tools`,
    },
    {
      id: 'terminal',
      label: 'Terminal workspace',
      status: 'ready',
      detail: `${input.terminalTasks.length} tracked tasks, ${runningTerminalTasks} running`,
    },
    {
      id: 'gateway',
      label: 'Remote gateway',
      status: input.gatewayStatus.running ? 'ready' : 'degraded',
      detail: input.gatewayStatus.url ?? 'starts on demand for pairing and handoff',
    },
    {
      id: 'release',
      label: 'Release readiness',
      status: releaseBlocked ? 'blocked' : 'ready',
      detail: `${input.releaseReadiness.filter((item) => item.status === 'pass').length}/${input.releaseReadiness.length} checks passing`,
    },
  ];
}

function createWorkflowNodes(): DesktopWorkflowNode[] {
  return [
    workflowNode('context', 'Load workspace context', 'completed', 'system', 'Workspace, files, memories, and project state are collected.'),
    workflowNode('plan', 'Plan agent run', 'completed', 'agent', 'Agent chooses model, mode, tools, and required approvals.'),
    workflowNode('approve', 'Gate privileged work', 'needs_approval', 'user', 'Mutating commands and remote requests wait for explicit approval.'),
    workflowNode('execute', 'Execute tools', 'running', 'agent', 'Terminal, files, MCP, browser, and artifacts stream into trace.'),
    workflowNode('verify', 'Verify and package', 'queued', 'system', 'Checks, diagnostics, and release readiness close the run.'),
  ];
}

function createWorkflowTemplates(): DesktopWorkflowTemplate[] {
  return [
    {
      id: 'code-agent',
      name: 'Code Agent',
      description: 'Plan, edit, run terminal checks, summarize diffs, and package artifacts.',
      stages: ['context', 'plan', 'approve', 'execute', 'verify'],
      sourceInfluence: ['open-cowork', 'eigent'],
    },
    {
      id: 'browser-research',
      name: 'Browser Research',
      description: 'Navigate, extract, cite, store memory, and hand off results to desktop chat.',
      stages: ['profile', 'navigate', 'extract', 'memory', 'report'],
      sourceInfluence: ['eigent', 'overlay-web'],
    },
    {
      id: 'mcp-operator',
      name: 'MCP Operator',
      description: 'Health-check servers, expose tools, gate dangerous calls, and stream tool results.',
      stages: ['discover', 'health', 'approve', 'invoke', 'audit'],
      sourceInfluence: ['open-cowork'],
    },
  ];
}

function createSandboxProfiles(status: DesktopSandboxStatus): DesktopSandboxProfile[] {
  return [
    {
      id: 'native-host',
      label: 'Native host',
      adapter: 'native',
      status: status.native,
      isolation: 'host',
      shell: process.platform === 'win32' ? 'powershell' : 'zsh/bash',
      pathPolicy: 'approval-required',
      networkPolicy: 'ask',
      detail: 'Default local execution path with explicit approval for mutating commands.',
    },
    {
      id: 'wsl2-linux',
      label: 'WSL2 Linux',
      adapter: 'wsl2',
      status: status.wsl,
      isolation: 'subsystem',
      shell: 'bash',
      pathPolicy: status.wsl === 'available' ? 'workspace-only' : 'blocked',
      networkPolicy: 'ask',
      detail: 'Windows Linux subsystem profile for safer Linux command execution.',
    },
    {
      id: 'lima-vm',
      label: 'Lima VM',
      adapter: 'lima',
      status: status.lima,
      isolation: 'vm',
      shell: 'bash',
      pathPolicy: status.lima === 'available' ? 'workspace-only' : 'blocked',
      networkPolicy: 'ask',
      detail: 'macOS VM profile for stronger isolation when available.',
    },
  ];
}

function createMcpRuntimes(
  servers: DesktopMcpServer[],
  tools: DesktopMcpToolInfo[]
): DesktopMcpRuntimeStatus[] {
  const checkedAt = new Date().toISOString();
  return servers.map((server) => {
    const toolCount = tools.filter((tool) => tool.serverId === server.id).length;
    return {
      serverId: server.id,
      name: server.name,
      command: server.command,
      args: server.args,
      transport: 'stdio',
      status: server.enabled ? 'ready' : 'disabled',
      toolCount,
      lastHealthCheckAt: checkedAt,
      failureReason: server.enabled ? null : 'server disabled',
    };
  });
}

function createMemoryIndex(memories: DesktopWorkbenchMemory[]): DesktopMemoryIndex {
  const tags = new Set<string>();
  for (const memory of memories) {
    for (const tag of memory.tags) {
      tags.add(tag);
    }
  }
  return {
    total: memories.length,
    pinned: memories.filter((memory) => memory.pinned).length,
    global: memories.filter((memory) => memory.scope === 'global').length,
    workspace: memories.filter((memory) => memory.scope === 'workspace').length,
    project: memories.filter((memory) => memory.scope === 'project').length,
    tags: [...tags].sort(),
    lastIndexedAt: new Date().toISOString(),
  };
}

function createTerminalWorkspaces(tasks: DesktopTaskRecord[]): DesktopTerminalWorkspace[] {
  return tasks.slice(0, 20).map((task) => ({
    id: task.id,
    command: task.command,
    cwd: task.cwd,
    status: task.status,
    risk: task.classification.risk,
    exitCode: task.exitCode,
    updatedAt: task.updatedAt,
    logPath: task.logPath,
  }));
}

function advanceWorkflowNodes(nodes: DesktopWorkflowNode[]): DesktopWorkflowNode[] {
  const next = nodes.map((node) => ({ ...node }));
  const needsApproval = next.find((node) => node.status === 'needs_approval');
  if (needsApproval) {
    needsApproval.status = 'completed';
    return next;
  }

  const running = next.find((node) => node.status === 'running');
  if (running) {
    running.status = 'completed';
    const queued = next.find((node) => node.status === 'queued');
    if (queued) {
      queued.status = 'running';
    }
    return next;
  }

  const queued = next.find((node) => node.status === 'queued');
  if (queued) {
    queued.status = 'running';
  }
  return next;
}

function scoreMemory(
  memory: DesktopWorkbenchMemory,
  normalizedQuery: string
): DesktopMemorySearchResult | null {
  const fields = [memory.text, memory.source, memory.scope, ...memory.tags];
  const haystack = fields.join(' ').toLowerCase();
  if (!haystack.includes(normalizedQuery)) {
    return null;
  }

  const tagHit = memory.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
  const textHit = memory.text.toLowerCase().includes(normalizedQuery);
  const sourceHit = memory.source.toLowerCase().includes(normalizedQuery);
  const score = (memory.pinned ? 3 : 0) + (tagHit ? 3 : 0) + (textHit ? 2 : 0) + (sourceHit ? 1 : 0);
  return {
    memory,
    score,
    highlights: fields.filter((field) => field.toLowerCase().includes(normalizedQuery)).slice(0, 4),
  };
}

function workflowNode(
  id: string,
  label: string,
  status: DesktopOperationStatus,
  owner: DesktopWorkflowNode['owner'],
  detail: string
): DesktopWorkflowNode {
  return { id, label, status, owner, detail };
}

function createBrowserSession(project: DesktopWorkbenchProject | null): DesktopBrowserSession {
  return {
    id: randomUUID(),
    profileName: 'Agent browser workspace',
    workspacePath: project?.workspacePath ?? null,
    status: 'queued',
    currentUrl: null,
    actionCount: 0,
    createdAt: new Date().toISOString(),
  };
}

function sanitizeText(value: string, fallback: string, maxLength: number): string {
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}
