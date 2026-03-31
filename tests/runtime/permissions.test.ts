import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RuntimePermissionManager,
  classifyCommandRisk,
  createPermissionRequest,
} from "../../packages/runtime/src/index.ts";
import type { KernelSession, KernelTool, KernelToolCall } from "../../packages/runtime/src/index.ts";

function createSession(): KernelSession {
  return {
    id: "session-1",
    title: "Permission Test",
    mode: "default",
    messages: [],
    approvals: [],
    tasks: [],
    artifacts: [],
    background: { status: "idle" },
    worktree: { enabled: false },
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

function createTool(permission?: KernelTool["permission"]): KernelTool {
  return {
    name: "run_shell",
    description: "Run shell commands",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
    permission,
    async execute() {
      return { success: true, output: "ok" };
    },
  };
}

describe("classifyCommandRisk", () => {
  it("marks destructive commands as critical", () => {
    expect(classifyCommandRisk("rm -rf ./dist")).toBe("critical");
    expect(classifyCommandRisk("git reset --hard HEAD")).toBe("critical");
  });

  it("marks ordinary reads as low risk", () => {
    expect(classifyCommandRisk("ls -la")).toBe("low");
  });
});

describe("RuntimePermissionManager", () => {
  it("escalates high-risk process work to ask", () => {
    const tool = createTool({ process: "allow" });
    const call: KernelToolCall = {
      id: "call-1",
      name: "run_shell",
      input: { command: "rm -rf ./dist" },
    };
    const request = createPermissionRequest(tool, call, createSession(), process.cwd());

    expect(request.scope).toBe("process");
    expect(request.risk).toBe("critical");
    expect(request.decision).toBe("ask");
  });

  it("respects allow rules for matching reads", () => {
    const workspaceRoot = process.cwd();
    const manager = new RuntimePermissionManager({
      profile: { read: "ask" },
      rules: [
        {
          id: "allow-readme",
          scope: "read",
          pattern: "README\\.md$",
          decision: "allow",
          description: "Allow reading the project readme",
        },
      ],
    });

    const tool: KernelTool = {
      name: "read_file",
      description: "Read files",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
      permission: { read: "ask" },
      async execute() {
        return { success: true, output: "ok" };
      },
    };

    const evaluation = manager.evaluate(
      tool,
      { id: "call-2", name: "read_file", input: { path: "README.md" } },
      createSession(),
      workspaceRoot
    );

    expect(evaluation.finalDecision).toBe("allow");
  });

  it("classifies writes outside the workspace as high risk", () => {
    const workspaceRoot = process.cwd();
    const manager = new RuntimePermissionManager();
    const homeDirTarget = path.join(os.homedir(), "outside.txt");
    const tool: KernelTool = {
      name: "write_file",
      description: "Write files",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
      permission: { write: "ask" },
      async execute() {
        return { success: true, output: "ok" };
      },
    };

    const evaluation = manager.evaluate(
      tool,
      { id: "call-3", name: "write_file", input: { path: homeDirTarget, content: "hello" } },
      createSession(),
      workspaceRoot
    );

    expect(evaluation.request.scope).toBe("write");
    expect(evaluation.request.risk).toBe("high");
  });
});
