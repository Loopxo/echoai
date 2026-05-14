import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MCPManager } from "../../src/mcp/manager.js";

const tempDirs: string[] = [];
const originalStateDir = process.env.ECHOAI_STATE_DIR;

afterEach(async () => {
  if (originalStateDir === undefined) {
    delete process.env.ECHOAI_STATE_DIR;
  } else {
    process.env.ECHOAI_STATE_DIR = originalStateDir;
  }
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("MCPManager", () => {
  it("does not create default stdio servers for an empty config", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-mcp-"));
    tempDirs.push(stateDir);
    process.env.ECHOAI_STATE_DIR = stateDir;

    const manager = new MCPManager();
    await manager.initialize();

    expect(manager.listServers()).toEqual([]);
    expect(manager.getAvailableTools()).toEqual([]);

    await manager.shutdown();
  });
});
