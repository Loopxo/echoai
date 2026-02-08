/**
 * EchoAI Agents
 *
 * AI agent orchestration system:
 * - Agent configuration and lifecycle
 * - Tool definitions and execution
 * - System prompt generation
 * - Session management
 * - Subagent spawning
 * - Context management
 */

import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

// =============================================================================
// Types
// =============================================================================

export interface AgentConfig {
    /** Unique agent identifier */
    id: string;
    /** Display name */
    name: string;
    /** System prompt template */
    systemPrompt?: string;
    /** Model to use */
    model?: string;
    /** Available tools */
    tools?: string[];
    /** Max tokens per response */
    maxTokens?: number;
    /** Temperature */
    temperature?: number;
    /** Workspace root */
    workspaceRoot?: string;
    /** Agent-specific settings */
    settings?: Record<string, unknown>;
}

export interface Tool {
    name: string;
    description: string;
    inputSchema: ToolSchema;
    execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolSchema {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
}

export interface PropertySchema {
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    enum?: string[];
    items?: PropertySchema;
    default?: unknown;
}

export interface ToolContext {
    agentId: string;
    sessionId: string;
    workspaceRoot?: string;
    abortSignal?: AbortSignal;
}

export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    data?: unknown;
}

export interface ToolCall {
    id: string;
    name: string;
    input: unknown;
}

export interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    toolCalls?: ToolCall[];
    toolCallId?: string;
    name?: string;
}

export interface Session {
    id: string;
    agentId: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
}

export interface AgentRunOptions {
    input: string;
    sessionId?: string;
    maxTurns?: number;
    onToolStart?: (toolName: string, input: unknown) => void;
    onToolEnd?: (toolName: string, result: ToolResult) => void;
    onMessage?: (message: Message) => void;
    abortSignal?: AbortSignal;
}

export interface AgentRunResult {
    sessionId: string;
    messages: Message[];
    finalResponse: string;
    toolsUsed: string[];
}

export type CompletionProvider = (
    messages: Message[],
    tools: Tool[],
    config: AgentConfig
) => Promise<{ content: string; toolCalls?: ToolCall[] }>;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_TURNS = 10;

function resolveStateDir(): string {
    return process.env.ECHOAI_STATE_DIR?.trim() ||
        path.join(process.env.HOME || os.homedir(), ".echoai");
}

// =============================================================================
// Tool Registry
// =============================================================================

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    unregister(name: string): void {
        this.tools.delete(name);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    getByNames(names: string[]): Tool[] {
        return names.map(n => this.tools.get(n)).filter(Boolean) as Tool[];
    }

    list(): string[] {
        return Array.from(this.tools.keys());
    }
}

// =============================================================================
// Session Store
// =============================================================================

export class SessionStore {
    private stateDir: string;

    constructor(stateDir?: string) {
        this.stateDir = stateDir || resolveStateDir();
    }

    private getSessionPath(sessionId: string): string {
        return path.join(this.stateDir, "sessions", `${sessionId}.json`);
    }

    async save(session: Session): Promise<void> {
        const filePath = this.getSessionPath(session.id);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    }

    async load(sessionId: string): Promise<Session | null> {
        try {
            const filePath = this.getSessionPath(sessionId);
            const data = await fs.readFile(filePath, "utf8");
            return JSON.parse(data) as Session;
        } catch {
            return null;
        }
    }

    async delete(sessionId: string): Promise<void> {
        try {
            await fs.unlink(this.getSessionPath(sessionId));
        } catch {
            // Ignore
        }
    }

    async list(agentId?: string): Promise<string[]> {
        try {
            const dir = path.join(this.stateDir, "sessions");
            const files = await fs.readdir(dir);
            const ids = files
                .filter(f => f.endsWith(".json"))
                .map(f => f.replace(".json", ""));

            if (!agentId) return ids;

            // Filter by agent
            const filtered: string[] = [];
            for (const id of ids) {
                const session = await this.load(id);
                if (session?.agentId === agentId) {
                    filtered.push(id);
                }
            }
            return filtered;
        } catch {
            return [];
        }
    }
}

// =============================================================================
// System Prompt Builder
// =============================================================================

export interface SystemPromptParams {
    agentName: string;
    agentId: string;
    workspaceRoot?: string;
    tools: Tool[];
    customPrompt?: string;
    dateTime?: string;
    platform?: string;
}

export function buildSystemPrompt(params: SystemPromptParams): string {
    const sections: string[] = [];

    // Identity
    sections.push(`You are ${params.agentName}, an AI assistant.`);

    // Date/time
    const dateTime = params.dateTime || new Date().toISOString();
    sections.push(`Current date/time: ${dateTime}`);

    // Platform
    if (params.platform) {
        sections.push(`Platform: ${params.platform}`);
    }

    // Workspace
    if (params.workspaceRoot) {
        sections.push(`Workspace: ${params.workspaceRoot}`);
    }

    // Custom prompt
    if (params.customPrompt) {
        sections.push("", params.customPrompt);
    }

    // Tools
    if (params.tools.length > 0) {
        sections.push("");
        sections.push("You have access to the following tools:");
        for (const tool of params.tools) {
            sections.push(`- ${tool.name}: ${tool.description}`);
        }
    }

    return sections.join("\n");
}

// =============================================================================
// Agent
// =============================================================================

export class Agent extends EventEmitter {
    readonly config: AgentConfig;
    private toolRegistry: ToolRegistry;
    private sessionStore: SessionStore;
    private completionProvider?: CompletionProvider;

    constructor(
        config: AgentConfig,
        toolRegistry: ToolRegistry,
        sessionStore?: SessionStore
    ) {
        super();
        this.config = config;
        this.toolRegistry = toolRegistry;
        this.sessionStore = sessionStore || new SessionStore();
    }

    setCompletionProvider(provider: CompletionProvider): void {
        this.completionProvider = provider;
    }

    async run(options: AgentRunOptions): Promise<AgentRunResult> {
        if (!this.completionProvider) {
            throw new Error("No completion provider set");
        }

        const sessionId = options.sessionId || randomUUID();
        let session = await this.sessionStore.load(sessionId);

        if (!session) {
            session = {
                id: sessionId,
                agentId: this.config.id,
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        // Get available tools
        const toolNames = this.config.tools || this.toolRegistry.list();
        const tools = this.toolRegistry.getByNames(toolNames);

        // Build system prompt
        const systemPrompt = buildSystemPrompt({
            agentName: this.config.name,
            agentId: this.config.id,
            workspaceRoot: this.config.workspaceRoot,
            tools,
            customPrompt: this.config.systemPrompt,
            dateTime: new Date().toISOString(),
            platform: `${os.platform()} ${os.arch()}`,
        });

        // Add user message
        const userMessage: Message = { role: "user", content: options.input };
        session.messages.push(userMessage);
        options.onMessage?.(userMessage);

        const toolsUsed: string[] = [];
        let turns = 0;
        const maxTurns = options.maxTurns || DEFAULT_MAX_TURNS;

        while (turns < maxTurns) {
            if (options.abortSignal?.aborted) {
                throw new Error("Aborted");
            }

            turns++;

            // Build messages for completion
            const messagesForCompletion: Message[] = [
                { role: "system", content: systemPrompt },
                ...session.messages,
            ];

            // Get completion
            const response = await this.completionProvider(
                messagesForCompletion,
                tools,
                this.config
            );

            // Add assistant message
            const assistantMessage: Message = {
                role: "assistant",
                content: response.content,
                toolCalls: response.toolCalls,
            };
            session.messages.push(assistantMessage);
            options.onMessage?.(assistantMessage);

            // Check for tool calls
            if (!response.toolCalls || response.toolCalls.length === 0) {
                // No tool calls, we're done
                break;
            }

            // Execute tool calls
            for (const tc of response.toolCalls) {
                const tool = this.toolRegistry.get(tc.name);
                if (!tool) {
                    const errorResult: Message = {
                        role: "tool",
                        content: `Error: Tool "${tc.name}" not found`,
                        toolCallId: tc.id,
                        name: tc.name,
                    };
                    session.messages.push(errorResult);
                    options.onMessage?.(errorResult);
                    continue;
                }

                toolsUsed.push(tc.name);
                options.onToolStart?.(tc.name, tc.input);

                const context: ToolContext = {
                    agentId: this.config.id,
                    sessionId,
                    workspaceRoot: this.config.workspaceRoot,
                    abortSignal: options.abortSignal,
                };

                let result: ToolResult;
                try {
                    result = await tool.execute(tc.input, context);
                } catch (err) {
                    result = {
                        success: false,
                        error: err instanceof Error ? err.message : String(err),
                    };
                }

                options.onToolEnd?.(tc.name, result);

                const toolMessage: Message = {
                    role: "tool",
                    content: result.success ? (result.output || "Success") : (result.error || "Failed"),
                    toolCallId: tc.id,
                    name: tc.name,
                };
                session.messages.push(toolMessage);
                options.onMessage?.(toolMessage);
            }
        }

        // Save session
        session.updatedAt = Date.now();
        await this.sessionStore.save(session);

        // Get final response
        const lastAssistantMessage = [...session.messages]
            .reverse()
            .find(m => m.role === "assistant");

        return {
            sessionId,
            messages: session.messages,
            finalResponse: lastAssistantMessage?.content || "",
            toolsUsed: [...new Set(toolsUsed)],
        };
    }

    async getSession(sessionId: string): Promise<Session | null> {
        return this.sessionStore.load(sessionId);
    }

    async clearSession(sessionId: string): Promise<void> {
        await this.sessionStore.delete(sessionId);
    }
}

// =============================================================================
// Built-in Tools
// =============================================================================

export const builtInTools: Tool[] = [
    {
        name: "read_file",
        description: "Read the contents of a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to read" },
            },
            required: ["path"],
        },
        execute: async (input, context) => {
            const { path: filePath } = input as { path: string };
            const fullPath = context.workspaceRoot
                ? path.resolve(context.workspaceRoot, filePath)
                : filePath;
            try {
                const content = await fs.readFile(fullPath, "utf8");
                return { success: true, output: content };
            } catch (err) {
                return { success: false, error: String(err) };
            }
        },
    },
    {
        name: "write_file",
        description: "Write content to a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to write to" },
                content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
        },
        execute: async (input, context) => {
            const { path: filePath, content } = input as { path: string; content: string };
            const fullPath = context.workspaceRoot
                ? path.resolve(context.workspaceRoot, filePath)
                : filePath;
            try {
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, content);
                return { success: true, output: `Wrote ${content.length} bytes to ${filePath}` };
            } catch (err) {
                return { success: false, error: String(err) };
            }
        },
    },
    {
        name: "list_directory",
        description: "List contents of a directory",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path" },
            },
            required: ["path"],
        },
        execute: async (input, context) => {
            const { path: dirPath } = input as { path: string };
            const fullPath = context.workspaceRoot
                ? path.resolve(context.workspaceRoot, dirPath)
                : dirPath;
            try {
                const entries = await fs.readdir(fullPath, { withFileTypes: true });
                const list = entries.map(e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`);
                return { success: true, output: list.join("\n") };
            } catch (err) {
                return { success: false, error: String(err) };
            }
        },
    },
    {
        name: "run_command",
        description: "Execute a shell command",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Command to run" },
                cwd: { type: "string", description: "Working directory" },
            },
            required: ["command"],
        },
        execute: async (input, context) => {
            const { command, cwd } = input as { command: string; cwd?: string };
            const workingDir = cwd || context.workspaceRoot || process.cwd();

            return new Promise((resolve) => {
                const { spawn } = require("node:child_process");
                const child = spawn("sh", ["-c", command], {
                    cwd: workingDir,
                    stdio: ["pipe", "pipe", "pipe"],
                });

                let stdout = "";
                let stderr = "";

                child.stdout?.on("data", (data: Buffer) => {
                    stdout += data.toString();
                });
                child.stderr?.on("data", (data: Buffer) => {
                    stderr += data.toString();
                });

                child.on("close", (code: number) => {
                    if (code === 0) {
                        resolve({ success: true, output: stdout || "Command completed" });
                    } else {
                        resolve({ success: false, error: stderr || `Exit code ${code}` });
                    }
                });

                child.on("error", (err: Error) => {
                    resolve({ success: false, error: err.message });
                });

                // Timeout
                setTimeout(() => {
                    child.kill();
                    resolve({ success: false, error: "Command timed out" });
                }, 60000);
            });
        },
    },
    {
        name: "search_files",
        description: "Search for files matching a pattern",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Glob pattern to match" },
                directory: { type: "string", description: "Directory to search in" },
            },
            required: ["pattern"],
        },
        execute: async (input, context) => {
            const { pattern, directory } = input as { pattern: string; directory?: string };
            const searchDir = directory || context.workspaceRoot || ".";

            // Simple recursive search
            const results: string[] = [];

            async function walk(dir: string, depth = 0): Promise<void> {
                if (depth > 10) return;
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                            await walk(fullPath, depth + 1);
                        } else if (entry.isFile()) {
                            if (entry.name.includes(pattern) || fullPath.includes(pattern)) {
                                results.push(fullPath);
                            }
                        }
                    }
                } catch {
                    // Ignore errors
                }
            }

            await walk(searchDir);
            return {
                success: true,
                output: results.length > 0 ? results.slice(0, 50).join("\n") : "No files found",
            };
        },
    },
];

// =============================================================================
// Agent Manager
// =============================================================================

export class AgentManager {
    private agents: Map<string, Agent> = new Map();
    private toolRegistry: ToolRegistry;
    private sessionStore: SessionStore;
    private completionProvider?: CompletionProvider;

    constructor(stateDir?: string) {
        this.toolRegistry = new ToolRegistry();
        this.sessionStore = new SessionStore(stateDir);

        // Register built-in tools
        for (const tool of builtInTools) {
            this.toolRegistry.register(tool);
        }
    }

    setCompletionProvider(provider: CompletionProvider): void {
        this.completionProvider = provider;
        for (const agent of this.agents.values()) {
            agent.setCompletionProvider(provider);
        }
    }

    registerTool(tool: Tool): void {
        this.toolRegistry.register(tool);
    }

    createAgent(config: AgentConfig): Agent {
        const agent = new Agent(config, this.toolRegistry, this.sessionStore);
        if (this.completionProvider) {
            agent.setCompletionProvider(this.completionProvider);
        }
        this.agents.set(config.id, agent);
        return agent;
    }

    getAgent(id: string): Agent | undefined {
        return this.agents.get(id);
    }

    listAgents(): AgentConfig[] {
        return Array.from(this.agents.values()).map(a => a.config);
    }

    listTools(): string[] {
        return this.toolRegistry.list();
    }
}

// =============================================================================
// Exports
// =============================================================================

export function createAgentManager(stateDir?: string): AgentManager {
    return new AgentManager(stateDir);
}

export function createToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    for (const tool of builtInTools) {
        registry.register(tool);
    }
    return registry;
}
