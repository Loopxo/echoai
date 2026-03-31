import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentKernel,
  AuditLogStore,
  SessionRegistry,
  compactSession,
} from "../../packages/runtime/src/index.ts";

const tempDirs: string[] = [];

async function createStateDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-runtime-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("SessionRegistry", () => {
  it("persists and lists sessions", async () => {
    const stateDir = await createStateDir();
    const registry = new SessionRegistry({ stateDir, namespace: "kernel-test" });

    const session = await registry.create("Runtime Test", "openai", "gpt-4o-mini");
    const loaded = await registry.load(session.id);
    const sessions = await registry.list();

    expect(loaded?.title).toBe("Runtime Test");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(session.id);
  });
});

describe("AgentKernel", () => {
  it("runs a completion turn, executes tools, and persists results", async () => {
    const stateDir = await createStateDir();
    const registry = new SessionRegistry({ stateDir, namespace: "kernel-test" });
    const kernel = new AgentKernel({
      sessionRegistry: registry,
      auditLogStore: new AuditLogStore({ stateDir, namespace: "kernel-test" }),
      completionProvider: {
        async complete(request) {
          const hasToolResult = request.messages.some((message) => message.role === "tool");
          if (!hasToolResult) {
            return {
              content: "Reading project context before answering",
              toolCalls: [
                {
                  id: "call-1",
                  name: "read_project",
                  input: { target: "README.md" },
                },
              ],
            };
          }

          return {
            content: "Project context loaded successfully",
          };
        },
      },
    });

    kernel.tools.register({
      name: "read_project",
      description: "Load project context",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string" },
        },
        required: ["target"],
      },
      permission: {
        read: "allow",
      },
      async execute(input) {
        return {
          success: true,
          output: `loaded:${String(input.target)}`,
          summary: "Project context loaded",
        };
      },
    });

    const result = await kernel.run({
      input: "Summarize the project",
      title: "Kernel integration test",
      provider: "openai",
      model: "gpt-4o-mini",
    });

    expect(result.response).toBe("Project context loaded successfully");
    expect(result.toolCalls).toBe(1);
    expect(result.session.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);

    const persisted = await registry.load(result.session.id);
    expect(persisted?.messages).toHaveLength(4);
  });
});

describe("compactSession", () => {
  it("replaces middle messages with a summary when sessions get too large", () => {
    const session = {
      id: "session-1",
      title: "Compaction Test",
      mode: "default" as const,
      messages: Array.from({ length: 12 }, (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content: `message-${index}`,
        createdAt: index,
      })),
      approvals: [],
      tasks: [],
      artifacts: [],
      background: { status: "idle" as const },
      worktree: { enabled: false },
      metadata: {},
      createdAt: 1,
      updatedAt: 1,
    };

    const compacted = compactSession(session, {
      maxMessages: 8,
      preserveHead: 2,
      preserveTail: 3,
    });

    expect(compacted.messages).toHaveLength(6);
    expect(compacted.messages[2]?.content).toContain("Compacted session summary");
    expect(compacted.compactedAt).toBeTypeOf("number");
  });
});
