import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AIProvider } from '../../types/index.js';
import type { AgentKernel } from '@echoai/runtime';
import { ConfigManager } from '../../config/manager.js';
import { ProviderManager } from '../../core/provider-manager.js';
import { createCliKernel } from '../../runtime/cli-kernel.js';

/**
 * Real multi-agent orchestration.
 *
 * This is the genuine planner -> parallel workers -> merger loop, built on top
 * of the AgentKernel's `runSubagent` + git-worktree-style isolation primitives.
 * It is distinct from the persona-routing layer (see PersonaRouter), which only
 * selects a single agent persona.
 *
 * Flow:
 *   1. Planner decomposes the task into a dependency-aware DAG of subtasks.
 *   2. Subtasks are executed layer by layer (topological order). Independent
 *      subtasks within a layer run concurrently, each in an isolated workspace
 *      copy so parallel writers never corrupt each other.
 *   3. After each layer, the merger applies every worker's file changes back to
 *      the primary workspace, detecting conflicts. Later layers therefore fork
 *      from the already-integrated state.
 *   4. An optional verification command (build/test) runs at the end.
 */

export interface OrchestratorSubtask {
  id: string;
  title: string;
  /** Persona/role hint, e.g. "backend", "frontend", "tests", "docs". */
  role: string;
  /** The instruction handed to the worker subagent. */
  prompt: string;
  /** IDs of subtasks that must complete before this one starts. */
  dependsOn: string[];
}

export interface OrchestratorSubtaskResult {
  subtask: OrchestratorSubtask;
  status: 'completed' | 'failed';
  summary: string;
  changedFiles: string[];
  conflicts: string[];
  turns: number;
  toolCalls: number;
  error?: string;
}

export type OrchestratorEvent =
  | { type: 'plan.created'; subtasks: OrchestratorSubtask[] }
  | { type: 'layer.started'; layer: number; subtaskIds: string[] }
  | { type: 'subtask.started'; subtaskId: string; title: string; role: string }
  | { type: 'subtask.completed'; result: OrchestratorSubtaskResult }
  | { type: 'subtask.failed'; subtaskId: string; error: string }
  | { type: 'merge.applied'; subtaskId: string; changedFiles: string[]; conflicts: string[] }
  | { type: 'verify.started'; command: string }
  | { type: 'verify.completed'; success: boolean; output: string }
  | { type: 'run.completed'; result: OrchestratorRunResult };

export interface OrchestratorRunResult {
  task: string;
  subtasks: OrchestratorSubtaskResult[];
  changedFiles: string[];
  conflicts: string[];
  verification?: { command: string; success: boolean; output: string };
  succeeded: boolean;
}

export interface MultiAgentOrchestratorOptions {
  /** Provider name to use for planning and workers. Defaults to config default. */
  provider?: string;
  /** Model id override. */
  model?: string;
  /** Max concurrent workers within a layer. Default 3. */
  concurrency?: number;
  /** Max turns per worker subagent. Default 12. */
  maxTurnsPerWorker?: number;
  /** Isolate each worker in its own workspace copy. Default true. */
  isolateWorkers?: boolean;
  /** Optional verification command run after merge, e.g. "pnpm test". */
  verifyCommand?: string;
  /** Progress event callback. */
  onEvent?: (event: OrchestratorEvent) => void;
}

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.css',
  '.scss', '.html', '.yml', '.yaml', '.toml', '.py', '.go', '.rs', '.java',
  '.kt', '.swift', '.rb', '.php', '.sh', '.sql', '.env', '.gradle', '.xml',
]);

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.echoai']);

export class MultiAgentOrchestrator {
  private readonly options: Required<Omit<MultiAgentOrchestratorOptions, 'provider' | 'model' | 'verifyCommand' | 'onEvent'>> &
    Pick<MultiAgentOrchestratorOptions, 'provider' | 'model' | 'verifyCommand' | 'onEvent'>;

  constructor(options: MultiAgentOrchestratorOptions = {}) {
    this.options = {
      concurrency: options.concurrency ?? 3,
      maxTurnsPerWorker: options.maxTurnsPerWorker ?? 12,
      isolateWorkers: options.isolateWorkers ?? true,
      provider: options.provider,
      model: options.model,
      verifyCommand: options.verifyCommand,
      onEvent: options.onEvent,
    };
  }

  private emit(event: OrchestratorEvent): void {
    this.options.onEvent?.(event);
  }

  async run(task: string, workspacePath: string): Promise<OrchestratorRunResult> {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    const config = await configManager.getConfig();

    const providerName = this.options.provider || config.defaults.provider || 'deepseek';
    const provider = await providerManager.getProvider(providerName);
    const model = this.options.model || provider.models[0] || 'code';

    const subtasks = await this.planTask(provider, task, model);
    this.emit({ type: 'plan.created', subtasks });

    const kernel = createCliKernel({
      provider,
      model,
      temperature: 0.2,
      stream: false,
      stateNamespace: 'orchestrator',
      runtimeMode: 'default',
    });

    const root = await kernel.createSession('Orchestrator', providerName, model);
    // Anchor the root session to the primary workspace so subagent forks copy it.
    root.metadata.workspaceRoot = workspacePath;
    root.metadata.workingDirectory = workspacePath;

    const results: OrchestratorSubtaskResult[] = [];
    const allChanged = new Set<string>();
    const allConflicts = new Set<string>();
    const completed = new Set<string>();

    const layers = topologicalLayers(subtasks);
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layerGroup = layers[layerIndex];
      if (!layerGroup) continue;
      const layer = layerGroup.filter((s) => s.dependsOn.every((d) => completed.has(d)));
      if (layer.length === 0) continue;
      this.emit({ type: 'layer.started', layer: layerIndex, subtaskIds: layer.map((s) => s.id) });

      const layerResults = await this.runLayer(kernel, root.id, layer, workspacePath);

      // Merge sequentially so conflict detection is deterministic and later
      // layers fork from the integrated workspace.
      for (const result of layerResults) {
        results.push(result);
        if (result.status === 'completed') {
          completed.add(result.subtask.id);
          for (const f of result.changedFiles) allChanged.add(f);
          for (const c of result.conflicts) allConflicts.add(c);
          this.emit({
            type: 'merge.applied',
            subtaskId: result.subtask.id,
            changedFiles: result.changedFiles,
            conflicts: result.conflicts,
          });
        }
      }
    }

    let verification: OrchestratorRunResult['verification'];
    if (this.options.verifyCommand) {
      this.emit({ type: 'verify.started', command: this.options.verifyCommand });
      verification = await this.verify(this.options.verifyCommand, workspacePath);
      this.emit({ type: 'verify.completed', success: verification.success, output: verification.output });
    }

    const succeeded =
      results.every((r) => r.status === 'completed') &&
      allConflicts.size === 0 &&
      (!verification || verification.success);

    const result: OrchestratorRunResult = {
      task,
      subtasks: results,
      changedFiles: [...allChanged],
      conflicts: [...allConflicts],
      verification,
      succeeded,
    };
    this.emit({ type: 'run.completed', result });
    return result;
  }

  /** Run all subtasks in a layer concurrently (bounded), each isolated. */
  private async runLayer(
    kernel: AgentKernel,
    rootSessionId: string,
    layer: OrchestratorSubtask[],
    workspacePath: string
  ): Promise<OrchestratorSubtaskResult[]> {
    const queue = [...layer];
    const results: OrchestratorSubtaskResult[] = [];
    const workers: Promise<void>[] = [];

    const runNext = async (): Promise<void> => {
      const subtask = queue.shift();
      if (!subtask) return;
      results.push(await this.runWorker(kernel, rootSessionId, subtask, workspacePath));
      await runNext();
    };

    const lanes = Math.max(1, Math.min(this.options.concurrency, layer.length));
    for (let i = 0; i < lanes; i++) workers.push(runNext());
    await Promise.all(workers);
    return results;
  }

  private async runWorker(
    kernel: AgentKernel,
    rootSessionId: string,
    subtask: OrchestratorSubtask,
    workspacePath: string
  ): Promise<OrchestratorSubtaskResult> {
    this.emit({ type: 'subtask.started', subtaskId: subtask.id, title: subtask.title, role: subtask.role });

    const baseline = await snapshotWorkspace(workspacePath);

    try {
      const runResult = await kernel.runSubagent(
        rootSessionId,
        {
          input: buildWorkerPrompt(subtask),
          maxTurns: this.options.maxTurnsPerWorker,
          mode: 'default',
          stream: false,
        },
        { worktree: { enabled: this.options.isolateWorkers } }
      );

      const worktreePath =
        runResult.session.worktree?.path ??
        (typeof runResult.session.metadata.workspaceRoot === 'string'
          ? runResult.session.metadata.workspaceRoot
          : workspacePath);

      // Merge the worker's changes back into the primary workspace.
      const { changedFiles, conflicts } = this.options.isolateWorkers && worktreePath !== workspacePath
        ? await mergeWorkspace(baseline, worktreePath, workspacePath)
        : await diffAgainstBaseline(baseline, workspacePath);

      const result: OrchestratorSubtaskResult = {
        subtask,
        status: 'completed',
        summary: runResult.response.slice(0, 2000),
        changedFiles,
        conflicts,
        turns: runResult.turns,
        toolCalls: runResult.toolCalls,
      };
      this.emit({ type: 'subtask.completed', result });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'subtask.failed', subtaskId: subtask.id, error: message });
      return {
        subtask,
        status: 'failed',
        summary: '',
        changedFiles: [],
        conflicts: [],
        turns: 0,
        toolCalls: 0,
        error: message,
      };
    }
  }

  /** Decompose the task into a dependency-aware subtask DAG via the model. */
  private async planTask(provider: AIProvider, task: string, model: string): Promise<OrchestratorSubtask[]> {
    const prompt = `You are a senior engineering lead breaking a software task into parallelizable subtasks for a team of autonomous coding agents.

Task: ${task}

Return ONLY a JSON array (no prose, no markdown fences) of subtasks. Each subtask:
{
  "id": "kebab-case-id",
  "title": "short title",
  "role": "backend | frontend | tests | docs | infra | refactor",
  "prompt": "a precise, self-contained instruction for one coding agent",
  "dependsOn": ["ids of subtasks that must finish first"]
}

Rules:
- Maximize parallelism: only add dependsOn when a real ordering constraint exists.
- Keep each subtask scoped so an agent can complete it in a few turns.
- 1 to 8 subtasks. If the task is trivial, return a single subtask.`;

    try {
      const raw = await provider.complete(prompt, { model, temperature: 0.1, maxTokens: 2000 });
      const parsed = parsePlan(raw);
      if (parsed.length > 0) return normalizePlan(parsed);
    } catch {
      // fall through to single-task fallback
    }

    // Robust fallback: treat the whole task as one subtask.
    return [
      {
        id: 'main',
        title: task.slice(0, 60),
        role: 'general',
        prompt: task,
        dependsOn: [],
      },
    ];
  }

  private async verify(command: string, workspacePath: string): Promise<{ command: string; success: boolean; output: string }> {
    const { runShellCapture } = await import('./shell.js');
    const { code, output } = await runShellCapture(command, workspacePath, 600_000);
    return { command, success: code === 0, output: output.slice(-4000) };
  }
}

function buildWorkerPrompt(subtask: OrchestratorSubtask): string {
  return `You are the "${subtask.role}" agent on a coordinated team. Complete ONLY your assigned subtask, editing files in the workspace as needed. Keep changes scoped and verify your own work where possible.

Subtask: ${subtask.title}

Instructions:
${subtask.prompt}

When finished, briefly summarize what you changed.`;
}

function parsePlan(raw: string): unknown[] {
  const trimmed = raw.trim();
  // Strip markdown fences if present.
  const fenced = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = fenced.indexOf('[');
  const end = fenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const value = JSON.parse(fenced.slice(start, end + 1));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalizePlan(items: unknown[]): OrchestratorSubtask[] {
  const subtasks: OrchestratorSubtask[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    let id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `task-${subtasks.length + 1}`;
    while (seen.has(id)) id = `${id}-${subtasks.length + 1}`;
    seen.add(id);
    const prompt = typeof record.prompt === 'string' && record.prompt.trim() ? record.prompt.trim() : '';
    if (!prompt) continue;
    subtasks.push({
      id,
      title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : id,
      role: typeof record.role === 'string' && record.role.trim() ? record.role.trim() : 'general',
      prompt,
      dependsOn: Array.isArray(record.dependsOn)
        ? record.dependsOn.filter((d): d is string => typeof d === 'string')
        : [],
    });
  }
  // Drop dependencies that reference unknown ids.
  const ids = new Set(subtasks.map((s) => s.id));
  for (const subtask of subtasks) {
    subtask.dependsOn = subtask.dependsOn.filter((d) => ids.has(d) && d !== subtask.id);
  }
  return subtasks;
}

/** Group subtasks into topological layers; breaks cycles defensively. */
function topologicalLayers(subtasks: OrchestratorSubtask[]): OrchestratorSubtask[][] {
  const layers: OrchestratorSubtask[][] = [];
  const remaining = new Map(subtasks.map((s) => [s.id, s]));
  const done = new Set<string>();

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((s) => s.dependsOn.every((d) => done.has(d) || !remaining.has(d)));
    if (ready.length === 0) {
      // Cycle or unresolved deps: flush everything remaining as one final layer.
      layers.push([...remaining.values()]);
      break;
    }
    layers.push(ready);
    for (const s of ready) {
      remaining.delete(s.id);
      done.add(s.id);
    }
  }
  return layers;
}

interface WorkspaceSnapshot {
  files: Map<string, string>;
}

async function snapshotWorkspace(root: string): Promise<WorkspaceSnapshot> {
  const files = new Map<string, string>();
  await walkAndRead(root, root, files);
  return { files };
}

async function walkAndRead(root: string, dir: string, out: Map<string, string>): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkAndRead(root, abs, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext && !TEXT_EXTENSIONS.has(ext)) continue;
      try {
        const stat = await fs.stat(abs);
        if (stat.size > 1_000_000) continue; // skip very large files
        out.set(path.relative(root, abs), await fs.readFile(abs, 'utf8'));
      } catch {
        // ignore unreadable files
      }
    }
  }
}

/** Compute which files a worker changed vs. baseline (no merge, shared workspace). */
async function diffAgainstBaseline(
  baseline: WorkspaceSnapshot,
  workspacePath: string
): Promise<{ changedFiles: string[]; conflicts: string[] }> {
  const current = await snapshotWorkspace(workspacePath);
  const changedFiles: string[] = [];
  for (const [rel, content] of current.files) {
    if (baseline.files.get(rel) !== content) changedFiles.push(rel);
  }
  for (const rel of baseline.files.keys()) {
    if (!current.files.has(rel)) changedFiles.push(rel);
  }
  return { changedFiles, conflicts: [] };
}

/**
 * Merge a worker's isolated worktree back into the primary workspace.
 * A conflict is recorded when the primary workspace already diverged from the
 * baseline for a file the worker also changed (i.e. an earlier worker in the
 * same layer already wrote it differently).
 */
async function mergeWorkspace(
  baseline: WorkspaceSnapshot,
  worktreePath: string,
  workspacePath: string
): Promise<{ changedFiles: string[]; conflicts: string[] }> {
  const worktree = await snapshotWorkspace(worktreePath);
  const changedFiles: string[] = [];
  const conflicts: string[] = [];

  for (const [rel, workerContent] of worktree.files) {
    const baseContent = baseline.files.get(rel);
    if (baseContent === workerContent) continue; // worker did not change this file

    const targetAbs = path.join(workspacePath, rel);
    let primaryContent: string | undefined;
    try {
      primaryContent = await fs.readFile(targetAbs, 'utf8');
    } catch {
      primaryContent = undefined;
    }

    // Primary already diverged from baseline AND differs from the worker's
    // version => genuine conflict. Keep primary, record the conflict.
    if (primaryContent !== undefined && primaryContent !== baseContent && primaryContent !== workerContent) {
      conflicts.push(rel);
      continue;
    }

    await fs.mkdir(path.dirname(targetAbs), { recursive: true });
    await fs.writeFile(targetAbs, workerContent, 'utf8');
    changedFiles.push(rel);
  }

  // Handle deletions: files present in baseline but removed in the worktree.
  for (const rel of baseline.files.keys()) {
    if (!worktree.files.has(rel)) {
      const targetAbs = path.join(workspacePath, rel);
      try {
        await fs.rm(targetAbs, { force: true });
        changedFiles.push(rel);
      } catch {
        // ignore
      }
    }
  }

  return { changedFiles, conflicts };
}
