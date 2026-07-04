# Contributing to EchoAI

Thanks for your interest in contributing to EchoAI, the open-source coding-agent CLI and runtime. This guide covers setup, workflow, and standards.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project Layout](#project-layout)
- [Development Setup](#development-setup)
- [Workflow](#workflow)
- [Coding Standards](#coding-standards)
- [Testing & Verification](#testing--verification)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)
- [Security](#security)

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Project Layout

EchoAI is a `pnpm` monorepo:

- `src/` — the CLI entrypoint, commands, providers, and agents.
- `packages/` — the runtime kernel, tools, permissions, sessions, gateway, LSP, TUI, and other building blocks (`@echoai/*`).
- `apps/` — client apps (desktop, web, mobile, iOS, Android, macOS).
- `channels/` — messaging integrations (Discord, Telegram, WhatsApp, Slack, Signal, iMessage, LINE, web).
- `evals/` — the coding-agent evaluation harness.
- `docs/` — architecture and planning docs.

The paid hosted SaaS lives outside the open-source product under `hosted/echoai-cloud/` and is slated to move to a private repository before launch.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 10+
- Git

### Install & build

```bash
git clone https://github.com/Loopxo/echoai.git
cd echoai
pnpm install
pnpm run build
```

### Run the CLI locally

```bash
pnpm run dev            # tsx src/cli.ts
# or after building:
node dist/cli.js --help
```

### Configure a provider

EchoAI works with local BYOK keys. The cheapest path for students is a Chinese
provider key (DeepSeek, Kimi, Zhipu/GLM, Qwen, or MiniMax). Copy `.env.example`
to `.env` and set one of the provider keys, then:

```bash
node dist/cli.js "Explain how this repository is structured" --provider deepseek
```

## Workflow

1. Check existing issues/discussions before starting significant work.
2. Open an issue for new features or large changes so we can align on approach.
3. Create a focused branch: `feature/...`, `fix/...`, or `docs/...`.
4. Keep changes scoped to one logical concern per PR.

## Coding Standards

- TypeScript, strict mode. Provide explicit types for public APIs.
- Match existing patterns in the area you are editing before introducing new ones.
- Use the runtime permission model for anything touching files, processes, or the network.
- Prefer `camelCase` for values, `PascalCase` for types/classes, `kebab-case` for filenames.
- Handle errors explicitly with helpful messages. Avoid `console.log` instrumentation in library code.

```bash
pnpm run lint
pnpm run lint:fix
pnpm run format
```

## Testing & Verification

Run the full validation suite before opening a PR:

```bash
pnpm run type-check
pnpm test
pnpm run build
```

Add tests for new features and bug fixes. The runtime, providers, and review
areas have test suites under `tests/` and within packages.

For coding-agent quality, exercise the eval harness:

```bash
node dist/cli.js eval list
node dist/cli.js eval run --task eval-bugfix-divide-zero
```

## Pull Requests

- Use a descriptive title and fill out the PR template.
- Link related issues.
- Confirm `type-check`, `test`, and `build` pass.
- Include a short summary of changed files and verification results.
- Use conventional commits where possible (`feat:`, `fix:`, `docs:`, `refactor:`).

## Reporting Issues

Use the issue templates. Include reproduction steps, expected vs. actual
behavior, environment details (OS, Node version, EchoAI version), and logs.

## Security

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
