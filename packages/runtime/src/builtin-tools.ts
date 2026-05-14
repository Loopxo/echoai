import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { applyPatch as applyTextPatch, createPatch } from "diff";
import {
  getSharedLspManager,
  positionFromLineColumn,
  type LspDiagnostic,
  type LspLocation,
  type LspSymbol,
} from "@echoai/lsp";
import type { KernelArtifact, KernelTool } from "./types.js";
import { createTodoReadTool, createTodoTool, createTodoWriteTool } from "./tools-todo.js";
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
    createMultiEditTool(options),
    createApplyPatchTool(options),
    createGitStatusTool(options),
    createGitDiffTool(options),
    createDiagnosticsTool(options),
    createDiagnosticsTool(options, "get_diagnostics"),
    createRunProjectCommandTool(options, "run_tests"),
    createRunProjectCommandTool(options, "run_lint"),
    createRunProjectCommandTool(options, "run_typecheck"),
    createSymbolSearchTool(options),
    createWorkspaceSymbolsTool(options),
    createFindReferencesTool(options),
    createGotoDefinitionTool(options),
    createSnapshotTool(options),
    createRevertTool(options),
    createRunShellTool(options),
    createTodoReadTool(options),
    createTodoWriteTool(options),
    createTodoTool(options),
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
        startLine: { type: "number", description: "1-based line to start reading from" },
        lineCount: { type: "number", description: "Maximum number of lines to read" },
        offset: { type: "number", description: "Alias for startLine" },
        limit: { type: "number", description: "Alias for lineCount" },
      },
      required: ["path"],
    },
    permission: { read: "allow" },
    renderer: { kind: "file", collapsible: true },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      
      const stat = await fs.stat(resolved);
      if (stat.size > 2 * 1024 * 1024) { // 2MB limit
        return {
          success: false,
          error: `File is too large to read (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max size is 2MB. Use grep_search or read a specific chunk instead.`,
        };
      }

      // Read first 1024 bytes to check for binary
      const handle = await fs.open(resolved, 'r');
      const buffer = Buffer.alloc(1024);
      const { bytesRead } = await handle.read(buffer, 0, 1024, 0);
      await handle.close();
      
      if (buffer.slice(0, bytesRead).includes(0)) {
        return {
          success: false,
          error: `File appears to be binary and cannot be read as text.`,
        };
      }

      const content = await fs.readFile(resolved, "utf8");
      const startLine = readPositiveInteger(input.startLine ?? input.offset);
      const lineCount = readPositiveInteger(input.lineCount ?? input.limit);

      if (startLine || lineCount) {
        const lines = content.split("\n");
        const startIndex = Math.max(0, (startLine ?? 1) - 1);
        const endIndex = lineCount ? startIndex + lineCount : lines.length;
        const selected = lines.slice(startIndex, endIndex);
        const numbered = selected
          .map((line, index) => `${String(startIndex + index + 1).padStart(6, " ")}\t${line}`)
          .join("\n");
        return {
          success: true,
          output: numbered,
          summary: `Read ${selected.length} lines from ${targetPath}`,
        };
      }

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
      const rgFiles = await runRgFiles(resolvedBase, pattern);
      const relativeMatches = rgFiles ?? (await walkFiles(resolvedBase))
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
      const patternText = requireString(input.pattern, "pattern");
      const basePath = typeof input.basePath === "string" ? input.basePath : ".";
      const resolvedBase = resolveWorkspacePath(basePath, context.workspaceRoot ?? options.workspaceRoot);
      const rgResult = await runRgSearch(resolvedBase, patternText);
      if (rgResult) {
        return {
          success: true,
          output: rgResult.output || "No matches found",
          summary: `Found ${rgResult.matchCount} matches`,
        };
      }

      const pattern = new RegExp(patternText, "i");
      const files = await walkFiles(resolvedBase);
      const matches: string[] = [];

      for (const filePath of files) {
        try {
          const stat = await fs.stat(filePath);
          if (stat.size > 10 * 1024 * 1024) continue; // Skip files > 10MB
          
          const handle = await fs.open(filePath, 'r');
          const buffer = Buffer.alloc(1024);
          const { bytesRead } = await handle.read(buffer, 0, 1024, 0);
          await handle.close();
          
          if (buffer.slice(0, bytesRead).includes(0)) continue; // Skip binary

          const content = await fs.readFile(filePath, "utf8");
          const lines = content.split("\n");
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              matches.push(`${path.relative(resolvedBase, filePath)}:${index + 1}:${line.trim()}`);
            }
          });
        } catch {
          // Ignore files we can't read
        }
      }

      // Enforce tool result size limit for grep
      const finalOutput = matches.join("\n");
      const truncatedOutput = finalOutput.length > 50000 
         ? finalOutput.slice(0, 50000) + "\n\n... (Result truncated. Please refine your search pattern.)"
         : finalOutput;

      return {
        success: true,
        output: truncatedOutput || "No matches found",
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
      pushUndoSnapshot(context.session.metadata, {
        summary: `Before write_file ${targetPath}`,
        files: [{ path: targetPath, content: previous }],
      });
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

      pushUndoSnapshot(context.session.metadata, {
        summary: `Before apply_patch ${targetPath}`,
        files: [{ path: targetPath, content: previous }],
      });
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

function createMultiEditTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "multi_edit",
    description: "Apply multiple exact string replacements to one UTF-8 file in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target file" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              oldText: { type: "string" },
              newText: { type: "string" },
            },
            required: ["oldText", "newText"],
          },
        },
      },
      required: ["path", "edits"],
    },
    permission: { write: "ask" },
    renderer: { kind: "diff", collapsible: false },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const edits = Array.isArray(input.edits) ? input.edits : [];
      if (edits.length === 0) {
        return { success: false, error: "edits must contain at least one replacement" };
      }

      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const previous = await fs.readFile(resolved, "utf8");
      let next = previous;

      for (const edit of edits) {
        if (!edit || typeof edit !== "object") {
          return { success: false, error: "Each edit must be an object" };
        }
        const oldText = requireString((edit as Record<string, unknown>).oldText, "oldText");
        const newText = typeof (edit as Record<string, unknown>).newText === "string"
          ? String((edit as Record<string, unknown>).newText)
          : undefined;
        if (newText === undefined) {
          return { success: false, error: "newText must be a string" };
        }
        if (!next.includes(oldText)) {
          return { success: false, error: `Could not find replacement text in ${targetPath}` };
        }
        next = next.replace(oldText, newText);
      }

      pushUndoSnapshot(context.session.metadata, {
        summary: `Before multi_edit ${targetPath}`,
        files: [{ path: targetPath, content: previous }],
      });
      await fs.writeFile(resolved, next, "utf8");
      return {
        success: true,
        output: `Applied ${edits.length} edits to ${targetPath}`,
        artifacts: [createDiffArtifact(targetPath, previous, next)],
        summary: `Edited ${targetPath}`,
      };
    },
  };
}

function createGitStatusTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "git_status",
    description: "Show git status for the workspace",
    inputSchema: { type: "object", properties: {} },
    permission: { process: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(_input, context) {
      const cwd = context.workspaceRoot ?? options.workspaceRoot ?? process.cwd();
      const result = await runCommand("git status --short --branch", cwd, 30_000);
      return {
        success: result.code === 0,
        output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
        error: result.code === 0 ? undefined : `git status exited with code ${result.code}`,
        summary: "Checked git status",
      };
    },
  };
}

function createGitDiffTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "git_diff",
    description: "Show git diff for the workspace or a specific file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional file path" },
        staged: { type: "boolean", description: "Show staged diff" },
      },
    },
    permission: { process: "allow" },
    renderer: { kind: "diff", collapsible: true },
    async execute(input, context) {
      const cwd = context.workspaceRoot ?? options.workspaceRoot ?? process.cwd();
      const target = typeof input.path === "string" && input.path.trim()
        ? ` -- ${shellQuote(input.path)}`
        : "";
      const command = `git diff${input.staged === true ? " --staged" : ""}${target}`;
      const result = await runCommand(command, cwd, 30_000);
      return {
        success: result.code === 0,
        output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || "No diff",
        error: result.code === 0 ? undefined : `git diff exited with code ${result.code}`,
        summary: "Checked git diff",
      };
    },
  };
}

function createDiagnosticsTool(options: BuiltInToolOptions, name = "diagnostics"): KernelTool {
  return {
    name,
    description: "Get LSP-backed diagnostics, falling back to detected project typecheck commands when no language server is available",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional file path to open before reading diagnostics" },
        timeoutMs: { type: "number", description: "Milliseconds to wait for LSP diagnostics" },
      },
    },
    permission: { process: "ask" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const cwd = context.workspaceRoot ?? options.workspaceRoot ?? process.cwd();
      const targetPath = typeof input.path === "string" && input.path.trim()
        ? resolveWorkspacePath(input.path, cwd)
        : undefined;
      const timeoutMs = readPositiveInteger(input.timeoutMs) ?? 1_500;
      const lsp = await tryLsp(() => getSharedLspManager(cwd).getDiagnostics({
        path: targetPath,
        timeoutMs,
      }));
      if (lsp.ok && lsp.result.available) {
        const diagnostics = lsp.result.data;
        return {
          success: diagnostics.length === 0,
          output: formatDiagnostics(diagnostics, cwd) || "No LSP diagnostics",
          error: diagnostics.length === 0 ? undefined : "LSP diagnostics reported issues",
          summary: diagnostics.length === 0
            ? `LSP diagnostics passed${lsp.result.server ? ` (${lsp.result.server})` : ""}`
            : `Found ${diagnostics.length} LSP diagnostic${diagnostics.length === 1 ? "" : "s"}`,
        };
      }

      const detected = await detectProjectCommands(cwd);
      const commands = detected.diagnostics;
      if (commands.length === 0) {
        const reason = lsp.ok ? lsp.result.reason : lsp.error.message;
        return {
          success: true,
          output: reason ? `No supported diagnostics detected. LSP unavailable: ${reason}` : "No supported diagnostics detected",
          summary: "No diagnostics",
        };
      }

      const outputs: string[] = [];
      let ok = true;
      for (const command of commands) {
        const result = await runCommand(command, cwd, 120_000);
        ok = ok && result.code === 0;
        outputs.push(formatCommandResult(command, result));
      }
      return {
        success: ok,
        output: compactOutput(outputs.join("\n\n")),
        error: ok ? undefined : "Diagnostics reported failures",
        summary: ok ? "Diagnostics passed" : "Diagnostics failed",
      };
    },
  };
}

function createRunProjectCommandTool(options: BuiltInToolOptions, name: "run_tests" | "run_lint" | "run_typecheck"): KernelTool {
  const labels = {
    run_tests: "test",
    run_lint: "lint",
    run_typecheck: "typecheck",
  } as const;

  return {
    name,
    description: `Run the detected project ${labels[name]} command in the workspace`,
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Optional explicit command override" },
        cwd: { type: "string", description: "Optional workspace-relative directory" },
        timeoutMs: { type: "number", description: "Timeout in milliseconds" },
      },
    },
    permission: { process: "ask" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const workspaceRoot = context.workspaceRoot ?? options.workspaceRoot ?? process.cwd();
      const cwd = typeof input.cwd === "string"
        ? resolveWorkspacePath(input.cwd, workspaceRoot)
        : workspaceRoot;
      const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
        ? input.timeoutMs
        : 180_000;
      const command = typeof input.command === "string" && input.command.trim()
        ? input.command.trim()
        : (await detectProjectCommands(cwd))[labels[name]];

      if (!command) {
        return {
          success: false,
          error: `No ${labels[name]} command detected. Pass command explicitly or add a project script.`,
          summary: `No ${labels[name]} command`,
        };
      }

      const result = await runCommand(command, cwd, timeoutMs);
      return {
        success: result.code === 0,
        output: compactOutput(formatCommandResult(command, result)),
        error: result.code === 0 ? undefined : `${labels[name]} command exited with code ${result.code}`,
        summary: result.code === 0 ? `${labels[name]} passed` : `${labels[name]} failed`,
      };
    },
  };
}

function createSymbolSearchTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "symbol_search",
    description: "Search for symbols using LSP workspace/document symbols, falling back to ripgrep-compatible definition patterns",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Symbol name or prefix" },
        path: { type: "string", description: "Optional file path for document symbols" },
        basePath: { type: "string", description: "Base directory to search from" },
        limit: { type: "number", description: "Maximum result lines" },
      },
      required: ["query"],
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const query = requireString(input.query, "query");
      const workspaceRoot = context.workspaceRoot ?? options.workspaceRoot;
      const cwd = resolveWorkspacePath(typeof input.basePath === "string" ? input.basePath : ".", workspaceRoot);
      const limit = readPositiveInteger(input.limit) ?? 80;
      const lsp = await tryLsp(async () => {
        const manager = getSharedLspManager(cwd);
        if (typeof input.path === "string" && input.path.trim()) {
          const symbols = await manager.documentSymbols(resolveWorkspacePath(input.path, workspaceRoot), 8_000);
          return {
            ...symbols,
            data: symbols.data.filter((symbol) => symbol.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit),
          };
        }
        const symbols = await manager.workspaceSymbols(query, 8_000);
        return { ...symbols, data: symbols.data.slice(0, limit) };
      });
      if (lsp.ok && lsp.result.available) {
        return {
          success: true,
          output: formatSymbols(lsp.result.data, cwd) || "No symbols found",
          summary: `Found ${lsp.result.data.length} LSP symbol${lsp.result.data.length === 1 ? "" : "s"}`,
        };
      }

      const pattern = buildDefinitionPattern(query);
      const result = await runRgSearchWithArgs(cwd, pattern, limit);
      return {
        success: true,
        output: appendFallbackReason(result.output || "No symbols found", lsp),
        summary: `Found ${result.matchCount} symbol matches with ripgrep fallback`,
      };
    },
  };
}

function createWorkspaceSymbolsTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "workspace_symbols",
    description: "Search workspace symbols using initialized language servers, falling back to symbol_search behavior",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Symbol name or prefix" },
        basePath: { type: "string", description: "Base directory to search from" },
        limit: { type: "number", description: "Maximum result lines" },
      },
      required: ["query"],
    },
    permission: { process: "ask" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const query = requireString(input.query, "query");
      const cwd = resolveWorkspacePath(typeof input.basePath === "string" ? input.basePath : ".", context.workspaceRoot ?? options.workspaceRoot);
      const limit = readPositiveInteger(input.limit) ?? 80;
      const lsp = await tryLsp(async () => {
        const symbols = await getSharedLspManager(cwd).workspaceSymbols(query, 8_000);
        return { ...symbols, data: symbols.data.slice(0, limit) };
      });
      if (lsp.ok && lsp.result.available) {
        return {
          success: true,
          output: formatSymbols(lsp.result.data, cwd) || "No workspace symbols found",
          summary: `Found ${lsp.result.data.length} LSP workspace symbol${lsp.result.data.length === 1 ? "" : "s"}`,
        };
      }

      const result = await runRgSearchWithArgs(cwd, buildDefinitionPattern(query), limit);
      return {
        success: true,
        output: appendFallbackReason(result.output || "No workspace symbols found", lsp),
        summary: `Found ${result.matchCount} workspace symbols with ripgrep fallback`,
      };
    },
  };
}

function createFindReferencesTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "find_references",
    description: "Find symbol references using LSP position lookup, falling back to ripgrep symbol search",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol name for ripgrep fallback" },
        path: { type: "string", description: "File path containing the symbol" },
        line: { type: "number", description: "1-based line number for LSP lookup" },
        column: { type: "number", description: "1-based column number for LSP lookup" },
        character: { type: "number", description: "Alias for column" },
        includeDeclaration: { type: "boolean", description: "Include the declaration in LSP references" },
        basePath: { type: "string", description: "Base directory to search from" },
        limit: { type: "number", description: "Maximum result lines" },
      },
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const workspaceRoot = context.workspaceRoot ?? options.workspaceRoot;
      const cwd = resolveWorkspacePath(typeof input.basePath === "string" ? input.basePath : ".", workspaceRoot);
      const limit = readPositiveInteger(input.limit) ?? 120;
      const positionLookup = readPositionLookup(input, workspaceRoot);
      if (positionLookup) {
        const lsp = await tryLsp(async () => {
          const references = await getSharedLspManager(cwd).findReferences(
            positionLookup.path,
            positionLookup.position,
            input.includeDeclaration !== false,
            8_000
          );
          return { ...references, data: references.data.slice(0, limit) };
        });
        if (lsp.ok && lsp.result.available) {
          return {
            success: true,
            output: formatLocations(lsp.result.data, cwd) || "No references found",
            summary: `Found ${lsp.result.data.length} LSP reference${lsp.result.data.length === 1 ? "" : "s"}`,
          };
        }
      }

      const symbol = requireString(input.symbol, "symbol");
      const pattern = `\\b${escapeRegExp(symbol)}\\b`;
      const result = await runRgSearchWithArgs(cwd, pattern, limit);
      return {
        success: true,
        output: result.output || "No references found",
        summary: `Found ${result.matchCount} references with ripgrep fallback`,
      };
    },
  };
}

function createGotoDefinitionTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "goto_definition",
    description: "Locate definitions using LSP position lookup, falling back to ripgrep definition patterns",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol name for ripgrep fallback" },
        path: { type: "string", description: "File path containing the symbol" },
        line: { type: "number", description: "1-based line number for LSP lookup" },
        column: { type: "number", description: "1-based column number for LSP lookup" },
        character: { type: "number", description: "Alias for column" },
        basePath: { type: "string", description: "Base directory to search from" },
        limit: { type: "number", description: "Maximum candidate definitions" },
      },
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const workspaceRoot = context.workspaceRoot ?? options.workspaceRoot;
      const cwd = resolveWorkspacePath(typeof input.basePath === "string" ? input.basePath : ".", workspaceRoot);
      const limit = readPositiveInteger(input.limit) ?? 40;
      const positionLookup = readPositionLookup(input, workspaceRoot);
      if (positionLookup) {
        const lsp = await tryLsp(async () => {
          const definitions = await getSharedLspManager(cwd).gotoDefinition(positionLookup.path, positionLookup.position, 8_000);
          return { ...definitions, data: definitions.data.slice(0, limit) };
        });
        if (lsp.ok && lsp.result.available) {
          return {
            success: true,
            output: formatLocations(lsp.result.data, cwd) || "No definition found",
            summary: `Found ${lsp.result.data.length} LSP definition${lsp.result.data.length === 1 ? "" : "s"}`,
          };
        }
      }

      const symbol = requireString(input.symbol, "symbol");
      const result = await runRgSearchWithArgs(cwd, buildDefinitionPattern(symbol), limit);
      return {
        success: true,
        output: result.output || "No likely definition found",
        summary: `Found ${result.matchCount} definition candidates with ripgrep fallback`,
      };
    },
  };
}

function createSnapshotTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "snapshot",
    description: "Store a restorable snapshot of a workspace file in the current session",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to snapshot" },
      },
      required: ["path"],
    },
    permission: { read: "allow" },
    renderer: { kind: "text", collapsible: true },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const content = await fs.readFile(resolved, "utf8");
      const snapshots = getSnapshotStore(context.session.metadata);
      snapshots[targetPath] = { content, createdAt: Date.now() };
      return { success: true, output: `Snapshot stored for ${targetPath}`, summary: `Snapshotted ${targetPath}` };
    },
  };
}

function createRevertTool(options: BuiltInToolOptions): KernelTool {
  return {
    name: "revert",
    description: "Restore a file from a snapshot created earlier in this session",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to restore" },
      },
      required: ["path"],
    },
    permission: { write: "ask" },
    renderer: { kind: "diff", collapsible: false },
    async execute(input, context) {
      const targetPath = requireString(input.path, "path");
      const snapshots = getSnapshotStore(context.session.metadata);
      const snapshot = snapshots[targetPath];
      if (!snapshot) {
        return { success: false, error: `No snapshot found for ${targetPath}` };
      }
      const resolved = resolveWorkspacePath(targetPath, context.workspaceRoot ?? options.workspaceRoot);
      const previous = await safeReadFile(resolved) ?? "";
      pushUndoSnapshot(context.session.metadata, {
        summary: `Before revert ${targetPath}`,
        files: [{ path: targetPath, content: previous }],
      });
      await fs.writeFile(resolved, snapshot.content, "utf8");
      return {
        success: true,
        output: `Restored ${targetPath} from session snapshot`,
        artifacts: [createDiffArtifact(targetPath, previous, snapshot.content)],
        summary: `Reverted ${targetPath}`,
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

type LspAttempt<T> = { ok: true; result: T } | { ok: false; error: Error };

async function tryLsp<T>(factory: () => Promise<T>): Promise<LspAttempt<T>> {
  try {
    return { ok: true, result: await factory() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function appendFallbackReason(output: string, lsp: LspAttempt<{ reason?: string }>): string {
  if (!lsp.ok) {
    return `${output}\n\nLSP fallback reason: ${lsp.error.message}`;
  }
  if (lsp.result.reason) {
    return `${output}\n\nLSP fallback reason: ${lsp.result.reason}`;
  }
  return output;
}

function readPositionLookup(
  input: Record<string, unknown>,
  workspaceRoot?: string
): { path: string; position: ReturnType<typeof positionFromLineColumn> } | null {
  if (typeof input.path !== "string" || !input.path.trim()) return null;
  const line = readPositiveInteger(input.line);
  const column = readPositiveInteger(input.column ?? input.character);
  if (!line || !column) return null;
  return {
    path: resolveWorkspacePath(input.path, workspaceRoot),
    position: positionFromLineColumn(line, column),
  };
}

function formatDiagnostics(diagnostics: LspDiagnostic[], workspaceRoot: string): string {
  return diagnostics
    .map((diagnostic) => {
      const line = diagnostic.range.start.line + 1;
      const column = diagnostic.range.start.character + 1;
      const severity = formatDiagnosticSeverity(diagnostic.severity);
      const source = diagnostic.source ? `[${diagnostic.source}] ` : "";
      const code = diagnostic.code === undefined ? "" : ` (${diagnostic.code})`;
      return `${relativeDisplayPath(diagnostic.path, workspaceRoot)}:${line}:${column}: ${severity}: ${source}${diagnostic.message}${code}`;
    })
    .join("\n");
}

function formatLocations(locations: LspLocation[], workspaceRoot: string): string {
  return locations
    .map((location) => {
      const line = location.range.start.line + 1;
      const column = location.range.start.character + 1;
      return `${relativeDisplayPath(location.path, workspaceRoot)}:${line}:${column}`;
    })
    .join("\n");
}

function formatSymbols(symbols: LspSymbol[], workspaceRoot: string): string {
  return symbols
    .map((symbol) => {
      const location = symbol.path && symbol.range
        ? `${relativeDisplayPath(symbol.path, workspaceRoot)}:${symbol.range.start.line + 1}:${symbol.range.start.character + 1}`
        : "(workspace)";
      const container = symbol.containerName ? ` in ${symbol.containerName}` : "";
      return `${location}: ${symbol.name}${container} [kind:${symbol.kind}]`;
    })
    .join("\n");
}

function formatDiagnosticSeverity(severity: number | undefined): string {
  switch (severity) {
    case 1:
      return "error";
    case 2:
      return "warning";
    case 3:
      return "info";
    case 4:
      return "hint";
    default:
      return "diagnostic";
  }
}

function relativeDisplayPath(targetPath: string, workspaceRoot: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return relative && !relative.startsWith("..") ? relative : targetPath;
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

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const integer = Math.floor(value);
  return integer > 0 ? integer : undefined;
}

async function safeReadFile(targetPath: string): Promise<string | null> {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

interface ProjectCommands {
  packageManager?: string;
  test?: string;
  lint?: string;
  typecheck?: string;
  diagnostics: string[];
}

async function detectProjectCommands(cwd: string): Promise<ProjectCommands> {
  const commands: ProjectCommands = { diagnostics: [] };
  const packageJsonPath = path.join(cwd, "package.json");

  if (await exists(packageJsonPath)) {
    const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(packageJsonPath);
    const scripts = packageJson?.scripts ?? {};
    const packageManager = await detectNodePackageManager(cwd);
    commands.packageManager = packageManager;

    if (scripts.test) commands.test = `${packageManager} run test`;
    if (scripts.lint) commands.lint = `${packageManager} run lint`;
    if (scripts["type-check"]) commands.typecheck = `${packageManager} run type-check`;
    else if (scripts.typecheck) commands.typecheck = `${packageManager} run typecheck`;
    else if (scripts.check) commands.typecheck = `${packageManager} run check`;
    else if (await exists(path.join(cwd, "tsconfig.json"))) commands.typecheck = `${packageManager} exec tsc --noEmit -p tsconfig.json`;

    if (commands.typecheck) commands.diagnostics.push(commands.typecheck);
  }

  if (await exists(path.join(cwd, "pyproject.toml")) || await exists(path.join(cwd, "setup.py")) || await exists(path.join(cwd, "pytest.ini"))) {
    commands.test ??= "python3 -m pytest";
    commands.typecheck ??= "python3 -m compileall .";
    commands.diagnostics.push(commands.typecheck);
  }

  if (await exists(path.join(cwd, "Cargo.toml"))) {
    commands.test ??= "cargo test";
    commands.lint ??= "cargo clippy --all-targets --all-features";
    commands.typecheck ??= "cargo check --all-targets --all-features";
    commands.diagnostics.push(commands.typecheck);
  }

  if (await exists(path.join(cwd, "go.mod"))) {
    commands.test ??= "go test ./...";
    commands.lint ??= "go vet ./...";
    commands.typecheck ??= "go test ./... -run '^$'";
    commands.diagnostics.push(commands.typecheck);
  }

  commands.diagnostics = unique(commands.diagnostics);
  return commands;
}

async function detectNodePackageManager(cwd: string): Promise<string> {
  if (await exists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(cwd, "yarn.lock"))) return "yarn";
  if (await exists(path.join(cwd, "bun.lockb")) || await exists(path.join(cwd, "bun.lock"))) return "bun";
  return "npm";
}

async function readJsonFile<T>(targetPath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatCommandResult(command: string, result: { stdout: string; stderr: string; code: number }): string {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return [`$ ${command}`, output || "(no output)", `exit code: ${result.code}`].join("\n");
}

function compactOutput(output: string, maxChars = 40_000): string {
  if (output.length <= maxChars) {
    return output;
  }
  const head = output.slice(0, Math.floor(maxChars * 0.65));
  const tail = output.slice(output.length - Math.floor(maxChars * 0.25));
  return `${head}\n\n... output truncated (${output.length - head.length - tail.length} chars omitted) ...\n\n${tail}`;
}

function buildDefinitionPattern(symbol: string): string {
  const escaped = escapeRegExp(symbol);
  return [
    `\\b(function|class|interface|type|enum|const|let|var)\\s+${escaped}\\b`,
    `\\b(def|class)\\s+${escaped}\\b`,
    `\\b(func|type|var|const)\\s+${escaped}\\b`,
    `\\b(fn|struct|enum|trait|impl)\\s+${escaped}\\b`,
    `\\b${escaped}\\s*[:=]\\s*(async\\s*)?(function|\\(|class)?`,
  ].join("|");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSnapshotStore(metadata: Record<string, unknown>): Record<string, { content: string; createdAt: number }> {
  const existing = metadata.snapshots;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as Record<string, { content: string; createdAt: number }>;
  }
  const snapshots: Record<string, { content: string; createdAt: number }> = {};
  metadata.snapshots = snapshots;
  return snapshots;
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

interface UndoSnapshot {
  id: string;
  createdAt: number;
  summary: string;
  files: Array<{ path: string; content: string | null }>;
}

function pushUndoSnapshot(
  metadata: Record<string, unknown>,
  snapshot: Omit<UndoSnapshot, "id" | "createdAt">
): void {
  const stack = getUndoStack(metadata);
  stack.push({
    id: `${Date.now()}-${stack.length + 1}`,
    createdAt: Date.now(),
    ...snapshot,
  });
  if (stack.length > 20) {
    stack.splice(0, stack.length - 20);
  }
  metadata.undoStack = stack;
}

function getUndoStack(metadata: Record<string, unknown>): UndoSnapshot[] {
  const existing = metadata.undoStack;
  if (Array.isArray(existing)) {
    return existing.filter((entry): entry is UndoSnapshot =>
      Boolean(entry)
      && typeof entry === "object"
      && typeof (entry as UndoSnapshot).id === "string"
      && Array.isArray((entry as UndoSnapshot).files)
    );
  }
  const stack: UndoSnapshot[] = [];
  metadata.undoStack = stack;
  return stack;
}

async function runRgFiles(cwd: string, pattern: string): Promise<string[] | null> {
  const result = await runCommandWithArgs("rg", [
    "--files",
    "--hidden",
    "--glob",
    "!**/.git/**",
    "--glob",
    "!**/node_modules/**",
    "--glob",
    pattern,
  ], cwd, 30_000);

  if (result.missing) {
    return null;
  }
  if (result.code !== 0 && !result.stdout.trim()) {
    return [];
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function runRgSearch(
  cwd: string,
  pattern: string
): Promise<{ output: string; matchCount: number } | null> {
  const result = await runCommandWithArgs("rg", [
    "--line-number",
    "--color",
    "never",
    "--hidden",
    "--glob",
    "!**/.git/**",
    "--glob",
    "!**/node_modules/**",
    pattern,
    ".",
  ], cwd, 30_000);

  if (result.missing) {
    return null;
  }
  const output = result.stdout.length > 50_000
    ? `${result.stdout.slice(0, 50_000)}\n\n... (Result truncated. Please refine your search pattern.)`
    : result.stdout.trim();
  const matchCount = result.stdout.trim()
    ? result.stdout.split("\n").filter((line) => line.trim()).length
    : 0;
  return { output, matchCount };
}

async function runRgSearchWithArgs(
  cwd: string,
  pattern: string,
  limit: number
): Promise<{ output: string; matchCount: number }> {
  const result = await runCommandWithArgs("rg", [
    "--line-number",
    "--color",
    "never",
    "--hidden",
    "--glob",
    "!**/.git/**",
    "--glob",
    "!**/node_modules/**",
    pattern,
    ".",
  ], cwd, 30_000);

  if (!result.missing) {
    const lines = result.stdout.split("\n").filter((line) => line.trim());
    const limited = lines.slice(0, limit);
    return {
      output: limited.join("\n") + (lines.length > limited.length ? `\n... ${lines.length - limited.length} more matches` : ""),
      matchCount: lines.length,
    };
  }

  const regex = new RegExp(pattern, "i");
  const matches: string[] = [];
  for (const filePath of await walkFiles(cwd)) {
    if (matches.length >= limit) break;
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 2 * 1024 * 1024) continue;
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (matches.length < limit && regex.test(line)) {
          matches.push(`${path.relative(cwd, filePath)}:${index + 1}:${line.trim()}`);
        }
      });
    } catch {
      // Ignore unreadable files.
    }
  }
  return { output: matches.join("\n"), matchCount: matches.length };
}

async function runCommandWithArgs(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number; missing?: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        resolve({ stdout: "", stderr: error.message, code: 127, missing: true });
        return;
      }
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
