import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KernelTaskRecord, SessionRegistryOptions } from "./types.js";

export interface RuntimeTaskHandle {
  pid: number;
  logPath: string;
  statusPath: string;
  runnerPath: string;
}

export interface RuntimeTaskPaths {
  taskDir: string;
  logPath: string;
  statusPath: string;
  runnerPath: string;
}

interface RuntimeTaskStatusFile {
  exitCode: number;
  completedAt: number;
}

export function createTaskRuntime(options?: SessionRegistryOptions) {
  const stateRoot = resolveStateDir(options);
  const namespace = options?.namespace ?? "runtime";
  const tasksRoot = path.join(stateRoot, namespace, "tasks");

  return {
    async startShellTask(
      sessionId: string,
      taskId: string,
      command: string,
      taskOptions: { cwd?: string } = {}
    ): Promise<RuntimeTaskHandle> {
      const { taskDir, logPath, statusPath, runnerPath } = buildTaskPaths(tasksRoot, sessionId, taskId);
      const cwd = path.resolve(taskOptions.cwd ?? process.cwd());

      await fs.mkdir(taskDir, { recursive: true });
      await fs.writeFile(
        runnerPath,
        createRunnerScript({
          command,
          cwd,
          logPath,
          statusPath,
        }),
        "utf8"
      );
      await fs.chmod(runnerPath, 0o755);

      const child = spawn("/bin/sh", [runnerPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      if (!child.pid) {
        throw new Error("Failed to start background task");
      }

      return {
        pid: child.pid,
        logPath,
        statusPath,
        runnerPath,
      };
    },
    getTaskPaths(sessionId: string, taskId: string): RuntimeTaskPaths {
      return buildTaskPaths(tasksRoot, sessionId, taskId);
    },
  };
}

export async function refreshTaskRecordState(
  task: KernelTaskRecord
): Promise<{ changed: boolean; task: KernelTaskRecord }> {
  const statusPath = readStringMetadata(task.metadata?.statusPath);
  const pid = readNumberMetadata(task.metadata?.pid);

  if (task.status !== "running") {
    return { changed: false, task };
  }

  if (statusPath) {
    const status = await readStatusFile(statusPath);
    if (status) {
      return {
        changed: true,
        task: {
          ...task,
          status: status.exitCode === 0 ? "completed" : "failed",
          updatedAt: status.completedAt,
          metadata: {
            ...task.metadata,
            exitCode: status.exitCode,
            completedAt: status.completedAt,
          },
        },
      };
    }
  }

  if (pid && !isProcessRunning(pid)) {
    return {
      changed: true,
      task: {
        ...task,
        status: "failed",
        updatedAt: Date.now(),
        metadata: {
          ...task.metadata,
          exitCode: readNumberMetadata(task.metadata?.exitCode) ?? 1,
        },
      },
    };
  }

  return { changed: false, task };
}

export async function readTaskLog(logPath: string, maxBytes = 64_000): Promise<string> {
  const content = await fs.readFile(logPath, "utf8");
  if (content.length <= maxBytes) {
    return content;
  }
  return content.slice(content.length - maxBytes);
}

export function stopTaskProcess(pid: number, signal: NodeJS.Signals = "SIGTERM"): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function resolveStateDir(options?: SessionRegistryOptions): string {
  const configured = options?.stateDir ?? process.env.ECHOAI_STATE_DIR?.trim();
  return configured && configured.length > 0
    ? path.resolve(configured)
    : path.join(os.homedir(), ".echoai");
}

function buildTaskPaths(tasksRoot: string, sessionId: string, taskId: string): RuntimeTaskPaths {
  const taskDir = path.join(tasksRoot, sessionId, taskId);
  return {
    taskDir,
    logPath: path.join(taskDir, "task.log"),
    statusPath: path.join(taskDir, "status.json"),
    runnerPath: path.join(taskDir, "runner.sh"),
  };
}

function createRunnerScript(input: {
  command: string;
  cwd: string;
  logPath: string;
  statusPath: string;
}): string {
  const nodeExec = JSON.stringify(process.execPath);
  const cwd = shellQuote(input.cwd);
  const logPath = shellQuote(input.logPath);
  const statusPath = shellQuote(input.statusPath);

  return [
    "#!/bin/sh",
    `cd ${cwd} || exit 1`,
    `exec > ${logPath} 2>&1`,
    "/bin/sh <<'__ECHOAI_TASK__'",
    input.command,
    "__ECHOAI_TASK__",
    "exit_code=$?",
    `${nodeExec} -e "const fs=require('node:fs');fs.writeFileSync(process.argv[2], JSON.stringify({ exitCode:Number(process.argv[1]), completedAt:Date.now() }), 'utf8');" "$exit_code" ${statusPath}`,
    "exit \"$exit_code\"",
    "",
  ].join("\n");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function readStatusFile(statusPath: string): Promise<RuntimeTaskStatusFile | null> {
  try {
    const raw = await fs.readFile(statusPath, "utf8");
    const parsed = JSON.parse(raw) as RuntimeTaskStatusFile;
    if (typeof parsed.exitCode !== "number" || typeof parsed.completedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readStringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumberMetadata(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
