import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentKernel,
  AuditLogStore,
  SessionRegistry,
  createBuiltInTools,
} from "../../packages/runtime/src/index.ts";

const tempDirs: string[] = [];

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-runtime-tools-"));
  tempDirs.push(dir);
  await fs.writeFile(path.join(dir, "hello.txt"), "hello world\n", "utf8");
  await fs.mkdir(path.join(dir, "nested"), { recursive: true });
  await fs.writeFile(path.join(dir, "nested", "example.ts"), "export const value = 1;\n", "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("createBuiltInTools", () => {
  it("reads, greps, and patches files within the workspace", async () => {
    const workspaceRoot = await createWorkspace();
    const tools = createBuiltInTools({ workspaceRoot });
    const session = {
      id: "session-1",
      title: "Tool test",
      mode: "default" as const,
      messages: [],
      approvals: [],
      tasks: [],
      artifacts: [],
      background: { status: "idle" as const },
      worktree: { enabled: false },
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const context = { session, workspaceRoot };
    const read = tools.find((tool) => tool.name === "read_file");
    const grep = tools.find((tool) => tool.name === "grep_search");
    const patch = tools.find((tool) => tool.name === "apply_patch");

    const readResult = await read!.execute({ path: "hello.txt" }, context);
    expect(readResult.output).toContain("hello world");

    const grepResult = await grep!.execute({ pattern: "value", basePath: "." }, context);
    expect(grepResult.output).toContain("nested/example.ts:1");

    const patchText = [
      "--- hello.txt",
      "+++ hello.txt",
      "@@ -1,1 +1,1 @@",
      "-hello world",
      "+hello runtime",
      "",
    ].join("\n");
    const patchResult = await patch!.execute({ path: "hello.txt", patch: patchText }, context);
    expect(patchResult.success).toBe(true);

    const updated = await fs.readFile(path.join(workspaceRoot, "hello.txt"), "utf8");
    expect(updated).toContain("hello runtime");
  });
});

describe("AgentKernel audit integration", () => {
  it("records audit entries for allowed tool execution", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new SessionRegistry({ stateDir: workspaceRoot, namespace: "runtime-test" });
    const auditLog = new AuditLogStore({ stateDir: workspaceRoot, namespace: "runtime-test" });
    const kernel = new AgentKernel({
      sessionRegistry: registry,
      auditLogStore: auditLog,
      registryOptions: { stateDir: workspaceRoot, namespace: "runtime-test" },
      registerBuiltInTools: false,
      completionProvider: {
        async complete(request) {
          const hasToolResult = request.messages.some((message) => message.role === "tool");
          if (!hasToolResult) {
            return {
              content: "Inspecting workspace files",
              toolCalls: [
                {
                  id: "read-call",
                  name: "read_file",
                  input: { path: "hello.txt" },
                },
              ],
            };
          }
          return {
            content: "Done",
          };
        },
      },
    });

    for (const tool of createBuiltInTools({ workspaceRoot })) {
      kernel.tools.register(tool);
    }

    await kernel.run({
      input: "Read the workspace greeting",
      workspaceRoot,
      title: "Audit test",
    });

    const entries = await auditLog.readAll();
    expect(entries.some((entry) => entry.type === "permission")).toBe(true);
    expect(entries.some((entry) => entry.type === "tool")).toBe(true);
  });
});
