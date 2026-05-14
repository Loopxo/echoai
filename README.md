# EchoAI

EchoAI is an open-source coding-agent CLI with a professional runtime, session persistence, tool orchestration, layered permissions, local BYOK providers, and optional EchoAI Cloud credits.

[![NPM Version](https://img.shields.io/npm/v/echoai.svg)](https://www.npmjs.com/package/echoai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

## What It Does

EchoAI combines a terminal-first developer workflow with an AI-native runtime:

- Fast CLI startup with lazy initialization and memoized config/provider loading
- Streamed model output and structured tool-call execution
- Parallel read-only tool batches and serialized mutating tool execution
- First-class coding tools for ranged file reads, ripgrep search, patch edits, test/lint/typecheck, diagnostics, symbols, and references
- Layered permission rules with automated safe-path approvals
- Persistent sessions, event logs, approvals, artifacts, and session memory
- Project memory through `ECHOAI.md` and `.echoai/memory.jsonl`
- Background shell tasks with logs, status tracking, and stop controls
- Subagent session forking with optional isolated worktrees
- Optional hosted device-code login and usage ledger
- Local BYOK support for DeepSeek, Kimi, and local NIM
- MCP tool/server integration through the runtime permission layer
- SDK-backed Agent Client Protocol server through `echoai acp --stdio`
- LSP-backed diagnostics, definitions, references, and workspace symbols with ripgrep fallbacks
- VS Code extension for editor-triggered EchoAI workflows

## Architecture Highlights

### Runtime Kernel

The runtime is built around a streamed event loop:

- assistant deltas and tool calls flow through a unified event stream
- tools execute through a permission-aware orchestration layer
- sessions are persisted as structured runtime state instead of transient chat text

### Security Model

EchoAI treats permissions as a runtime concern, not a UI afterthought:

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

Use EchoAI Cloud credits:

```bash
echoai login
echoai usage
echoai chat
```

Use your own provider keys locally:

```bash
echoai config setup
echoai chat --provider deepseek
echoai chat --provider kimi
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
echoai "Refactor this TypeScript utility" --provider echoai --model code
```

Interactive slash commands:

```text
/login      connect this terminal to an EchoAI account
/usage      show plan, remaining credit, and recent model cost
/mode plan  inspect only; file writes are denied
/mode build normal coding mode
/mode fast  DeepSeek chat preset
/mode code  Kimi 32k preset
/mode reason DeepSeek reasoner preset
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

Project memory and diagnostics:

```bash
echoai init
echoai memory add "Use pnpm for package scripts" --tag convention
echoai memory show
echoai diagnose
```

Coding evals:

```bash
echoai eval list
echoai eval run --task eval-bugfix-divide-zero
echoai eval run --all --agent echoai --command "echoai chat \"$ECHOAI_EVAL_PROMPT\""
echoai eval report
```

IDE protocol bridge:

```bash
echoai acp --capabilities
echoai acp --stdio
```

`echoai acp --stdio` uses `@agentclientprotocol/sdk` over newline-delimited JSON stdio. It exposes session lifecycle, prompt turns, streamed session updates, plans, mode changes, and persisted EchoAI sessions for ACP-compatible editors. Registry notes live in [`docs/acp-registry.md`](docs/acp-registry.md).

LSP-backed code intelligence:

```bash
echoai diagnose
```

Install the language servers you need locally:

```bash
pnpm add -D typescript typescript-language-server
python3 -m pip install pyright
go install golang.org/x/tools/gopls@latest
rustup component add rust-analyzer
```

EchoAI does not bundle every language server into the npm package. Runtime tools use LSP when available and fall back to ripgrep/project commands when a server is missing. Setup details live in [`docs/lsp.md`](docs/lsp.md).

## VS Code Extension

The VS Code extension lives in [`packages/extensions/vscode`](packages/extensions/vscode).

Package a Marketplace upload file:

```bash
cd packages/extensions/vscode
npm run package
```

That produces a `.vsix` file you can upload in the Visual Studio Marketplace publisher dashboard.

The extension currently shells out to the latest published EchoAI CLI, so keep the CLI release and extension release aligned.

## MCP Support

EchoAI supports MCP-compatible tools and servers.

Common commands:

```bash
echoai mcp list
echoai mcp add --id my-tool --name "My Tool" --transport stdio --command "/path/to/server"
echoai mcp tools
echoai mcp call calculator expression="2+2*3"
```

Treat MCP configuration as trusted configuration. A malicious stdio command or remote MCP endpoint can execute code or expose data.

## Open Source And EchoAI Cloud

This public repository contains the open-source product: CLI, runtime, tools, MCP integration, local gateway, provider adapters, sessions, permissions, and editor/native clients.

EchoAI supports two model-access modes:

- **Local BYOK:** users store their own provider API keys locally through `echoai config setup`. Those keys are not sent to EchoAI Cloud.
- **EchoAI Cloud credits:** users run `echoai login`, authenticate through the hosted site, and use the `echoai` provider. The CLI stores only EchoAI access/refresh tokens in `~/.echoai/auth.json`.

The paid hosted web app, billing system, credit ledger, managed provider keys, hosted BYOK storage, and production model-routing API live outside the open-source workspace. During development that private SaaS workspace is kept under ignored `hosted/echoai-cloud/` and should be moved to its own private repository before launch.

`packages/gateway` is the local/remote-control gateway used by EchoAI clients and channels. It is not the paid hosted billing/model API.

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

Run the coding eval harness:

```bash
pnpm run build
node dist/cli.js eval list
node dist/cli.js eval run --task eval-bugfix-divide-zero
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
