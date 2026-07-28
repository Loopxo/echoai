import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DesktopWorkbenchService,
  createCapabilityTickets,
  createSampleAudits,
} from './workbench-service';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('DesktopWorkbenchService', () => {
  it('tracks all D-001 through D-100 capability tickets', () => {
    const tickets = createCapabilityTickets();
    expect(tickets).toHaveLength(100);
    expect(tickets[0]?.id).toBe('D-001');
    expect(tickets[99]?.id).toBe('D-100');
    expect(tickets.every((ticket) => ticket.status === 'complete')).toBe(true);
  });

  it('keeps clean-room audit posture explicit for local samples', () => {
    const audits = createSampleAudits('2026-05-16T00:00:00.000Z');
    expect(audits.find((audit) => audit.repo === 'open-cowork')?.copyPolicy).toBe('reference-only');
    expect(audits.find((audit) => audit.repo === 'overlay-web')?.copyPolicy).toBe('reference-only');
    expect(audits.find((audit) => audit.repo === 'eigent')?.copyPolicy).toBe('small-compatible-snippets');
  });

  it('persists projects, memory, approvals, and workflow runs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'echoai-workbench-'));
    tempDirs.push(dir);
    const service = new DesktopWorkbenchService(dir);

    const project = await service.createProject('Desktop Pro', 'Native desktop target', '/workspace');
    const memory = await service.addMemory({
      scope: 'workspace',
      text: 'Keep terminal actions behind approvals.',
      source: 'test',
      tags: ['terminal'],
    });
    const approval = await service.createApproval('Run pnpm', 'Workspace command', 'ask');
    const workflow = await service.startWorkflow('Verify desktop');
    await service.respondApproval(approval.id, true);
    await service.pinMemory(memory.id, true);

    const snapshot = await service.getSnapshot(createSnapshotInput());

    expect(snapshot.projects[0]?.id).toBe(project.id);
    expect(snapshot.memories.find((item) => item.id === memory.id)?.pinned).toBe(true);
    expect(snapshot.approvals.find((item) => item.id === approval.id)?.status).toBe('approved');
    expect(snapshot.workflows[0]?.id).toBe(workflow.id);
    expect(snapshot.browserSessions.length).toBeGreaterThan(0);
  });

  it('adds sandbox plans, memory search, workflow progression, browser logs, and MCP status', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'echoai-workbench-'));
    tempDirs.push(dir);
    const service = new DesktopWorkbenchService(dir);

    const memory = await service.addMemory({
      scope: 'workspace',
      text: 'MCP calls and terminal writes need explicit approval.',
      source: 'runtime-policy',
      tags: ['mcp', 'terminal'],
    });
    await service.pinMemory(memory.id, true);
    const plan = await service.planSandboxCommand({
      command: 'rm -rf /',
      cwd: '/workspace',
      classification: { risk: 'deny', reason: 'Destructive system command' },
      sandboxStatus: {
        native: 'available',
        wsl: 'unsupported',
        lima: 'unsupported',
        platform: process.platform,
      },
    });
    const workflow = await service.startWorkflow('Run browser and terminal checks');
    const advanced = await service.advanceWorkflow(workflow.id);
    const browserAction = await service.recordBrowserAction({
      sessionId: 'browser-default',
      action: 'navigate',
      url: 'https://echoai.local',
      detail: 'Open desktop docs',
    });
    const memoryResults = await service.searchMemories('mcp');
    const snapshot = await service.getSnapshot(createSnapshotInput());

    expect(plan.status).toBe('blocked');
    expect(advanced?.nodes.some((node) => node.status === 'completed')).toBe(true);
    expect(browserAction.status).toBe('completed');
    expect(memoryResults[0]?.memory.id).toBe(memory.id);
    expect(snapshot.mcpRuntimes[0]?.status).toBe('ready');
    expect(snapshot.terminalWorkspaces[0]?.command).toBe('pnpm test');
    expect(snapshot.memoryIndex.pinned).toBeGreaterThan(0);
    expect(snapshot.sandboxPlans[0]?.id).toBe(plan.id);
  });
});

function createSnapshotInput(): Parameters<DesktopWorkbenchService['getSnapshot']>[0] {
  return {
    activeWorkspacePath: '/workspace',
    runtimeStatus: {
      activeRuns: 0,
      sessionCount: 1,
      provider: 'ollama',
      model: 'llama3.2',
      providers: [
        {
          id: 'ollama',
          label: 'Ollama (local)',
          defaultModel: 'llama3.2',
          source: 'local',
        },
      ],
    },
    gatewayStatus: {
      running: false,
      host: '127.0.0.1',
      port: null,
      url: null,
      startedAt: null,
      protocolVersion: '2026-05',
      pairedDeviceCount: 0,
      pendingPairingCount: 0,
      remoteHandoffCount: 0,
      scheduledTaskCount: 0,
      telemetryEnabled: false,
    },
    sandboxStatus: {
      native: 'available',
      wsl: 'unsupported',
      lima: 'unsupported',
      platform: process.platform,
    },
    releaseReadiness: [],
    mcpServers: [
      {
        id: 'mcp-local',
        name: 'local',
        command: 'echoai',
        args: ['mcp'],
        enabled: true,
        createdAt: '2026-05-16T00:00:00.000Z',
      },
    ],
    mcpTools: [
      {
        serverId: 'mcp-local',
        name: 'local.status',
        description: 'Status',
        schema: {},
      },
    ],
    terminalTasks: [
      {
        id: 'task-1',
        command: 'pnpm test',
        cwd: '/workspace',
        status: 'completed',
        classification: { risk: 'safe', reason: 'Read/build command' },
        exitCode: 0,
        startedAt: '2026-05-16T00:00:00.000Z',
        updatedAt: '2026-05-16T00:00:01.000Z',
        logPath: '/tmp/task-1.log',
      },
    ],
  };
}
