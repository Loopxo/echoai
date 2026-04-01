import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { applyPatch as applyTextPatch, createPatch } from "diff";
import type { KernelArtifact, KernelTool } from "./types.js";
import {
  ensureParentDirectory,
  ensurePathWithinWorkspace,
  resolveSafePath,
} from "./permissions.js";

interface BuiltInToolOptions {
  workspaceRoot?: string;
}

export function createBuiltInTools(options: BuiltInToolOptions = {}): KernelTool[] {
  return [
    createReadFileTool(options),
    createListDirectoryTool(options),
    createGlobTool(options),
    createGrepTool(options),
    createWriteFileTool(options),
    createApplyPatchTool(options),
    createRunShellTool(options),
  ];
}

function createReadFileTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "read_file",
    description: "Read a UTF-8 file from the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to read" },
      },
      required: ["path"],
    },
    permission: { read: "allow" },
    renderer: { kind: "file", collapsible: true },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const content = await fs.readFile(resolved, "utf8");
      return {
        success: true,
        output: content,
        summary: `Read ${targetPath}`,
      };
    },
  };
}

function createListDirectoryTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "list_directory",
    description: "List files and directories",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const output = entries
        .map((entry) => `${entry.isDirectory() ? "dir" : "file"}\t${entry.name}`)
        .join("\n");
      return {
        success: true,
        output,
        summary: `Listed ${entries.length} entries in ${targetPath}`,
      };
    },
  };
}

function createGlobTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "glob_search",
    description: "Search for files using a glob-style pattern",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern such as **/*.ts" },
        basePath: { type: "string", description: "Base directory to search from" },
      },
      required: ["pattern"],
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const pattern = requireString(input.pattern, "pattern");
      const basePath = typeof input.basePath === "string" ? input.basePath : ".";
      const resolvedBase = resolveWorkspacePath(basePath, context.workspaceRoot ?? options.workspaceRoot);
      const files = await walkFiles(resolvedBase);
      const relativeMatches = files
        .map((filePath) => path.relative(resolvedBase, filePath))
        .filter((relativePath) => globToRegExp(pattern).test(normalizeSlashes(relativePath)));

      return {
        success: true,
        output: relativeMatches.join("\n") || "No matches found",
        summary: `Found ${relativeMatches.length} file matches`,
      };
    },
  };
}

function createGrepTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "grep_search",
    description: "Search file contents with a regular expression",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regular expression to search for" },
        basePath: { type: "string", description: "Base directory to search from" },
      },
      required: ["pattern"],
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const pattern = new RegExp(requireString(input.pattern, "pattern"), "i");
      const basePath = typeof input.basePath === "string" ? input.basePath : ".";
      const resolvedBase = resolveWorkspacePath(basePath, context.workspaceRoot ?? options.workspaceRoot);
      const files = await walkFiles(resolvedBase);
      const matches: string[] = [];

      for (const filePath of files) {
        const content = await fs.readFile(filePath, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            matches.push(`${path.relative(resolvedBase, filePath)}:${index + 1}:${line}`);
          }
        });
      }

      return {
        success: true,
        output: matches.join("\n") || "No matches found",
        summary: `Found ${matches.length} matches`,
      };
    },
  };
}

function createWriteFileTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "write_file",
    description: "Write a UTF-8 file in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File to write" },
        content: { type: "string", description: "UTF-8 content" },
      },
      required: ["path", "content"],
    },
    permission: { write: "ask" },
    renderer: { kind: "diff", collapsible: false },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const content = requireString(input.content, "content");
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const previous = await safeReadFile(resolved);
      ensureParentDirectory(resolved);
      await fs.writeFile(resolved, content, "utf8");

      const artifacts = previous === null
        ? []
        : [createDiffArtifact(targetPath, previous, content)];

      return {
        success: true,
        output: `Wrote ${content.length} bytes to ${targetPath}`,
        artifacts,
        summary: `Updated ${targetPath}`,
      };
    },
  };
}

function createApplyPatchTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "apply_patch",
    description: "Apply a unified diff patch to a single file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target file" },
        patch: { type: "string", description: "Unified diff patch" },
      },
      required: ["path", "patch"],
    },
    permission: { write: "ask" },
    renderer: { kind: "diff", collapsible: false },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const patch = requireString(input.patch, "patch");
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const previous = await fs.readFile(resolved, "utf8");
      const next = applyTextPatch(previous, patch);

      if (next === false) {
        return {
          success: false,
          error: `Patch could not be applied to ${targetPath}`,
        };
      }

      await fs.writeFile(resolved, next, "utf8");
      return {
        success: true,
        output: `Applied patch to ${targetPath}`,
        artifacts: [createDiffArtifact(targetPath, previous, next)],
        summary: `Patched ${targetPath}`,
      };
    },
  };
}

function createRunShellTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "run_shell",
    description: "Run a shell command inside the workspace",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command" },
        cwd: { type: "string", description: "Working directory" },
        timeoutMs: { type: "number", description: "Timeout in milliseconds" },
      },
      required: ["command"],
    },
    permission: { process: "ask" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const command = requireString(input.command, "command");
      const cwd = typeof input.cwd === "string"
        ? resolveWorkspacePath(input.cwd, context.workspaceRoot ?? options.workspaceRoot)
        : context.workspaceRoot ?? options.workspaceRoot ?? process.cwd();
      const timeoutMs = typeof input.timeoutMs === "number" ? input.timeoutMs : 60_000;

      const result = await runCommand(command, cwd, timeoutMs);
      return {
        success: result.code === 0,
        output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
        error: result.code === 0 ? undefined : `Command exited with code ${result.code}`,
        summary: `Executed shell command: ${command}`,
      };
    },
  };
}

async function walkFiles(basePath: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".git") || entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(basePath, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(fullPath));
      continue;
    }
    results.push(fullPath);
  }

  return results;
}

function globToRegExp(pattern: string): RegExp {
  const normalized = normalizeSlashes(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, ".");
  return new RegExp(`^${normalized}$`);
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function resolveWorkspacePath(targetPath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    throw new Error("Workspace root is required for built-in file and shell tools");
  }
  ensurePathWithinWorkspace(targetPath, workspaceRoot);
  return resolveSafePath(targetPath, workspaceRoot);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

async function safeReadFile(targetPath: string): Promise<string | null> {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

function createDiffArtifact(filePath: string, before: string, after: string): KernelArtifact {
  return {
    id: path.basename(filePath),
    label: filePath,
    type: "diff",
    content: createPatch(filePath, before, after),
    createdAt: Date.now(),
  };
}

async function runCommand(command: string, cwd: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn("sh", ["-c", command], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        code: code ?? 0,
      });
    });
  });
}
