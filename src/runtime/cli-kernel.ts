import { AgentKernel, AuditLogStore, SessionRegistry, type KernelCompletionProvider, type KernelMessage } from "@echoai/runtime";
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
  } = {}
): AgentKernel {
  const namespace = options.stateNamespace ?? "runtime";
  const defaultSystemPrompt = createDefaultSystemPrompt();
  const kernel = new AgentKernel({
    sessionRegistry: new SessionRegistry({ namespace }),
    auditLogStore: new AuditLogStore({ namespace }),
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

function flattenMessages(messages: Message[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function createDefaultSystemPrompt(): CliSystemPromptConfig {
  return {
    basePrompt: [
      "You are EchoAI, a coding assistant operating inside the user's local workspace.",
      "Prefer concrete actions over vague guidance.",
      "Keep edits safe, incremental, and aligned with the current project.",
    ].join("\n"),
    sections: [
      {
        name: "runtime-rules",
        mode: "static",
        compute: () =>
          [
            "When tools are available, use them to inspect the workspace before making assumptions.",
            "Prefer concise, high-signal responses and preserve user work.",
          ].join("\n"),
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
