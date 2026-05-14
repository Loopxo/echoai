import {
  AgentKernel,
  AuditLogStore,
  RuntimePermissionManager,
  SessionRegistry,
  type KernelTool,
  type KernelCompletionProvider,
  type KernelMessage,
  type KernelSessionMode,
} from "@echoai/runtime";
import type { AIProvider, Message, ProviderToolDefinition, StructuredMessage, StructuredToolCall } from "../types/index.js";
import { permissionManager } from "../utils/permission-prompt.js";

interface CliSystemPromptConfig {
  basePrompt?: string;
  sections?: Array<{
    name: string;
    mode: "static" | "dynamic";
    compute(context: {
      session: unknown;
      workspaceRoot?: string;
      currentDate: string;
      sessionMemory?: string;
    }): Promise<string | null> | string | null;
  }>;
}

function isProviderCompatibleRole(
  role: KernelMessage["role"]
): role is Message["role"] {
  return role === "system" || role === "user" || role === "assistant";
}

function toProviderMessages(messages: KernelMessage[]): Message[] {
  const providerMessages: Message[] = [];

  for (const message of messages) {
    if (!isProviderCompatibleRole(message.role)) {
      continue;
    }

    providerMessages.push({
      role: message.role,
      content: message.content,
      timestamp: new Date(message.createdAt),
    });
  }

  return providerMessages;
}

function toStructuredMessages(messages: KernelMessage[]): StructuredMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt),
    name: message.name,
    toolCallId: message.toolCallId,
    toolCalls: message.toolCalls?.map((toolCall): StructuredToolCall => ({
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
    })),
  }));
}

function prependSystemPrompt(
  messages: KernelMessage[],
  systemPrompt?: string
): KernelMessage[] {
  if (!systemPrompt?.trim()) {
    return messages;
  }

  return [
    {
      id: "__system_prompt__",
      role: "system",
      content: systemPrompt,
      createdAt: Date.now(),
    },
    ...messages,
  ];
}

function toProviderTools(
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
): ProviderToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function createCompletionProvider(
  provider: AIProvider,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    onTextChunk?: (chunk: string) => void;
  }
): KernelCompletionProvider {
  return {
    async complete(request) {
      const requestMessages = prependSystemPrompt(request.messages, request.systemPrompt);

      if (provider.completeWithTools) {
        return provider.completeWithTools(toStructuredMessages(requestMessages), {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          stream: false,
          tools: toProviderTools(request.tools),
        });
      }

      const content = await provider.complete(
        flattenMessages(toProviderMessages(requestMessages)),
        {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        }
      );

      return { content };
    },
    async stream(request, onChunk) {
      const requestMessages = prependSystemPrompt(request.messages, request.systemPrompt);

      if (provider.streamWithTools) {
        const result = await provider.streamWithTools(
          toStructuredMessages(requestMessages),
          {
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            stream: options.stream !== false,
            tools: toProviderTools(request.tools),
          },
          (chunk) => {
            if (chunk.type === "text") {
              options.onTextChunk?.(chunk.text);
              onChunk({ type: "text", text: chunk.text });
              return;
            }

            onChunk({
              type: "tool_call",
              toolCall: {
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                input: chunk.toolCall.input,
              },
            });
          }
        );

        return result;
      }

      let content = "";
      for await (const chunk of provider.chat(toProviderMessages(requestMessages), {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: options.stream !== false,
      })) {
        content += chunk;
        options.onTextChunk?.(chunk);
        onChunk({ type: "text", text: chunk });
      }
      return { content };
    },
  };
}

export function createCliKernel(
  options: {
    provider?: AIProvider;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    stateNamespace?: string;
    onTextChunk?: (chunk: string) => void;
    registerBuiltInTools?: boolean;
    runtimeMode?: KernelSessionMode;
  } = {}
): AgentKernel {
  const namespace = options.stateNamespace ?? "runtime";
  const defaultSystemPrompt = createDefaultSystemPrompt(options.runtimeMode);
  const kernel = new AgentKernel({
    sessionRegistry: new SessionRegistry({ namespace }),
    auditLogStore: new AuditLogStore({ namespace }),
    registerBuiltInTools: options.registerBuiltInTools,
    permissionManager: new RuntimePermissionManager({
      profile: options.runtimeMode === "plan"
        ? { read: "allow", write: "deny", process: "ask", network: "ask" }
        : undefined,
    }),
    approvalResolver: async ({ permissionRequest }) => {
      const response = await permissionManager.requestPermission({
        action: `${permissionRequest.scope}:${permissionRequest.toolName}`,
        description: permissionRequest.reason,
        files: permissionRequest.resource ? [permissionRequest.resource] : undefined,
        risk: permissionRequest.risk === "critical" ? "high" : permissionRequest.risk,
      });

      return {
        decision: response.approved ? "approved" : "denied",
        reason: response.reason,
      };
    },
  });

  if (options.provider) {
    kernel.setCompletionProvider(createCompletionProvider(options.provider, options));
  }

  const originalRun = kernel.run.bind(kernel);
  kernel.run = ((runOptions) => originalRun({
    ...runOptions,
    systemPrompt: mergeSystemPrompt(defaultSystemPrompt, (runOptions as any).systemPrompt),
  } as any)) as typeof kernel.run;

  const originalRunEvents = kernel.runEvents.bind(kernel);
  kernel.runEvents = ((runOptions) => originalRunEvents({
    ...runOptions,
    systemPrompt: mergeSystemPrompt(defaultSystemPrompt, (runOptions as any).systemPrompt),
  } as any)) as typeof kernel.runEvents;

  return kernel;
}

export function createCliRuntimeKernel(
  options: Omit<Parameters<typeof createCliKernel>[0], "provider"> = {}
): AgentKernel {
  return createCliKernel(options);
}

export async function registerConfiguredMcpTools(kernel: AgentKernel): Promise<void> {
  const { MCPManager } = await import("../mcp/manager.js");
  const manager = new MCPManager();
  await manager.initialize();

  for (const tool of manager.getAvailableTools()) {
    const runtimeName = sanitizeRuntimeToolName(`mcp__${tool.name}`);
    const runtimeTool: KernelTool = {
      name: runtimeName,
      description: `[MCP] ${tool.description || tool.name}`,
      inputSchema: tool.inputSchema || { type: "object", properties: {} },
      permission: {
        process: "ask",
        network: "ask",
      },
      execute: async (input) => {
        try {
          const result = await manager.callTool(tool.name, input);
          return {
            success: true,
            output: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            summary: `MCP tool ${tool.name} completed`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "MCP tool failed",
          };
        }
      },
    };
    kernel.tools.register(runtimeTool);
  }
}

function flattenMessages(messages: Message[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function sanitizeRuntimeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function createDefaultSystemPrompt(runtimeMode: KernelSessionMode = "default"): CliSystemPromptConfig {
  return {
    basePrompt: [
      "You are EchoAI, a coding assistant operating inside the user's local workspace.",
      "Prefer concrete actions over vague guidance.",
      "Keep edits safe, incremental, and aligned with the current project.",
      runtimeMode === "plan"
        ? "You are in plan mode. Do not edit files. Inspect the workspace and propose exact changes only."
        : "You are in build mode. You may edit files through approved tools when needed to complete the task.",
    ].join("\n"),
    sections: [
      {
        name: "runtime-rules",
        mode: "static",
        compute: () =>
          [
            "When tools are available, use them to inspect the workspace before making assumptions.",
            "For coding tasks, follow inspect -> plan -> edit -> test -> review -> final.",
            "Before edits, state a short plan unless the user explicitly asks to skip planning.",
            "After edits, summarize changed files, checks run, remaining risks, and the next useful action.",
            "Prefer apply_patch or multi_edit over whole-file rewrites when a focused patch is enough.",
            "Use run_tests, run_lint, run_typecheck, and get_diagnostics when they are relevant instead of guessing raw shell commands.",
            "Prefer concise, high-signal responses and preserve user work.",
          ].join("\n"),
      },
      {
        name: "project-instructions",
        mode: "static",
        compute: async ({ workspaceRoot }) => {
          if (!workspaceRoot) return null;
          try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const content = await fs.readFile(path.join(workspaceRoot, "ECHOAI.md"), "utf8");
            return `Project Instructions (from ECHOAI.md):\n${content.trim()}`;
          } catch {
            return null;
          }
        }
      },
      {
        name: "project-memory",
        mode: "dynamic",
        compute: async ({ workspaceRoot }) => {
          if (!workspaceRoot) return null;
          try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const content = await fs.readFile(path.join(workspaceRoot, ".echoai", "memory.jsonl"), "utf8");
            const entries = content
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(-20)
              .map((line) => {
                try {
                  const parsed = JSON.parse(line) as { content?: unknown; source?: unknown };
                  return typeof parsed.content === "string"
                    ? `- ${parsed.content}${typeof parsed.source === "string" ? ` (source: ${parsed.source})` : ""}`
                    : null;
                } catch {
                  return null;
                }
              })
              .filter(Boolean);
            return entries.length > 0 ? `Project memory:\n${entries.join("\n")}` : null;
          } catch {
            return null;
          }
        },
      },
      {
        name: "environment",
        mode: "dynamic",
        compute: ({ workspaceRoot, currentDate }: { workspaceRoot?: string; currentDate: string }) =>
          [
            `Current date: ${currentDate}`,
            workspaceRoot ? `Workspace root: ${workspaceRoot}` : null,
          ].filter(Boolean).join("\n"),
      },
      {
        name: "session-memory",
        mode: "dynamic",
        compute: ({ sessionMemory }: { sessionMemory?: string }) =>
          sessionMemory ? `Session memory:\n${sessionMemory}` : null,
      },
    ],
  };
}

function mergeSystemPrompt(
  base: CliSystemPromptConfig,
  override?: string | CliSystemPromptConfig
): CliSystemPromptConfig {
  if (!override) {
    return base;
  }

  if (typeof override === "string") {
    return {
      basePrompt: [base.basePrompt, override].filter(Boolean).join("\n\n"),
      sections: base.sections,
    };
  }

  return {
    basePrompt: [base.basePrompt, override.basePrompt].filter(Boolean).join("\n\n"),
    sections: [...(base.sections ?? []), ...(override.sections ?? [])],
  };
}
