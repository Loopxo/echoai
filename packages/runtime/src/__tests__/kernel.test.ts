import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentKernel } from "../kernel.js";
import { compactSession } from "../compaction.js";
import {
  PermissionResolverOrchestrator,
  RuntimePermissionManager,
  createSafetyClassifierResolver,
  type PermissionResolver,
} from "../permissions.js";
import { resolveSystemPrompt } from "../prompting.js";
import { SessionMemoryStore } from "../session-memory.js";
import type {
  KernelPermissionHookPayload,
  KernelSession,
  KernelTool,
  KernelToolAfterHookPayload,
  KernelToolBeforeHookPayload,
} from "../types.js";
import { HOOK_EVENTS } from "@echoai/hooks";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("AgentKernel", () => {
  it("runs read-only tool calls in parallel and persists session events", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-runtime-"));
    tempDirs.push(stateDir);

    const kernel = new AgentKernel({
      registerBuiltInTools: false,
      registryOptions: { stateDir, namespace: "runtime-test" },
    });

    const starts: number[] = [];
    const ends: number[] = [];
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const readTool = (name: string): KernelTool => ({
      name,
      description: `Read tool ${name}`,
      inputSchema: { type: "object", properties: {} },
      permission: { read: "allow" },
      async execute() {
        starts.push(Date.now());
        await delay(40);
        ends.push(Date.now());
        return { success: true, output: name };
      },
    });

    kernel.tools.register(readTool("read_alpha"));
    kernel.tools.register(readTool("read_beta"));

    let turn = 0;
    kernel.setCompletionProvider({
      async complete() {
        turn += 1;
        if (turn === 1) {
          return {
            content: "",
            toolCalls: [
              { id: "call-1", name: "read_alpha", input: {} },
              { id: "call-2", name: "read_beta", input: {} },
            ],
          };
        }

        return { content: "done" };
      },
    });

    const result = await kernel.run({ input: "inspect workspace", workspaceRoot: stateDir });
    expect(result.toolCalls).toBe(2);
    expect(result.response).toBe("done");
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(25);
    expect(Math.min(...ends)).toBeGreaterThanOrEqual(Math.max(...starts));

    const events = await kernel.sessions.readEventLog(result.session.id);
    expect(events.some((event) => event.type === "session.created")).toBe(true);
    expect(events.some((event) => event.type === "message.created")).toBe(true);
    expect(events.filter((event) => event.type === "tool.completed")).toHaveLength(2);
  });

  it("wires pre and post tool hooks into execution", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-hooks-"));
    tempDirs.push(stateDir);

    const kernel = new AgentKernel({
      registerBuiltInTools: false,
      registryOptions: { stateDir, namespace: "runtime-test" },
    });

    kernel.tools.register({
      name: "write_note",
      description: "Write a note",
      inputSchema: { type: "object", properties: {} },
      permission: { write: "ask" },
      async execute(input) {
        return {
          success: true,
          output: `${String(input.path)}:${String(input.content)}`,
        };
      },
    });

    kernel.hooks.on<KernelToolBeforeHookPayload>(HOOK_EVENTS.TOOL_BEFORE, async (payload) => ({
      ...payload,
      call: {
        ...payload.call,
        input: {
          ...payload.call.input,
          content: "hooked-content",
        },
      },
    }));

    kernel.hooks.on<KernelToolAfterHookPayload>(HOOK_EVENTS.TOOL_AFTER, async (payload) => ({
      ...payload,
      result: {
        ...payload.result,
        output: `${payload.result.output}:after-hook`,
      },
    }));

    const session = await kernel.createSession("Hook Test");
    const result = await kernel.invokeTool(session.id, "write_note", {
      path: "notes/test.md",
      content: "original-content",
    }, {
      workspaceRoot: stateDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe("notes/test.md:hooked-content:after-hook");

    const reloaded = await kernel.getSession(session.id);
    expect(reloaded?.approvals).toHaveLength(0);
  });

  it("allows permission hooks to resolve approvals before interactive fallback", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-hook-approval-"));
    tempDirs.push(stateDir);

    const kernel = new AgentKernel({
      registerBuiltInTools: false,
      registryOptions: { stateDir, namespace: "runtime-test" },
      approvalResolver: async () => {
        throw new Error("interactive approval should not run");
      },
    });

    kernel.tools.register({
      name: "write_file",
      description: "Write a file",
      inputSchema: { type: "object", properties: {} },
      permission: { write: "ask" },
      async execute() {
        return { success: true, output: "written" };
      },
    });

    kernel.hooks.on<KernelPermissionHookPayload>(HOOK_EVENTS.PERMISSION_RESOLVE, async (payload) => ({
      ...payload,
      decision: {
        decision: "approved",
        reason: "Approved by hook",
        source: "hook",
        resolver: "hook",
      },
    }));

    const session = await kernel.createSession("Hook Approval");
    const result = await kernel.invokeTool(session.id, "write_file", {
      path: "src/guide.ts",
      content: "hello",
    }, {
      workspaceRoot: stateDir,
    });

    expect(result.success).toBe(true);

    const reloaded = await kernel.getSession(session.id);
    expect(reloaded?.approvals[0]?.decision).toBe("approved");
    expect(reloaded?.approvals[0]?.source).toBe("hook");
  });

  it("forks sessions with shared context and isolated worktrees", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-fork-state-"));
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-fork-workspace-"));
    tempDirs.push(stateDir, workspaceDir);

    await fs.writeFile(path.join(workspaceDir, "README.md"), "parent workspace");

    const kernel = new AgentKernel({
      registerBuiltInTools: false,
      registryOptions: { stateDir, namespace: "runtime-test" },
    });

    const parent = await kernel.createSession("Parent Session", "claude", "sonnet");
    parent.metadata.workspaceRoot = workspaceDir;
    await kernel.sessions.save(parent);
    await kernel.appendMessage(parent.id, "user", "Investigate the repo");

    const child = await kernel.forkSession(parent.id, {
      title: "Child Session",
      worktree: { enabled: true },
    });

    expect(child.metadata.parentSessionId).toBe(parent.id);
    expect(child.metadata.cacheShared).toBe(true);
    expect(child.messages).toHaveLength(1);
    expect(child.worktree.enabled).toBe(true);
    expect(child.worktree.path).toBeTruthy();

    const copiedFile = await fs.readFile(path.join(child.worktree.path!, "README.md"), "utf8");
    expect(copiedFile).toBe("parent workspace");
  });

  it("routes background shell tasks through the permission resolver", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-task-perm-"));
    tempDirs.push(stateDir);

    const kernel = new AgentKernel({
      registryOptions: { stateDir, namespace: "runtime-test" },
      approvalResolver: async () => ({
        decision: "denied",
        reason: "blocked for test",
      }),
    });

    const session = await kernel.createSession("Task Permission");
    session.metadata.workspaceRoot = stateDir;
    await kernel.sessions.save(session);

    await expect(
      kernel.startShellTask(session.id, "echo test")
    ).rejects.toThrow("blocked for test");

    const reloaded = await kernel.getSession(session.id);
    expect(reloaded?.tasks).toHaveLength(0);
    expect(reloaded?.approvals.at(-1)?.decision).toBe("denied");
  });

  it("rejects unmanaged task log paths from tampered task metadata", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-task-log-"));
    tempDirs.push(stateDir);

    const kernel = new AgentKernel({
      registerBuiltInTools: false,
      registryOptions: { stateDir, namespace: "runtime-test" },
    });

    const session = await kernel.createSession("Task Logs");
    session.tasks.push({
      id: "task-1",
      kind: "shell",
      title: "Tampered",
      status: "running",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        pid: 12345,
        logPath: "/etc/passwd",
        statusPath: "/tmp/status.json",
        runnerPath: "/tmp/runner.sh",
      },
    });
    await kernel.sessions.save(session);

    await expect(kernel.getTaskLog(session.id, "task-1")).rejects.toThrow("unmanaged log path");
  });

  it("blocks built-in file access outside the workspace root", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-builtin-paths-"));
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-workspace-"));
    tempDirs.push(stateDir, workspaceDir);

    const outsideFile = path.join(stateDir, "outside.txt");
    await fs.writeFile(outsideFile, "outside", "utf8");

    const kernel = new AgentKernel({
      registryOptions: { stateDir, namespace: "runtime-test" },
    });

    const session = await kernel.createSession("Workspace Guard");
    await expect(
      kernel.invokeTool(session.id, "read_file", {
        path: path.relative(workspaceDir, outsideFile),
      }, {
        workspaceRoot: workspaceDir,
      })
    ).rejects.toThrow("outside the workspace root");
  });
});

describe("RuntimePermissionManager", () => {
  it("honors higher-priority layered rules before lower-priority rules", () => {
    const manager = new RuntimePermissionManager({
      layeredRules: {
        policy: [
          {
            id: "policy-deny",
            scope: "write",
            pattern: "secrets\\.md$",
            decision: "deny",
            description: "Policy-level deny",
          },
        ],
        user: [
          {
            id: "user-allow",
            scope: "write",
            pattern: "secrets\\.md$",
            decision: "allow",
            description: "User-level allow",
          },
        ],
      },
    });

    const tool: KernelTool = {
      name: "write_file",
      description: "Write a file",
      inputSchema: { type: "object", properties: {} },
      permission: { write: "ask" },
      async execute() {
        return { success: true };
      },
    };

    const session = createEmptySession("perm-session");
    const evaluation = manager.evaluate(tool, {
      id: "call-1",
      name: "write_file",
      input: {
        path: "secrets.md",
        content: "classified",
      },
    }, session, "/tmp/workspace");

    expect(evaluation.finalDecision).toBe("deny");
    expect(evaluation.matchedRule?.id).toBe("policy-deny");
    expect(evaluation.resolvedBy).toBe("rule");
  });
});

describe("PermissionResolverOrchestrator", () => {
  it("returns the first resolver decision and ignores slower resolvers", async () => {
    const order: string[] = [];
    const slowResolver: PermissionResolver = {
      name: "slow",
      async resolve() {
        await new Promise((resolve) => setTimeout(resolve, 40));
        order.push("slow");
        return {
          decision: "denied",
          source: "slow",
          resolver: "slow",
        };
      },
    };
    const fastResolver: PermissionResolver = {
      name: "fast",
      async resolve() {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push("fast");
        return {
          decision: "approved",
          source: "fast",
          resolver: "fast",
        };
      },
    };

    const orchestrator = new PermissionResolverOrchestrator([slowResolver, fastResolver]);
    const session = createEmptySession("resolver-race");
    const tool: KernelTool = {
      name: "run_shell",
      description: "Run shell",
      inputSchema: { type: "object", properties: {} },
      permission: { process: "ask" },
      async execute() {
        return { success: true };
      },
    };

    const result = await orchestrator.resolve({
      session,
      tool,
      toolCall: {
        id: "call-1",
        name: "run_shell",
        input: { command: "pnpm exec vitest" },
      },
      permissionRequest: {
        id: "perm-1",
        sessionId: session.id,
        toolName: "run_shell",
        scope: "process",
        decision: "ask",
        risk: "medium",
        reason: "process access",
      },
    });

    expect(result?.decision).toBe("approved");
    expect(result?.source).toBe("fast");
    expect(order[0]).toBe("fast");
  });

  it("auto-approves known safe dev commands via the classifier resolver", async () => {
    const session = createEmptySession("classifier");
    const tool: KernelTool = {
      name: "run_shell",
      description: "Run shell",
      inputSchema: { type: "object", properties: {} },
      permission: { process: "ask" },
      async execute() {
        return { success: true };
      },
    };

    const resolver = createSafetyClassifierResolver();
    const result = await resolver.resolve({
      session,
      tool,
      toolCall: {
        id: "call-1",
        name: "run_shell",
        input: { command: "pnpm exec tsc --noEmit" },
      },
      permissionRequest: {
        id: "perm-1",
        sessionId: session.id,
        toolName: "run_shell",
        scope: "process",
        decision: "ask",
        risk: "medium",
        reason: "process access",
      },
    });

    expect(result?.decision).toBe("approved");
    expect(result?.source).toBe("classifier");
  });
});

describe("compactSession", () => {
  it("uses microcompact before summary collapse", async () => {
    const now = Date.now();
    const makeMessage = (offset: number, role: KernelSession["messages"][number]["role"], content: string) => ({
      id: `msg-${offset}`,
      role,
      content,
      createdAt: now + offset,
    });

    const session: KernelSession = {
      id: "session-1",
      title: "Compaction Test",
      mode: "default",
      messages: [
        makeMessage(1, "system", "system"),
        makeMessage(2, "user", "user 1"),
        makeMessage(3, "assistant", "assistant 1"),
        makeMessage(4, "tool", "tool 1"),
        makeMessage(5, "tool", "tool 2"),
        makeMessage(6, "assistant", "assistant 2"),
        makeMessage(7, "tool", "tool 3"),
        makeMessage(8, "user", "user 2"),
        makeMessage(9, "assistant", "assistant 3"),
        makeMessage(10, "tool", "tool 4"),
        makeMessage(11, "assistant", "assistant 4"),
      ],
      approvals: [],
      tasks: [],
      artifacts: [],
      background: { status: "idle" },
      worktree: { enabled: false },
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    const report = await compactSession(session, {
      maxMessages: 6,
      preserveHead: 2,
      preserveTail: 2,
    });

    expect(report.appliedStrategies).toContain("microcompact");
    expect(report.appliedStrategies).toContain("summary");
    expect(report.afterCount).toBeLessThanOrEqual(6);
    expect(report.summarizedMessages).toBeGreaterThan(0);
    expect(session.messages.some((message) => message.metadata?.compacted)).toBe(true);
  });
});

describe("resolveSystemPrompt", () => {
  it("caches static sections and recomputes dynamic sections", async () => {
    let staticCalls = 0;
    let dynamicCalls = 0;
    const session = createEmptySession("prompt-session");

    const first = await resolveSystemPrompt(session, {
      basePrompt: "base",
      sections: [
        {
          name: "static",
          mode: "static",
          compute: () => {
            staticCalls += 1;
            return "cached static";
          },
        },
        {
          name: "dynamic",
          mode: "dynamic",
          compute: ({ currentDate }) => {
            dynamicCalls += 1;
            return `date=${currentDate}`;
          },
        },
      ],
    }, {
      session,
      workspaceRoot: "/tmp/example",
      currentDate: "2026-04-01T00:00:00.000Z",
      sessionMemory: "memory one",
    });

    const second = await resolveSystemPrompt(session, {
      basePrompt: "base",
      sections: [
        {
          name: "static",
          mode: "static",
          compute: () => {
            staticCalls += 1;
            return "cached static";
          },
        },
        {
          name: "dynamic",
          mode: "dynamic",
          compute: ({ currentDate }) => {
            dynamicCalls += 1;
            return `date=${currentDate}`;
          },
        },
      ],
    }, {
      session,
      workspaceRoot: "/tmp/example",
      currentDate: "2026-04-02T00:00:00.000Z",
      sessionMemory: "memory two",
    });

    expect(first).toContain("cached static");
    expect(second).toContain("2026-04-02");
    expect(staticCalls).toBe(1);
    expect(dynamicCalls).toBe(2);
  });
});

describe("SessionMemoryStore", () => {
  it("writes summarized session memory to disk", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-memory-"));
    tempDirs.push(stateDir);

    const store = new SessionMemoryStore({ stateDir, namespace: "runtime-test" });
    const session = createEmptySession("memory-session");
    session.title = "Memory Session";
    session.provider = "claude";
    session.model = "sonnet";
    session.metadata.workspaceRoot = "/workspace";
    session.messages.push(
      { id: "u1", role: "user", content: "Investigate the payment retry failure", createdAt: Date.now() },
      { id: "a1", role: "assistant", content: "I will inspect the payment workflow and related files.", createdAt: Date.now() + 1 },
      { id: "t1", role: "tool", content: "Read src/payments/retry.ts", createdAt: Date.now() + 2, name: "read_file" },
    );

    const record = await store.write(session);
    expect(record.content).toContain("Investigate the payment retry failure");
    expect(record.content).toContain("/workspace");

    const loaded = await store.read(session.id);
    expect(loaded?.content).toContain("payment retry failure");
  });
});

function createEmptySession(id: string): KernelSession {
  const now = Date.now();
  return {
    id,
    title: id,
    mode: "default",
    messages: [],
    approvals: [],
    tasks: [],
    artifacts: [],
    background: { status: "idle" },
    worktree: { enabled: false },
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}
