import { randomUUID } from "node:crypto";
import type {
  KernelPermissionPolicy,
  KernelTool,
  KernelToolCall,
  KernelToolResult,
  PermissionDecision,
} from "./types.js";

export const DEFAULT_PERMISSION_POLICY: KernelPermissionPolicy = {
  read: "allow",
  write: "ask",
  network: "ask",
  process: "ask",
};

export class ToolRegistry {
  private readonly tools = new Map<string, KernelTool>();

  register(tool: KernelTool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): KernelTool | undefined {
    return this.tools.get(name);
  }

  list(): KernelTool[] {
    return Array.from(this.tools.values());
  }

  toDefinitions(): Array<{
    name: string;
    description: string;
    parameters: KernelTool["inputSchema"];
  }> {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }
}

export function createToolCall(name: string, input: Record<string, unknown>): KernelToolCall {
  return {
    id: randomUUID(),
    name,
    input,
  };
}

export function mergePermissionPolicy(
  base: KernelPermissionPolicy = DEFAULT_PERMISSION_POLICY,
  override?: Partial<KernelPermissionPolicy>
): KernelPermissionPolicy {
  return {
    read: override?.read ?? base.read,
    write: override?.write ?? base.write,
    network: override?.network ?? base.network,
    process: override?.process ?? base.process,
  };
}

export function getStrictestDecision(
  ...decisions: PermissionDecision[]
): PermissionDecision {
  if (decisions.includes("deny")) {
    return "deny";
  }
  if (decisions.includes("ask")) {
    return "ask";
  }
  return "allow";
}

export function summarizeToolResult(result: KernelToolResult): string {
  if (result.summary) {
    return result.summary;
  }
  if (result.success) {
    return result.output ?? "Tool completed successfully";
  }
  return result.error ?? "Tool failed";
}
