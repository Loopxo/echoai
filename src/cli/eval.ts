import { Command } from 'commander';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface EvalTask {
  id: string;
  title: string;
  category: 'bugfix' | 'testfix' | 'refactor' | 'feature' | 'docs' | 'types' | 'security';
  fixture: string;
  prompt: string;
  testCommand: string;
  maxCostUsd: number;
  maxTurns: number;
  expected?: {
    files?: string[];
    forbiddenPaths?: string[];
    requiredDiffHints?: string[];
  };
  scoring: string[];
}

interface EvalRunRecord {
  taskId: string;
  agent: string;
  status: 'prepared' | 'passed' | 'failed' | 'error';
  startedAt: string;
  finishedAt: string;
  workspace: string;
  command?: string;
  testCommand: string;
  testExitCode?: number;
  score: number;
  diffHash?: string;
  notes: string[];
}

export const evalCommand = new Command('eval')
  .description('Run and report EchoAI coding evals');

evalCommand
  .command('list')
  .description('List eval tasks')
  .option('-c, --category <category>', 'Filter by task category')
  .action(async (options) => {
    const tasks = await loadEvalTasks(defaultTasksDir());
    const filtered = options.category
      ? tasks.filter((task) => task.category === options.category)
      : tasks;

    for (const task of filtered) {
      console.log(`${task.id}\t${task.category}\t${task.title}`);
    }
    console.log(`\n${filtered.length}/${tasks.length} tasks`);
  });

evalCommand
  .command('run')
  .description('Prepare or run one or more coding eval tasks')
  .option('-a, --agent <name>', 'Agent label for output folder', 'echoai')
  .option('-t, --task <id>', 'Run a single task id')
  .option('-c, --category <category>', 'Run one category')
  .option('--command <command>', 'Agent command to run inside each copied fixture')
  .option('--all', 'Run all tasks')
  .option('--keep-workspace', 'Keep prepared workspace after run', true)
  .action(async (options) => {
    const tasks = await selectTasks(options);
    if (tasks.length === 0) {
      console.error('No eval tasks matched.');
      process.exit(1);
    }

    const runRoot = path.join(process.cwd(), 'evals', 'runs', sanitizeSegment(options.agent), timestamp());
    await mkdir(runRoot, { recursive: true });

    const records: EvalRunRecord[] = [];
    for (const task of tasks) {
      const record = await runEvalTask(task, {
        agent: options.agent,
        command: options.command,
        runRoot,
        keepWorkspace: options.keepWorkspace !== false,
      });
      records.push(record);
      console.log(`${record.status === 'passed' ? 'PASS' : record.status.toUpperCase()} ${task.id} score=${record.score}`);
    }

    await writeFile(path.join(runRoot, 'summary.json'), JSON.stringify(records, null, 2), 'utf8');
    await writeFile(path.join(runRoot, 'summary.md'), renderSummaryMarkdown(records), 'utf8');
    const passed = records.filter((record) => record.status === 'passed').length;
    console.log(`\nEval run: ${runRoot}`);
    console.log(`Passed: ${passed}/${records.length}`);
  });

evalCommand
  .command('report')
  .description('Summarize eval run results')
  .option('-a, --agent <name>', 'Agent label to report')
  .option('--json', 'Print JSON')
  .action(async (options) => {
    const report = await loadEvalReport(path.join(process.cwd(), 'evals', 'runs'), options.agent);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log('EchoAI Eval Report');
    console.log(`Runs: ${report.runs}`);
    console.log(`Tasks: ${report.tasks}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Average score: ${report.averageScore.toFixed(2)}`);
    if (report.latestRun) {
      console.log(`Latest run: ${report.latestRun}`);
    }
  });

export async function loadEvalTasks(tasksDir: string = defaultTasksDir()): Promise<EvalTask[]> {
  const files = await readdir(tasksDir).catch(() => []);
  const tasks: EvalTask[] = [];

  for (const file of files.filter((name) => name.endsWith('.json')).sort()) {
    const parsed = JSON.parse(await readFile(path.join(tasksDir, file), 'utf8')) as EvalTask | EvalTask[];
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of entries) {
      validateTask(entry, file);
      tasks.push(entry);
    }
  }

  return tasks.sort((a, b) => a.id.localeCompare(b.id));
}

async function selectTasks(options: { task?: string; category?: string; all?: boolean }): Promise<EvalTask[]> {
  const tasks = await loadEvalTasks(defaultTasksDir());
  if (options.task) return tasks.filter((task) => task.id === options.task);
  if (options.category) return tasks.filter((task) => task.category === options.category);
  if (options.all) return tasks;
  return tasks.slice(0, 1);
}

async function runEvalTask(
  task: EvalTask,
  options: {
    agent: string;
    command?: string;
    runRoot: string;
    keepWorkspace: boolean;
  }
): Promise<EvalRunRecord> {
  const startedAt = new Date().toISOString();
  const taskRunDir = path.join(options.runRoot, task.id);
  const workspace = path.join(taskRunDir, 'workspace');
  const fixturePath = path.join(process.cwd(), task.fixture);
  await rm(taskRunDir, { recursive: true, force: true });
  await mkdir(taskRunDir, { recursive: true });
  await cp(fixturePath, workspace, { recursive: true });
  await writeFile(path.join(taskRunDir, 'prompt.md'), task.prompt, 'utf8');
  await writeFile(path.join(taskRunDir, 'task.json'), JSON.stringify(task, null, 2), 'utf8');

  const notes: string[] = [];
  await runCommand('git', ['init'], workspace, {});
  await runCommand('git', ['add', '.'], workspace, {});
  await runCommand('git', ['commit', '-m', 'eval fixture baseline'], workspace, {
    env: {
      GIT_AUTHOR_NAME: 'EchoAI Eval',
      GIT_AUTHOR_EMAIL: 'eval@echoai.local',
      GIT_COMMITTER_NAME: 'EchoAI Eval',
      GIT_COMMITTER_EMAIL: 'eval@echoai.local',
    },
  });

  if (!options.command) {
    const record = {
      taskId: task.id,
      agent: options.agent,
      status: 'prepared' as const,
      startedAt,
      finishedAt: new Date().toISOString(),
      workspace,
      testCommand: task.testCommand,
      score: 0,
      notes: ['Prepared workspace only. Pass --command to run an agent command.'],
    };
    await writeFile(path.join(taskRunDir, 'result.json'), JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  const agentResult = await runShell(options.command, workspace, {
    ECHOAI_EVAL_TASK_ID: task.id,
    ECHOAI_EVAL_PROMPT: task.prompt,
  });
  await writeFile(path.join(taskRunDir, 'agent.log'), formatProcessOutput(options.command, agentResult), 'utf8');
  if (agentResult.code !== 0) {
    notes.push(`Agent command exited with code ${agentResult.code}`);
  }

  const testResult = await runShell(task.testCommand, workspace, {
    ECHOAI_EVAL_TASK_ID: task.id,
  });
  await writeFile(path.join(taskRunDir, 'test.log'), formatProcessOutput(task.testCommand, testResult), 'utf8');

  const diff = await runCommand('git', ['diff', '--no-ext-diff', '--'], workspace, {});
  await writeFile(path.join(taskRunDir, 'diff.patch'), diff.stdout, 'utf8');

  const diffHash = createHash('sha256').update(diff.stdout).digest('hex');
  const expectedTouched = scoreExpectedFiles(task, diff.stdout, notes);
  const score = testResult.code === 0 ? Math.max(0.7, expectedTouched) : expectedTouched * 0.4;
  const status = testResult.code === 0 ? 'passed' : 'failed';
  const record: EvalRunRecord = {
    taskId: task.id,
    agent: options.agent,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    workspace,
    command: options.command,
    testCommand: task.testCommand,
    testExitCode: testResult.code,
    score,
    diffHash,
    notes,
  };
  await writeFile(path.join(taskRunDir, 'result.json'), JSON.stringify(record, null, 2), 'utf8');

  if (!options.keepWorkspace) {
    await rm(workspace, { recursive: true, force: true });
  }

  return record;
}

function scoreExpectedFiles(task: EvalTask, diff: string, notes: string[]): number {
  const expectedFiles = task.expected?.files ?? [];
  const forbiddenPaths = task.expected?.forbiddenPaths ?? [];
  const requiredHints = task.expected?.requiredDiffHints ?? [];
  let score = 0.2;

  if (expectedFiles.length > 0) {
    const matched = expectedFiles.filter((file) => diff.includes(` b/${file}`) || diff.includes(` ${file}`));
    score += 0.4 * (matched.length / expectedFiles.length);
    if (matched.length < expectedFiles.length) notes.push(`Missing expected edits: ${expectedFiles.filter((file) => !matched.includes(file)).join(', ')}`);
  }

  if (requiredHints.length > 0) {
    const matched = requiredHints.filter((hint) => diff.toLowerCase().includes(hint.toLowerCase()));
    score += 0.2 * (matched.length / requiredHints.length);
  }

  const forbidden = forbiddenPaths.filter((file) => diff.includes(` b/${file}`) || diff.includes(` ${file}`));
  if (forbidden.length === 0) score += 0.2;
  else notes.push(`Edited forbidden paths: ${forbidden.join(', ')}`);

  return Math.min(1, Number(score.toFixed(2)));
}

async function loadEvalReport(runsRoot: string, agent?: string): Promise<{
  runs: number;
  tasks: number;
  passed: number;
  averageScore: number;
  latestRun?: string;
}> {
  const agents = agent ? [agent] : await readdir(runsRoot).catch(() => []);
  const records: EvalRunRecord[] = [];
  let latestRun: string | undefined;
  let runCount = 0;

  for (const agentName of agents) {
    const agentDir = path.join(runsRoot, sanitizeSegment(agentName));
    const runIds = await readdir(agentDir).catch(() => []);
    for (const runId of runIds) {
      const summaryPath = path.join(agentDir, runId, 'summary.json');
      const content = await readFile(summaryPath, 'utf8').catch(() => null);
      if (!content) continue;
      const parsed = JSON.parse(content) as EvalRunRecord[];
      records.push(...parsed);
      runCount += 1;
      latestRun = path.join(agentDir, runId);
    }
  }

  return {
    runs: runCount,
    tasks: records.length,
    passed: records.filter((record) => record.status === 'passed').length,
    averageScore: records.length > 0
      ? records.reduce((sum, record) => sum + record.score, 0) / records.length
      : 0,
    latestRun,
  };
}

function renderSummaryMarkdown(records: EvalRunRecord[]): string {
  const rows = records.map((record) =>
    `| ${record.taskId} | ${record.status} | ${record.score.toFixed(2)} | ${record.testExitCode ?? ''} |`
  );
  return [
    '# EchoAI Eval Summary',
    '',
    '| Task | Status | Score | Test exit |',
    '| --- | --- | ---: | ---: |',
    ...rows,
    '',
  ].join('\n');
}

function validateTask(task: EvalTask, source: string): void {
  for (const key of ['id', 'title', 'category', 'fixture', 'prompt', 'testCommand']) {
    if (!(key in task)) {
      throw new Error(`Invalid eval task in ${source}: missing ${key}`);
    }
  }
}

function defaultTasksDir(): string {
  return path.join(process.cwd(), 'evals', 'tasks');
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'agent';
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function runShell(command: string, cwd: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    collect(child, resolve);
  });
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  options: { env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    collect(child, resolve);
  });
}

function collect(
  child: ReturnType<typeof spawn>,
  resolve: (value: { stdout: string; stderr: string; code: number }) => void
): void {
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  child.on('error', (error: NodeJS.ErrnoException) => {
    resolve({ stdout, stderr: error.message, code: error.code === 'ENOENT' ? 127 : 1 });
  });
  child.on('close', (code) => {
    resolve({ stdout, stderr, code: code ?? 0 });
  });
}

function formatProcessOutput(command: string, result: { stdout: string; stderr: string; code: number }): string {
  return [`$ ${command}`, result.stdout, result.stderr, `exit code: ${result.code}`].filter(Boolean).join('\n');
}

export default evalCommand;
