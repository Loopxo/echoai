/**
 * EchoAI Process - Process Management
 */
import { spawn, exec, type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const PIDS_DIR = path.join(STATE_DIR, "pids");

export interface ProcessInfo { pid: number; name: string; startedAt: number; command: string; cwd?: string; }
export interface RunOptions extends SpawnOptions { timeout?: number; }

export async function run(cmd: string, options: RunOptions = {}): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
        const child = spawn("sh", ["-c", cmd], { cwd: options.cwd, env: options.env, stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "", stderr = "";
        child.stdout?.on("data", d => stdout += d);
        child.stderr?.on("data", d => stderr += d);
        child.on("close", code => resolve({ stdout, stderr, code: code ?? 0 }));
        child.on("error", reject);
        if (options.timeout) setTimeout(() => { child.kill(); reject(new Error("Timeout")); }, options.timeout);
    });
}

export function spawn_(cmd: string, args: string[] = [], options: SpawnOptions = {}): ChildProcess {
    return spawn(cmd, args, { ...options, stdio: options.stdio || ["pipe", "pipe", "pipe"] });
}

export class ProcessManager extends EventEmitter {
    private processes: Map<string, { child: ChildProcess; info: ProcessInfo }> = new Map();

    async startProcess(name: string, command: string, options: SpawnOptions = {}): Promise<ProcessInfo> {
        const child = spawn("sh", ["-c", command], { cwd: options.cwd, env: options.env, stdio: ["pipe", "pipe", "pipe"], detached: true });
        const info: ProcessInfo = { pid: child.pid!, name, startedAt: Date.now(), command, cwd: options.cwd as string | undefined };
        this.processes.set(name, { child, info });
        await this.savePidFile(name, info);
        child.on("close", code => { this.processes.delete(name); this.removePidFile(name); this.emit("exit", name, code); });
        this.emit("start", name, info);
        return info;
    }

    stopProcess(name: string): boolean {
        const proc = this.processes.get(name);
        if (!proc) return false;
        proc.child.kill();
        return true;
    }

    getProcess(name: string): ProcessInfo | undefined { return this.processes.get(name)?.info; }
    listProcesses(): ProcessInfo[] { return [...this.processes.values()].map(p => p.info); }

    private async savePidFile(name: string, info: ProcessInfo): Promise<void> {
        await fs.mkdir(PIDS_DIR, { recursive: true });
        await fs.writeFile(path.join(PIDS_DIR, `${name}.pid`), JSON.stringify(info, null, 2));
    }

    private async removePidFile(name: string): Promise<void> {
        try { await fs.unlink(path.join(PIDS_DIR, `${name}.pid`)); } catch { /* ignore */ }
    }

    async loadFromPidFiles(): Promise<void> {
        try {
            const files = await fs.readdir(PIDS_DIR);
            for (const file of files) {
                if (!file.endsWith(".pid")) continue;
                const data = await fs.readFile(path.join(PIDS_DIR, file), "utf8");
                const info = JSON.parse(data) as ProcessInfo;
                if (isProcessRunning(info.pid)) this.emit("found", info);
            }
        } catch { /* No pids dir */ }
    }
}

export function isProcessRunning(pid: number): boolean {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

export function killProcess(pid: number, signal: NodeJS.Signals = "SIGTERM"): boolean {
    try { process.kill(pid, signal); return true; } catch { return false; }
}

export function createProcessManager(): ProcessManager { return new ProcessManager(); }
