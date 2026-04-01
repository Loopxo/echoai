import { AgentKernel, AuditLogStore, SessionRegistry, type KernelCompletionProvider, type KernelMessage } from "@echoai/runtime";
import type { AIProvider, Message } from "../types/index.js";
import { permissionManager } from "../utils/permission-prompt.js";

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
      const content = await provider.complete(
        flattenMessages(toProviderMessages(request.messages)),
        {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        }
      );

      return { content };
    },
    async stream(request, onChunk) {
      let content = "";
      for await (const chunk of provider.chat(toProviderMessages(request.messages), {
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
  provider: AIProvider,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    stateNamespace?: string;
    onTextChunk?: (chunk: string) => void;
  } = {}
): AgentKernel {
  const namespace = options.stateNamespace ?? "runtime";
  return new AgentKernel({
    sessionRegistry: new SessionRegistry({ namespace }),
    auditLogStore: new AuditLogStore({ namespace }),
    completionProvider: createCompletionProvider(provider, options),
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
}

function flattenMessages(messages: Message[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}
