/**
 * EchoAI Daemon - Background Service
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const PID_FILE = path.join(STATE_DIR, "daemon.pid");
const LOG_FILE = path.join(STATE_DIR, "daemon.log");

export interface DaemonStatus {
    running: boolean;
    pid?: number;
    uptime?: number;
    startedAt?: number;
}

export async function isDaemonRunning(): Promise<boolean> {
    try {
        const pid = parseInt(await fs.readFile(PID_FILE, "utf8"), 10);
        process.kill(pid, 0); // Check if process exists
        return true;
    } catch {
        return false;
    }
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
    try {
        const pid = parseInt(await fs.readFile(PID_FILE, "utf8"), 10);
        process.kill(pid, 0);
        const stat = await fs.stat(PID_FILE);
        const startedAt = stat.mtimeMs;
        return { running: true, pid, startedAt, uptime: Date.now() - startedAt };
    } catch {
        return { running: false };
    }
}

export async function startDaemon(entryScript: string): Promise<{ pid: number }> {
    if (await isDaemonRunning()) throw new Error("Daemon already running");

    await fs.mkdir(STATE_DIR, { recursive: true });
    const logFd = await fs.open(LOG_FILE, "a");

    const child = spawn(process.execPath, [entryScript], {
        detached: true,
        stdio: ["ignore", logFd.fd, logFd.fd],
        env: { ...process.env, ECHOAI_DAEMON: "1" },
    });

    child.unref();
    await fs.writeFile(PID_FILE, String(child.pid));
    await logFd.close();

    return { pid: child.pid! };
}

export async function stopDaemon(): Promise<boolean> {
    try {
        const pid = parseInt(await fs.readFile(PID_FILE, "utf8"), 10);
        process.kill(pid, "SIGTERM");
        await fs.unlink(PID_FILE);
        return true;
    } catch {
        return false;
    }
}

export class DaemonProcess extends EventEmitter {
    private shutdownHandlers: Array<() => Promise<void>> = [];
    private running = false;

    async run(main: () => Promise<void>): Promise<void> {
        this.running = true;
        process.on("SIGTERM", () => this.shutdown());
        process.on("SIGINT", () => this.shutdown());

        try {
            await main();
            while (this.running) await new Promise(r => setTimeout(r, 1000));
        } finally {
            await this.cleanup();
        }
    }

    onShutdown(handler: () => Promise<void>): void {
        this.shutdownHandlers.push(handler);
    }

    private async shutdown(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        this.emit("shutdown");
    }

    private async cleanup(): Promise<void> {
        for (const handler of this.shutdownHandlers) {
            try { await handler(); } catch { /* ignore */ }
        }
        try { await fs.unlink(PID_FILE); } catch { /* ignore */ }
    }
}

export function createDaemon(): DaemonProcess { return new DaemonProcess(); }
