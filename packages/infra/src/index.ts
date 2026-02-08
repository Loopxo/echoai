/**
 * EchoAI Infra - Infrastructure Utilities
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";

export interface SystemInfo { platform: string; arch: string; hostname: string; cpus: number; memoryTotal: number; memoryFree: number; uptime: number; nodeVersion: string; }
export interface DockerInfo { installed: boolean; version?: string; running: boolean; }
export interface HealthCheck { name: string; status: "healthy" | "unhealthy" | "degraded"; latencyMs?: number; message?: string; }

export function getSystemInfo(): SystemInfo {
    return { platform: os.platform(), arch: os.arch(), hostname: os.hostname(), cpus: os.cpus().length, memoryTotal: os.totalmem(), memoryFree: os.freemem(), uptime: os.uptime(), nodeVersion: process.version };
}

export async function checkDocker(): Promise<DockerInfo> {
    try {
        const version = await execAsync("docker --version");
        const running = await execAsync("docker info").then(() => true).catch(() => false);
        return { installed: true, version: version.trim().split(" ")[2]?.replace(",", ""), running };
    } catch { return { installed: false, running: false }; }
}

export async function healthCheck(name: string, check: () => Promise<void>): Promise<HealthCheck> {
    const start = Date.now();
    try { await check(); return { name, status: "healthy", latencyMs: Date.now() - start }; }
    catch (e) { return { name, status: "unhealthy", latencyMs: Date.now() - start, message: (e as Error).message }; }
}

export async function checkPort(port: number, host = "localhost"): Promise<boolean> {
    return new Promise((resolve) => {
        const net = require("node:net");
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on("connect", () => { socket.destroy(); resolve(true); });
        socket.on("timeout", () => { socket.destroy(); resolve(false); });
        socket.on("error", () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
    });
}

export async function waitForPort(port: number, timeoutMs = 30000, intervalMs = 500): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await checkPort(port)) return true;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
}

export function getEnvInfo(): Record<string, string | undefined> {
    const keys = ["ECHOAI_DEBUG", "ECHOAI_PROVIDER", "ECHOAI_API_KEY", "ECHOAI_MODEL", "NODE_ENV"];
    return Object.fromEntries(keys.map(k => [k, process.env[k]]));
}

async function execAsync(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => { if (err) reject(err); else resolve(stdout); });
    });
}

export async function ensureDir(dir: string): Promise<void> { await fs.mkdir(dir, { recursive: true }); }
export async function cleanDir(dir: string): Promise<void> { await fs.rm(dir, { recursive: true, force: true }); await ensureDir(dir); }

export const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
export const DATA_DIR = path.join(STATE_DIR, "data");
export const LOGS_DIR = path.join(STATE_DIR, "logs");
export const CACHE_DIR = path.join(STATE_DIR, "cache");

export async function initDirectories(): Promise<void> {
    await Promise.all([ensureDir(STATE_DIR), ensureDir(DATA_DIR), ensureDir(LOGS_DIR), ensureDir(CACHE_DIR)]);
}
