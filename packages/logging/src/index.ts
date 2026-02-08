/**
 * EchoAI Logging - Structured Logging System
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export interface LogEntry { level: LogLevel; message: string; timestamp: string; context?: Record<string, unknown>; }
export type LogTransport = (entry: LogEntry) => void;

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const COLORS: Record<LogLevel, string> = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", fatal: "\x1b[35m" };
const RESET = "\x1b[0m";

export class Logger {
    private name: string;
    private minLevel: LogLevel;
    private transports: LogTransport[] = [];
    private context: Record<string, unknown> = {};

    constructor(name: string, minLevel: LogLevel = "info") {
        this.name = name;
        this.minLevel = minLevel;
        this.transports.push(this.consoleTransport.bind(this));
    }

    addTransport(transport: LogTransport): this { this.transports.push(transport); return this; }
    setContext(ctx: Record<string, unknown>): this { Object.assign(this.context, ctx); return this; }
    child(name: string): Logger { const c = new Logger(`${this.name}:${name}`, this.minLevel); c.context = { ...this.context }; c.transports = [...this.transports]; return c; }

    debug(msg: string, ctx?: Record<string, unknown>) { this.log("debug", msg, ctx); }
    info(msg: string, ctx?: Record<string, unknown>) { this.log("info", msg, ctx); }
    warn(msg: string, ctx?: Record<string, unknown>) { this.log("warn", msg, ctx); }
    error(msg: string, ctx?: Record<string, unknown>) { this.log("error", msg, ctx); }
    fatal(msg: string, ctx?: Record<string, unknown>) { this.log("fatal", msg, ctx); }

    private log(level: LogLevel, message: string, ctx?: Record<string, unknown>) {
        if (LEVELS[level] < LEVELS[this.minLevel]) return;
        const entry: LogEntry = { level, message, timestamp: new Date().toISOString(), context: { ...this.context, ...ctx, logger: this.name } };
        for (const t of this.transports) t(entry);
    }

    private consoleTransport(entry: LogEntry) {
        const color = COLORS[entry.level];
        const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
        console.log(`${color}[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${RESET}${ctx}`);
    }
}

export function fileTransport(filePath: string): LogTransport {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return (entry) => fs.appendFileSync(filePath, JSON.stringify(entry) + "\n");
}

export function jsonTransport(): LogTransport { return (entry) => console.log(JSON.stringify(entry)); }

export function createLogger(name: string, level?: LogLevel): Logger { return new Logger(name, level || (process.env.ECHOAI_DEBUG === "1" ? "debug" : "info")); }

export const logger = createLogger("echoai");
