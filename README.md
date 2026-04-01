# Echo AI

Echo AI is a local-first AI coding assistant with a CLI runtime, session persistence, tool orchestration, layered permissions, background task execution, and a VS Code extension.

[![NPM Version](https://img.shields.io/npm/v/echoai.svg)](https://www.npmjs.com/package/echoai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

## What It Does

Echo AI combines a terminal-first developer workflow with an AI-native runtime:

- Fast CLI startup with lazy initialization and memoized config/provider loading
- Streamed model output and structured tool-call execution
- Parallel read-only tool batches and serialized mutating tool execution
- Layered permission rules with automated safe-path approvals
- Persistent sessions, event logs, approvals, artifacts, and session memory
- Background shell tasks with logs, status tracking, and stop controls
- Subagent session forking with optional isolated worktrees
- MCP tool/server integration
- VS Code extension for editor-triggered Echo AI workflows

## Architecture Highlights

### Runtime Kernel

The runtime is built around a streamed event loop:

- assistant deltas and tool calls flow through a unified event stream
- tools execute through a permission-aware orchestration layer
- sessions are persisted as structured runtime state instead of transient chat text

### Security Model

Echo AI treats permissions as a runtime concern, not a UI afterthought:

- layered rules: `policy -> flag -> local -> project -> user`
- safe-path approvals for known low-risk reads and writes
- permission resolver orchestration for automated and interactive decisions
- workspace-bound built-in file tools
- background task logs and metadata guarded through managed runtime paths

### Terminal Experience

The CLI renders structured runtime events instead of dumping raw text output. The TUI package also includes a vendored terminal rendering stack for richer terminal interfaces.

## Installation

The commands below assume the CLI package is published as `echoai`.

If you publish under a scope such as `@loopxo/echoai`, replace `echoai` in the commands below with your scoped package name.

```bash
npm install -g echoai
```

Run it:

```bash
echoai
```

Local development install:

```bash
git clone https://github.com/Loopxo/echoai.git
cd echoai
pnpm install
pnpm run build
```

## Quick Start

Interactive mode:

```bash
echoai
```

Direct prompt:

```bash
echoai "Explain how this repository is structured"
```

Run with explicit provider/model:

```bash
echoai "Refactor this TypeScript utility" --provider claude --model claude-3-5-sonnet
```

Session workflows:

```bash
echoai sessions list
echoai sessions show <session-id> --messages
echoai sessions export <session-id> --format markdown
```

Background tasks:

```bash
echoai tasks start "pnpm test"
echoai tasks ps
echoai tasks logs <session-id> <task-id> --follow
echoai tasks kill <session-id> <task-id>
```

Security and permissions:

```bash
echoai security status
echoai security audit
echoai security permissions
```

## VS Code Extension

The VS Code extension lives in [`packages/extensions/vscode`](packages/extensions/vscode).

Package a Marketplace upload file:

```bash
cd packages/extensions/vscode
npm run package
```

That produces a `.vsix` file you can upload in the Visual Studio Marketplace publisher dashboard.

The extension currently shells out to the latest published Echo AI CLI, so keep the CLI release and extension release aligned.

## MCP Support

Echo AI supports MCP-compatible tools and servers.

Common commands:

```bash
echoai mcp list
echoai mcp add --id my-tool --name "My Tool" --transport stdio --command "/path/to/server"
echoai mcp tools
echoai mcp call calculator expression="2+2*3"
```

Treat MCP configuration as trusted configuration. A malicious stdio command or remote MCP endpoint can execute code or expose data.

## Development

Install dependencies:

```bash
pnpm install
```

Build everything:

```bash
pnpm run build
```

Run tests:

```bash
pnpm exec vitest run --passWithNoTests
```

Validate release readiness:

```bash
pnpm run validate
```

Run the CLI locally:

```bash
pnpm run dev
```

## Release

### CLI / npm

Update the root package version in [`package.json`](package.json), then:

```bash
pnpm run validate
npm publish
```

If the package is scoped, publish with public access:

```bash
npm publish --access public
```

### VS Code Extension

Update the extension version in [`packages/extensions/vscode/package.json`](packages/extensions/vscode/package.json), then:

```bash
cd packages/extensions/vscode
npm run package
```

Upload the generated `.vsix` in the Visual Studio Marketplace publisher portal, or publish with `vsce publish` if your publisher auth is configured locally.

## Repository

- GitHub: [Loopxo/echoai](https://github.com/Loopxo/echoai)
- License: MIT

## Contributing

Issues and pull requests are welcome. Keep changes focused, testable, and aligned with the runtime-first architecture of the project.
