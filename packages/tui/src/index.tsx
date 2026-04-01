/**
 * EchoAI TUI - Ink-backed runtime event rendering with viewport virtualization
 */
import React from "react";
import * as readline from "node:readline";
import { Box, Text, renderNow, useInput } from "./custom-ink.js";
import type { Instance } from "./custom-ink.js";
import type { KernelRunEvent } from "@echoai/runtime";

export interface TuiTheme {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    muted: string;
}

type TranscriptItem = {
    id: string;
    tone: keyof TuiTheme | "plain";
    text: string;
};

type RendererState = {
    items: TranscriptItem[];
    activeTools: string[];
    currentAssistantText: string;
    version: number;
    scrollTop: number;
    manualScroll: boolean;
    finished: boolean;
    heightCache: Map<string, number>;
};

const DEFAULT_THEME: TuiTheme = {
    primary: "cyan",
    secondary: "blue",
    success: "green",
    warning: "yellow",
    error: "red",
    muted: "gray",
};

export function color(text: string): string {
    return text;
}

export function bold(text: string): string { return text; }
export function success(text: string): string { return text; }
export function warning(text: string): string { return text; }
export function error(text: string): string { return text; }
export function muted(text: string): string { return text; }
export function primary(text: string): string { return text; }

export class RuntimeEventRenderer {
    private readonly stream: NodeJS.WriteStream;
    private readonly state: RendererState;
    private instance?: Instance;

    constructor(stream: NodeJS.WriteStream = process.stdout) {
        this.stream = stream;
        this.state = {
            items: [],
            activeTools: [],
            currentAssistantText: "",
            version: 0,
            scrollTop: 0,
            manualScroll: false,
            finished: false,
            heightCache: new Map(),
        };
    }

    consume(event: KernelRunEvent): void {
        switch (event.type) {
            case "run.started":
                this.pushItem(`session-${event.session.id}`, "primary", `Session: ${event.session.title}`);
                break;
            case "assistant.delta":
                this.state.currentAssistantText += event.text;
                this.bumpVersion();
                break;
            case "assistant.tool_call":
                this.setActiveTool(event.call.id, event.call.name);
                break;
            case "tool.batch.started":
                this.pushItem(
                    `batch-${this.state.items.length}`,
                    "muted",
                    `Tool batch (${event.mode}): ${event.calls.map((call) => call.name).join(", ")}`
                );
                break;
            case "tool.started":
                this.setActiveTool(event.call.id, event.call.name);
                break;
            case "tool.completed":
                this.removeActiveTool(event.call.id);
                this.pushItem(
                    `tool-${event.call.id}`,
                    "muted",
                    `[tool:${event.call.name}] ${event.result.summary ?? event.result.output ?? event.result.error ?? "completed"}`
                );
                break;
            case "approval.recorded":
                this.pushItem(
                    `approval-${event.approval.id}`,
                    event.approval.decision === "approved" ? "warning" : "error",
                    `[approval:${event.approval.toolName}] ${event.approval.decision}${event.approval.reason ? ` - ${event.approval.reason}` : ""}`
                );
                break;
            case "message.created":
                if (event.message.role === "assistant") {
                    this.state.currentAssistantText = "";
                    if (event.message.content.trim()) {
                        this.pushItem(event.message.id, "plain", event.message.content.trim());
                    } else {
                        this.bumpVersion();
                    }
                } else if (event.message.role === "tool") {
                    this.state.currentAssistantText = "";
                    this.bumpVersion();
                }
                break;
            case "session.compacted":
                this.pushItem(
                    `compact-${this.state.items.length}`,
                    "warning",
                    `Context compacted via ${event.report.appliedStrategies.join(", ")}`
                );
                break;
            case "run.completed":
                this.state.currentAssistantText = "";
                this.state.finished = true;
                this.bumpVersion();
                break;
        }

        this.ensureMounted();
    }

    finish(): void {
        this.state.currentAssistantText = "";
        this.state.finished = true;
        this.bumpVersion();
        this.ensureMounted();
        this.instance?.unmount();
        this.instance = undefined;
        this.stream.write("\n");
    }

    private ensureMounted(): void {
        const element = (
            <RuntimeInkApp
                state={this.state}
                width={this.stream.columns || 100}
                rows={this.stream.rows || 24}
                onScroll={(nextScrollTop, manualScroll) => {
                    this.state.scrollTop = nextScrollTop;
                    this.state.manualScroll = manualScroll;
                    this.bumpVersion(false);
                    this.ensureMounted();
                }}
            />
        );

        if (!this.instance) {
            this.instance = renderNow(element, {
                stdout: this.stream,
                stdin: process.stdin,
                stderr: process.stderr,
                exitOnCtrlC: false,
                patchConsole: false,
            });
            return;
        }

        this.instance.rerender(element);
    }

    private pushItem(id: string, tone: TranscriptItem["tone"], text: string): void {
        this.state.items.push({ id, tone, text });
        if (!this.state.manualScroll) {
            this.state.scrollTop = Number.MAX_SAFE_INTEGER;
        }
        this.bumpVersion();
    }

    private setActiveTool(id: string, name: string): void {
        if (!this.state.activeTools.includes(`${id}:${name}`)) {
            this.state.activeTools = [...this.state.activeTools, `${id}:${name}`];
        }
        this.bumpVersion();
    }

    private removeActiveTool(id: string): void {
        this.state.activeTools = this.state.activeTools.filter((entry) => !entry.startsWith(`${id}:`));
        this.bumpVersion();
    }

    private bumpVersion(updateAutoScroll = true): void {
        this.state.version += 1;
        if (updateAutoScroll && !this.state.manualScroll) {
            this.state.scrollTop = Number.MAX_SAFE_INTEGER;
        }
    }
}

export async function renderRunEvents(
    events: AsyncGenerator<KernelRunEvent>,
    renderer = new RuntimeEventRenderer()
): Promise<void> {
    for await (const event of events) {
        renderer.consume(event);
    }
    renderer.finish();
}

export async function prompt(question: string, defaultValue?: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const display = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    return new Promise((resolve) => {
        rl.question(display, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || "");
        });
    });
}

function RuntimeInkApp(
    {
        state,
        width,
        rows,
        onScroll,
    }: {
        state: RendererState;
        width: number;
        rows: number;
        onScroll: (nextScrollTop: number, manualScroll: boolean) => void;
    }
): React.JSX.Element {
    useInput((input, key) => {
        const viewportHeight = Math.max(6, rows - 4);
        if (key.upArrow) {
            onScroll(Math.max(0, normalizeScrollTop(state.scrollTop, state, width, viewportHeight) - 1), true);
        } else if (key.downArrow) {
            onScroll(normalizeScrollTop(state.scrollTop, state, width, viewportHeight) + 1, true);
        } else if (key.pageUp) {
            onScroll(Math.max(0, normalizeScrollTop(state.scrollTop, state, width, viewportHeight) - viewportHeight), true);
        } else if (key.pageDown) {
            onScroll(normalizeScrollTop(state.scrollTop, state, width, viewportHeight) + viewportHeight, true);
        } else if (input === "g") {
            onScroll(0, true);
        } else if (input === "G" || input === "b") {
            onScroll(Number.MAX_SAFE_INTEGER, false);
        }
    }, { isActive: !state.finished });

    const view = buildViewport(state, width, rows);

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text color={DEFAULT_THEME.secondary}>
                    {state.manualScroll ? "Viewport: manual scroll (g top, G bottom, arrows/page keys)" : "Viewport: live"}
                </Text>
            </Box>
            <Box flexDirection="column">
                {view.lines.map((line, index) => (
                    <Text key={`${state.version}-${index}`} color={line.color}>
                        {line.text}
                    </Text>
                ))}
            </Box>
            {state.activeTools.length > 0 ? (
                <Box marginTop={1}>
                    <Text color={DEFAULT_THEME.muted}>
                        Active tools: {state.activeTools.map((entry) => entry.split(":")[1]).join(", ")}
                    </Text>
                </Box>
            ) : null}
        </Box>
    );
}

function buildViewport(
    state: RendererState,
    width: number,
    rows: number
): { lines: Array<{ text: string; color?: string }> } {
    const viewportHeight = Math.max(6, rows - 4);
    const effectiveWidth = Math.max(20, width - 2);
    const items = state.currentAssistantText
        ? [...state.items, { id: "__assistant_live__", tone: "plain" as const, text: state.currentAssistantText }]
        : state.items;

    const lineEntries = items.flatMap((item) => {
        const cacheKey = `${item.id}:${effectiveWidth}`;
        const wrapped = wrapLine(item.text, effectiveWidth);
        state.heightCache.set(cacheKey, wrapped.length);
        return wrapped.map((line) => ({
            text: line,
            color: toneToColor(item.tone),
        }));
    });

    const maxTop = Math.max(0, lineEntries.length - viewportHeight);
    const top = Math.min(maxTop, normalizeScrollTop(state.scrollTop, state, effectiveWidth, viewportHeight));
    const visible = lineEntries.slice(top, top + viewportHeight);

    return { lines: visible };
}

function toneToColor(tone: TranscriptItem["tone"]): string | undefined {
    switch (tone) {
        case "primary":
            return DEFAULT_THEME.primary;
        case "secondary":
            return DEFAULT_THEME.secondary;
        case "success":
            return DEFAULT_THEME.success;
        case "warning":
            return DEFAULT_THEME.warning;
        case "error":
            return DEFAULT_THEME.error;
        case "muted":
            return DEFAULT_THEME.muted;
        default:
            return undefined;
    }
}

function normalizeScrollTop(
    scrollTop: number,
    state: RendererState,
    width: number,
    viewportHeight: number
): number {
    const estimatedHeight = state.items.reduce((total, item) => {
        const cacheKey = `${item.id}:${width}`;
        return total + (state.heightCache.get(cacheKey) ?? wrapLine(item.text, width).length);
    }, state.currentAssistantText ? wrapLine(state.currentAssistantText, width).length : 0);
    const maxTop = Math.max(0, estimatedHeight - viewportHeight);
    if (!Number.isFinite(scrollTop) || scrollTop >= Number.MAX_SAFE_INTEGER / 2) {
        return maxTop;
    }
    return Math.max(0, Math.min(maxTop, scrollTop));
}

function wrapLine(text: string, width: number): string[] {
    if (text.length <= width) {
        return [text];
    }

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        if (!current) {
            current = word;
            continue;
        }

        if (`${current} ${word}`.length > width) {
            lines.push(current);
            current = word;
            continue;
        }

        current = `${current} ${word}`;
    }

    if (current) {
        lines.push(current);
    }

    return lines.length > 0 ? lines : [text];
}
