import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LspManager,
  detectLanguageForPath,
  detectLanguageServerReadiness,
  fileUriToPath,
  pathToFileUri,
  positionFromLineColumn,
  shutdownAllLspManagers,
} from "../../packages/lsp/src/index.ts";

const tempDirs: string[] = [];

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-lsp-"));
  tempDirs.push(dir);
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  await fs.writeFile(path.join(dir, "example.ts"), "export const value: number = 1;\n", "utf8");
  return dir;
}

afterEach(async () => {
  await shutdownAllLspManagers();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("@echoai/lsp", () => {
  it("converts file paths, positions, and language ids deterministically", async () => {
    const workspace = await createWorkspace();
    const filePath = path.join(workspace, "example.ts");
    expect(fileUriToPath(pathToFileUri(filePath))).toBe(filePath);
    expect(positionFromLineColumn(3, 5)).toEqual({ line: 2, character: 4 });
    expect(detectLanguageForPath("component.tsx")).toBe("typescript");
    expect(detectLanguageForPath("script.py")).toBe("python");
    expect(detectLanguageForPath("README.md")).toBeNull();
  });

  it("reports readiness for supported language servers without requiring bundled servers", async () => {
    const workspace = await createWorkspace();
    const readiness = await detectLanguageServerReadiness(workspace);
    expect(readiness.map((entry) => entry.id)).toEqual(["typescript", "python", "go", "rust"]);
    for (const entry of readiness) {
      expect(entry.install.length).toBeGreaterThan(0);
      expect(entry.command.length).toBeGreaterThan(0);
    }
  });

  it("returns a structured unavailable result when a matching language server is missing", async () => {
    const workspace = await createWorkspace();
    const manager = new LspManager(workspace);
    const result = await manager.getDiagnostics({ path: "example.ts", timeoutMs: 10 });
    expect(typeof result.available).toBe("boolean");
    if (!result.available) {
      expect(result.reason?.length).toBeGreaterThan(0);
      expect(result.data).toEqual([]);
    }
    await manager.dispose();
  });
});
