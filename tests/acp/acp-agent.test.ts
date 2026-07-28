import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EchoAcpAgent } from "../../src/cli/acp.ts";

const tempDirs: string[] = [];
const previousStateDir = process.env.ECHOAI_STATE_DIR;

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-acp-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  process.env.ECHOAI_STATE_DIR = previousStateDir;
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("EchoAcpAgent", () => {
  it("implements initialize, persisted session lifecycle, pagination, and mode changes", async () => {
    const workspaceRoot = await createWorkspace();
    process.env.ECHOAI_STATE_DIR = workspaceRoot;
    const updates: unknown[] = [];
    const client = {
      async sessionUpdate(params: unknown) {
        updates.push(params);
      },
    };
    const agent = new EchoAcpAgent(client as never, { workspaceRoot });

    const initialized = await agent.initialize({ protocolVersion: 1 });
    expect(initialized.agentInfo?.name).toBe("EchoAI");
    expect(initialized.agentCapabilities?.loadSession).toBe(true);

    const created = await agent.newSession({ cwd: workspaceRoot, mcpServers: [] });
    expect(created.sessionId).toBeTruthy();
    expect(created.modes?.availableModes.map((mode) => mode.id)).toContain("plan");

    await agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });
    const listed = await agent.listSessions({ cwd: workspaceRoot });
    expect(listed.sessions.map((session) => session.sessionId)).toContain(created.sessionId);
    expect(listed.nextCursor).toBeNull();

    const loaded = await agent.loadSession({ sessionId: created.sessionId, cwd: workspaceRoot, mcpServers: [] });
    expect(loaded.modes?.currentModeId).toBe("plan");
    expect(JSON.stringify(updates)).toContain("session_info_update");
  });
});
