import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join, resolve } from 'node:path';
import type {
  DesktopCommandClassification,
  DesktopSandboxStatus,
  DesktopTaskRecord,
  DesktopTerminalRunRequest,
} from '@shared/ipc';
import type { DesktopLogger } from './logger';

type TaskUpdateSink = (task: DesktopTaskRecord) => void;

export class TerminalTaskService {
  private readonly tasks = new Map<string, DesktopTaskRecord>();
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(
    private readonly logsDir: string,
    private readonly logger: DesktopLogger,
    private readonly emitUpdate: TaskUpdateSink
  ) {}

  async run(request: DesktopTerminalRunRequest): Promise<DesktopTaskRecord> {
    const command = request.command.trim();
    if (!command) {
      throw new Error('Command is required');
    }

    const cwd = resolve(request.cwd);
    const classification = classifyCommand(command);
    const task = createTask(command, cwd, classification, this.logsDir);
    this.tasks.set(task.id, task);
    await mkdir(this.logsDir, { recursive: true });

    if (classification.risk === 'deny') {
      task.status = 'denied';
      task.updatedAt = new Date().toISOString();
      await appendFile(task.logPath, `Denied: ${classification.reason}\n`, 'utf8');
      this.emitUpdate(task);
      return task;
    }

    const child = spawn(command, {
      cwd,
      shell: true,
      env: redactEnvironment(process.env),
    });
    this.processes.set(task.id, child);
    this.emitUpdate(task);

    child.stdout.on('data', (data) => void appendFile(task.logPath, data));
    child.stderr.on('data', (data) => void appendFile(task.logPath, data));
    child.on('error', (error) => {
      this.logger.error('terminal task failed to start', error);
      task.status = 'failed';
      task.updatedAt = new Date().toISOString();
      void appendFile(task.logPath, `${error.message}\n`, 'utf8');
      this.emitUpdate(task);
    });
    child.on('close', (code) => {
      this.processes.delete(task.id);
      task.exitCode = code;
      task.status = code === 0 ? 'completed' : 'failed';
      task.updatedAt = new Date().toISOString();
      this.emitUpdate(task);
    });

    return task;
  }

  stop(taskId: string): boolean {
    const process = this.processes.get(taskId);
    const task = this.tasks.get(taskId);
    if (!process || !task) {
      return false;
    }

    process.kill('SIGTERM');
    this.processes.delete(taskId);
    task.status = 'cancelled';
    task.updatedAt = new Date().toISOString();
    this.emitUpdate(task);
    return true;
  }

  list(): DesktopTaskRecord[] {
    return [...this.tasks.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getLog(taskId: string): Promise<string> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return '';
    }

    return readFile(task.logPath, 'utf8').catch(() => '');
  }

  cleanup(): void {
    for (const taskId of this.processes.keys()) {
      this.stop(taskId);
    }
  }
}

export function classifyCommand(command: string): DesktopCommandClassification {
  const normalized = command.trim().toLowerCase();
  if (!normalized) {
    return { risk: 'deny', reason: 'Empty command' };
  }

  const denied = [
    /rm\s+-rf\s+\/(\s|$)/,
    /mkfs\./,
    /diskutil\s+erase/i,
    /shutdown\b/,
    /reboot\b/,
    /:\(\)\s*\{\s*:\|:&\s*\};:/,
  ];
  if (denied.some((pattern) => pattern.test(command))) {
    return { risk: 'deny', reason: 'Destructive system command' };
  }

  const ask = [
    /^sudo\b/,
    /\bcurl\b.*\|\s*(sh|bash|zsh)/,
    /\bwget\b.*\|\s*(sh|bash|zsh)/,
    />\s*\/etc\//,
    /\bchmod\s+777\b/,
    /\brm\b/,
  ];
  if (ask.some((pattern) => pattern.test(normalized))) {
    return { risk: 'ask', reason: 'Command can modify system or delete files' };
  }

  return { risk: 'safe', reason: 'Read/build command' };
}

export function getSandboxStatus(platform: NodeJS.Platform): DesktopSandboxStatus {
  return {
    native: 'available',
    wsl: platform === 'win32' ? 'missing' : 'unsupported',
    lima: platform === 'darwin' ? 'missing' : 'unsupported',
    platform,
  };
}

function createTask(
  command: string,
  cwd: string,
  classification: DesktopCommandClassification,
  logsDir: string
): DesktopTaskRecord {
  const now = new Date().toISOString();
  const id = randomUUID();
  return {
    id,
    command,
    cwd,
    status: 'running',
    classification,
    exitCode: null,
    startedAt: now,
    updatedAt: now,
    logPath: join(logsDir, `task-${id}.log`),
  };
}

function redactEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/token|secret|password|key/i.test(key)) {
      continue;
    }
    next[key] = value;
  }
  return next;
}
