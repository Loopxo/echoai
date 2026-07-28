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

function createWriteTool(permission?: KernelTool["permission"]): KernelTool {
  return {
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
    permission: permission ?? { write: "ask" },
    async execute() {
      return { success: true, output: "ok" };
    },
  };
}

describe("permission profile enforcement", () => {
  const workspaceRoot = process.cwd();

  it("honours a profile that denies writes instead of falling back to ask", () => {
    // Plan mode passes { read: "allow", write: "deny", ... }. The profile used
    // to be assigned and never read, so plan mode silently degraded to "ask".
    const manager = new RuntimePermissionManager({
      profile: { read: "allow", write: "deny", network: "ask", process: "ask" },
    });

    const evaluation = manager.evaluate(
      createWriteTool(),
      {
        id: "call-deny-1",
        name: "write_file",
        input: { path: "src/example.ts", content: "hello" },
      },
      createSession(),
      workspaceRoot
    );

    expect(evaluation.finalDecision).toBe("deny");
  });

  it("does not let a safe-path heuristic widen an explicit deny", () => {
    const manager = new RuntimePermissionManager({
      profile: { read: "allow", write: "deny", network: "ask", process: "ask" },
    });

    // README.md matches the safe-write globs, which previously produced an
    // "allow" that overrode the profile's deny.
    const evaluation = manager.evaluate(
      createWriteTool(),
      {
        id: "call-deny-2",
        name: "write_file",
        input: { path: "README.md", content: "hello" },
      },
      createSession(),
      workspaceRoot
    );

    expect(evaluation.finalDecision).toBe("deny");
    expect(evaluation.resolvedBy).toBe("default");
  });

  it("still auto-approves documentation writes under the default profile", () => {
    const manager = new RuntimePermissionManager();

    const evaluation = manager.evaluate(
      createWriteTool(),
      {
        id: "call-allow-1",
        name: "write_file",
        input: { path: "docs/notes.md", content: "hello" },
      },
      createSession(),
      workspaceRoot
    );

    expect(evaluation.finalDecision).toBe("allow");
    expect(evaluation.resolvedBy).toBe("safe_path");
  });

  it("never auto-approves build-critical writes", () => {
    const manager = new RuntimePermissionManager();

    // package.json used to match the `.json` safe-write glob, so the agent
    // could rewrite `scripts` with no prompt and no approval record.
    for (const target of [
      "package.json",
      "tsconfig.json",
      ".github/workflows/ci.yml",
      ".env",
      "pnpm-lock.yaml",
    ]) {
      const evaluation = manager.evaluate(
        createWriteTool(),
        {
          id: `call-critical-${target}`,
          name: "write_file",
          input: { path: target, content: "hello" },
        },
        createSession(),
        workspaceRoot
      );

      expect(evaluation.finalDecision, `${target} must not auto-approve`).not.toBe("allow");
    }
  });

  it("keeps an explicit rule authoritative over the profile", () => {
    const manager = new RuntimePermissionManager({
      profile: { read: "allow", write: "deny", network: "ask", process: "ask" },
      rules: [
        {
          id: "allow-scratch",
          scope: "write",
          pattern: "scratch/",
          decision: "allow",
          description: "Scratch directory is always writable",
        },
      ],
    });

    const evaluation = manager.evaluate(
      createWriteTool(),
      {
        id: "call-rule-1",
        name: "write_file",
        input: { path: "scratch/tmp.ts", content: "hello" },
      },
      createSession(),
      workspaceRoot
    );

    expect(evaluation.finalDecision).toBe("allow");
    expect(evaluation.resolvedBy).toBe("rule");
  });
});
