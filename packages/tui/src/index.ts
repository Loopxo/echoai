/**
 * EchoAI TUI - Terminal User Interface
 */
import * as readline from "node:readline";

export interface TuiTheme {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    muted: string;
}

const DEFAULT_THEME: TuiTheme = {
    primary: "\x1b[36m",    // cyan
    secondary: "\x1b[34m",  // blue
    success: "\x1b[32m",    // green
    warning: "\x1b[33m",    // yellow
    error: "\x1b[31m",      // red
    muted: "\x1b[90m",      // gray
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

export function color(text: string, colorCode: string): string {
    return `${colorCode}${text}${RESET}`;
}

export function bold(text: string): string { return `${BOLD}${text}${RESET}`; }
export function success(text: string): string { return color(text, DEFAULT_THEME.success); }
export function warning(text: string): string { return color(text, DEFAULT_THEME.warning); }
export function error(text: string): string { return color(text, DEFAULT_THEME.error); }
export function muted(text: string): string { return color(text, DEFAULT_THEME.muted); }
export function primary(text: string): string { return color(text, DEFAULT_THEME.primary); }

export function spinner(frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]): { start: (text: string) => void; stop: (finalText?: string) => void } {
    let idx = 0, timer: NodeJS.Timeout | null = null, text = "";
    return {
        start: (msg: string) => {
            text = msg;
            timer = setInterval(() => {
                process.stdout.write(`\r${primary(frames[idx++ % frames.length])} ${text}`);
            }, 80);
        },
        stop: (final?: string) => {
            if (timer) clearInterval(timer);
            process.stdout.write(`\r${final ? success("✓") : error("✗")} ${final || text}\n`);
        },
    };
}

export function progressBar(current: number, total: number, width = 30): string {
    const pct = Math.min(1, current / total);
    const filled = Math.round(width * pct);
    const empty = width - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${Math.round(pct * 100)}%`;
}

export async function prompt(question: string, defaultValue?: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const display = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    return new Promise((resolve) => {
        rl.question(primary(display), (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || "");
        });
    });
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = await prompt(`${question} ${hint}`);
    if (!answer) return defaultYes;
    return answer.toLowerCase().startsWith("y");
}

export async function select<T>(question: string, options: Array<{ label: string; value: T }>): Promise<T> {
    console.log(primary(question));
    options.forEach((opt, i) => console.log(`  ${muted(`${i + 1}.`)} ${opt.label}`));
    const answer = await prompt("Select");
    const idx = parseInt(answer, 10) - 1;
    return options[Math.max(0, Math.min(idx, options.length - 1))].value;
}

export function box(content: string, title?: string): string {
    const lines = content.split("\n");
    const width = Math.max(...lines.map(l => l.length), title?.length || 0) + 2;
    const top = title ? `┌─ ${title} ${"─".repeat(width - title.length - 3)}┐` : `┌${"─".repeat(width)}┐`;
    const bottom = `└${"─".repeat(width)}┘`;
    const middle = lines.map(l => `│ ${l.padEnd(width - 2)} │`).join("\n");
    return `${top}\n${middle}\n${bottom}`;
}

export function table(headers: string[], rows: string[][]): string {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] || "").length)));
    const sep = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";
    const formatRow = (row: string[]) => "|" + row.map((c, i) => ` ${(c || "").padEnd(widths[i])} `).join("|") + "|";
    return [sep, formatRow(headers), sep, ...rows.map(formatRow), sep].join("\n");
}

export function clear(): void { console.clear(); }
export function hr(): void { console.log(muted("─".repeat(process.stdout.columns || 80))); }
