/**
 * EchoAI Terminal - Interactive Terminal Session
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import * as readline from "node:readline";

export interface TerminalConfig {
    shell?: string;
    cwd?: string;
    env?: Record<string, string>;
    cols?: number;
    rows?: number;
}

export interface TerminalSession {
    id: string;
    process: ChildProcessWithoutNullStreams;
    output: string;
    isRunning: boolean;
}

export class TerminalManager extends EventEmitter {
    private sessions: Map<string, TerminalSession> = new Map();
    private counter = 0;

    create(config: TerminalConfig = {}): string {
        const id = `term_${++this.counter}`;
        const shell = config.shell || process.env.SHELL || "/bin/bash";

        const proc = spawn(shell, [], {
            cwd: config.cwd || process.cwd(),
            env: { ...process.env, ...config.env, TERM: "xterm-256color" },
            stdio: ["pipe", "pipe", "pipe"],
        });

        const session: TerminalSession = { id, process: proc, output: "", isRunning: true };

        proc.stdout.on("data", (data: Buffer) => {
            const text = data.toString();
            session.output += text;
            if (session.output.length > 50000) session.output = session.output.slice(-40000);
            this.emit("output", id, text);
        });

        proc.stderr.on("data", (data: Buffer) => {
            const text = data.toString();
            session.output += text;
            this.emit("output", id, text);
        });

        proc.on("close", (code) => {
            session.isRunning = false;
            this.emit("close", id, code);
        });

        this.sessions.set(id, session);
        return id;
    }

    send(id: string, input: string): boolean {
        const session = this.sessions.get(id);
        if (!session?.isRunning) return false;
        session.process.stdin.write(input);
        return true;
    }

    sendLine(id: string, line: string): boolean {
        return this.send(id, line + "\n");
    }

    resize(id: string, cols: number, rows: number): boolean {
        const session = this.sessions.get(id);
        if (!session?.isRunning) return false;
        // PTY resize would go here with node-pty
        return true;
    }

    getOutput(id: string, lastN?: number): string | null {
        const session = this.sessions.get(id);
        if (!session) return null;
        if (lastN) return session.output.slice(-lastN);
        return session.output;
    }

    close(id: string): boolean {
        const session = this.sessions.get(id);
        if (!session) return false;
        session.process.kill();
        this.sessions.delete(id);
        return true;
    }

    list(): string[] { return [...this.sessions.keys()]; }
    get(id: string): TerminalSession | undefined { return this.sessions.get(id); }
}

export function createTerminalManager(): TerminalManager { return new TerminalManager(); }

export async function runCommand(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
        const proc = spawn("sh", ["-c", cmd], { cwd, stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "", stderr = "";
        proc.stdout.on("data", (d) => stdout += d);
        proc.stderr.on("data", (d) => stderr += d);
        proc.on("close", (code) => resolve({ stdout, stderr, code: code || 0 }));
    });
}
