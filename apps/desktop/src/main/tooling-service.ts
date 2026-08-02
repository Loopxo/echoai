import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DesktopBrowserAutomationStatus,
  DesktopBrowserProfile,
  DesktopCanvasEntry,
  DesktopComputerUseAudit,
  DesktopGuiPermissionStatus,
  DesktopMcpRuntimeStatus,
  DesktopMcpServer,
  DesktopMcpToolInfo,
  DesktopSkillEntry,
  DesktopToolSummary,
} from '@shared/ipc';
import { getSharedMcpRuntime, type McpRuntime, type McpServerConfig } from './mcp-runtime';

interface ToolingState {
  mcpServers: DesktopMcpServer[];
  browserProfiles: DesktopBrowserProfile[];
  computerAudits: DesktopComputerUseAudit[];
  canvasEntries: DesktopCanvasEntry[];
}

export class DesktopToolingService {
  private readonly stateFile: string;
  private readonly mcpRuntime: McpRuntime;

  constructor(
    private readonly dataDir: string,
    private readonly skillsDir: string,
    private readonly cacheDir: string,
    mcpRuntime: McpRuntime = getSharedMcpRuntime()
  ) {
    this.stateFile = join(dataDir, 'tooling-state.json');
    this.mcpRuntime = mcpRuntime;
  }

  async listMcpServers(): Promise<DesktopMcpServer[]> {
    return (await this.read()).mcpServers;
  }

  async addMcpServer(input: Omit<DesktopMcpServer, 'id' | 'createdAt'>): Promise<DesktopMcpServer> {
    const state = await this.read();
    const server: DesktopMcpServer = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
      args: input.args ?? [],
    };
    await this.write({ ...state, mcpServers: [server, ...state.mcpServers] });
    await this.syncMcpRuntime();
    return server;
  }

  async removeMcpServer(serverId: string): Promise<boolean> {
    const state = await this.read();
    const next = state.mcpServers.filter((server) => server.id !== serverId);
    await this.write({ ...state, mcpServers: next });
    await this.syncMcpRuntime();
    return next.length !== state.mcpServers.length;
  }

  async testMcpServer(serverId: string): Promise<boolean> {
    const state = await this.read();
    const server = state.mcpServers.find((entry) => entry.id === serverId);
    if (!server || !server.enabled) {
      return false;
    }
    return this.mcpRuntime.ensureServer(toMcpServerConfig(server));
  }

  async listMcpTools(): Promise<DesktopMcpToolInfo[]> {
    await this.syncMcpRuntime();
    return this.mcpRuntime.listTools().map((tool) => ({
      serverId: tool.serverId,
      name: tool.kernelToolName,
      description: tool.description,
      schema: tool.inputSchema,
    }));
  }

  async listMcpRuntimeStatus(): Promise<DesktopMcpRuntimeStatus[]> {
    await this.syncMcpRuntime();
    return this.mcpRuntime.listRuntimeStatus();
  }

  /** Starts enabled servers and stops the rest so the harness sees live tools. */
  async syncMcpRuntime(): Promise<void> {
    const servers = await this.listMcpServers();
    await this.mcpRuntime.sync(servers.map(toMcpServerConfig));
  }

  async stopMcpRuntime(): Promise<void> {
    await this.mcpRuntime.stop();
  }

  async listSkills(): Promise<DesktopSkillEntry[]> {
    await mkdir(this.skillsDir, { recursive: true });
    const defaultSkills: DesktopSkillEntry[] = [
      createBuiltInSkill('coding', 'Coding workflows'),
      createBuiltInSkill('docs', 'Document generation'),
      createBuiltInSkill('spreadsheet', 'Spreadsheet analysis'),
      createBuiltInSkill('presentation', 'Presentation generation'),
      createBuiltInSkill('browser', 'Browser automation'),
      createBuiltInSkill('image', 'Image generation'),
    ];
    const state = await this.readSkillIndex();
    return [...defaultSkills, ...state];
  }

  async createSkill(name: string, description: string): Promise<DesktopSkillEntry> {
    await mkdir(this.skillsDir, { recursive: true });
    const skill: DesktopSkillEntry = {
      id: slugify(name),
      name,
      description,
      path: join(this.skillsDir, slugify(name), 'SKILL.md'),
      updatedAt: new Date().toISOString(),
    };
    await mkdir(join(this.skillsDir, skill.id), { recursive: true });
    await writeFile(skill.path, `# ${name}\n\n${description}\n`, 'utf8');
    const skills = [...(await this.readSkillIndex()).filter((item) => item.id !== skill.id), skill];
    await this.writeSkillIndex(skills);
    return skill;
  }

  async deleteSkill(skillId: string): Promise<boolean> {
    const skills = await this.readSkillIndex();
    const skill = skills.find((item) => item.id === skillId);
    if (!skill) {
      return false;
    }
    await rm(join(this.skillsDir, skill.id), { recursive: true, force: true });
    await this.writeSkillIndex(skills.filter((item) => item.id !== skillId));
    return true;
  }

  async listBrowserProfiles(): Promise<DesktopBrowserProfile[]> {
    return (await this.read()).browserProfiles;
  }

  async createBrowserProfile(name: string, workspacePath?: string): Promise<DesktopBrowserProfile> {
    const state = await this.read();
    const profile: DesktopBrowserProfile = {
      id: randomUUID(),
      name,
      workspacePath: workspacePath ?? null,
      createdAt: new Date().toISOString(),
    };
    await mkdir(join(this.cacheDir, 'browser-profiles', profile.id), { recursive: true });
    await this.write({ ...state, browserProfiles: [profile, ...state.browserProfiles] });
    return profile;
  }

  async getBrowserAutomationStatus(): Promise<DesktopBrowserAutomationStatus> {
    const profiles = await this.listBrowserProfiles();
    return {
      installed: true,
      activeProfileId: profiles[0]?.id ?? null,
      message: profiles.length > 0 ? 'Profile ready' : 'Create a profile before browser automation.',
    };
  }

  getGuiPermissionStatus(): DesktopGuiPermissionStatus {
    return {
      screenRecording: process.platform === 'darwin' ? 'unknown' : 'granted',
      accessibility: process.platform === 'darwin' ? 'unknown' : 'granted',
    };
  }

  async requestComputerAction(action: string): Promise<DesktopComputerUseAudit> {
    const state = await this.read();
    const audit: DesktopComputerUseAudit = {
      id: randomUUID(),
      action,
      status: 'requires-permission',
      createdAt: new Date().toISOString(),
    };
    await this.write({ ...state, computerAudits: [audit, ...state.computerAudits].slice(0, 100) });
    return audit;
  }

  async listCanvasEntries(): Promise<DesktopCanvasEntry[]> {
    return (await this.read()).canvasEntries;
  }

  async openCanvasEntry(title: string): Promise<DesktopCanvasEntry> {
    const state = await this.read();
    const entry: DesktopCanvasEntry = {
      id: randomUUID(),
      title,
      path: join(this.cacheDir, 'canvas', `${slugify(title)}.json`),
      createdAt: new Date().toISOString(),
    };
    await mkdir(join(this.cacheDir, 'canvas'), { recursive: true });
    await writeFile(entry.path, JSON.stringify({ title, createdAt: entry.createdAt }, null, 2), 'utf8');
    await this.write({ ...state, canvasEntries: [entry, ...state.canvasEntries] });
    return entry;
  }

  summarizeToolOutput(output: string): DesktopToolSummary {
    const lines = output.split(/\r?\n/);
    const preview = lines.slice(0, 12).join('\n').slice(0, 1600);
    return {
      lineCount: lines.length,
      charCount: output.length,
      preview,
      truncated: output.length > preview.length,
    };
  }

  private async read(): Promise<ToolingState> {
    try {
      const content = await readFile(this.stateFile, 'utf8');
      return sanitizeState(JSON.parse(content));
    } catch {
      return { mcpServers: [], browserProfiles: [], computerAudits: [], canvasEntries: [] };
    }
  }

  private async write(state: ToolingState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private async readSkillIndex(): Promise<DesktopSkillEntry[]> {
    try {
      const content = await readFile(join(this.skillsDir, 'skills.json'), 'utf8');
      return Array.isArray(JSON.parse(content)) ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  }

  private async writeSkillIndex(skills: DesktopSkillEntry[]): Promise<void> {
    await mkdir(this.skillsDir, { recursive: true });
    await writeFile(join(this.skillsDir, 'skills.json'), `${JSON.stringify(skills, null, 2)}\n`, 'utf8');
  }
}

function toMcpServerConfig(server: DesktopMcpServer): McpServerConfig {
  return {
    id: server.id,
    name: server.name,
    command: server.command,
    args: server.args ?? [],
    enabled: server.enabled,
    // `DesktopMcpServer` has no `env` field yet, but persisted records may already
    // carry one; forward it so per-server credentials keep working when the
    // settings surface catches up.
    env: readServerEnv(server),
  };
}

function readServerEnv(server: DesktopMcpServer): Record<string, string> | undefined {
  const candidate = (server as { env?: unknown }).env;
  if (typeof candidate !== 'object' || candidate === null) {
    return undefined;
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

function createBuiltInSkill(id: string, description: string): DesktopSkillEntry {
  return {
    id,
    name: id,
    description,
    path: `builtin:${id}`,
    updatedAt: 'builtin',
  };
}

function sanitizeState(value: unknown): ToolingState {
  if (typeof value !== 'object' || value === null) {
    return { mcpServers: [], browserProfiles: [], computerAudits: [], canvasEntries: [] };
  }
  const record = value as Partial<ToolingState>;
  return {
    mcpServers: Array.isArray(record.mcpServers) ? record.mcpServers : [],
    browserProfiles: Array.isArray(record.browserProfiles) ? record.browserProfiles : [],
    computerAudits: Array.isArray(record.computerAudits) ? record.computerAudits : [],
    canvasEntries: Array.isArray(record.canvasEntries) ? record.canvasEntries : [],
  };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill';
}
