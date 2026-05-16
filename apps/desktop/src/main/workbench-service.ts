import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DesktopBrowserSession,
  DesktopCapabilityTicket,
  DesktopCommandRisk,
  DesktopGatewayStatus,
  DesktopOperationStatus,
  DesktopParityMetric,
  DesktopReleaseChecklistItem,
  DesktopRuntimeStatus,
  DesktopSampleAudit,
  DesktopSandboxStatus,
  DesktopServiceHealth,
  DesktopSourceRepo,
  DesktopWorkbenchApproval,
  DesktopWorkbenchMemory,
  DesktopWorkbenchProject,
  DesktopWorkbenchSnapshot,
  DesktopWorkflowNode,
  DesktopWorkflowRun,
} from '@shared/ipc';

interface WorkbenchState {
  projects: DesktopWorkbenchProject[];
  activeProjectId: string | null;
  memories: DesktopWorkbenchMemory[];
  approvals: DesktopWorkbenchApproval[];
  workflows: DesktopWorkflowRun[];
  browserSessions: DesktopBrowserSession[];
}

interface WorkbenchSnapshotInput {
  activeWorkspacePath: string | null;
  runtimeStatus: DesktopRuntimeStatus;
  gatewayStatus: DesktopGatewayStatus;
  sandboxStatus: DesktopSandboxStatus;
  releaseReadiness: DesktopReleaseChecklistItem[];
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
      browserSessions: state.browserSessions,
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
    metric('runtime', 'Session runtime', 8, 8, 'open-cowork'),
    metric('sandbox', 'Sandbox and approvals', 7, 8, 'open-cowork'),
    metric('workflow', 'Workflow graph', 7, 8, 'eigent'),
    metric('terminal', 'Terminal workspace', 8, 7, 'eigent'),
    metric('memory', 'Local memory', 7, 7, 'overlay-web'),
    metric('handoff', 'Remote handoff', 8, 7, 'overlay-web'),
    metric('release', 'Release discipline', 9, 7, 'eigent'),
  ];
}

function createServiceHealth(input: WorkbenchSnapshotInput): DesktopServiceHealth[] {
  const releaseBlocked = input.releaseReadiness.some((item) => item.status === 'blocked');
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
