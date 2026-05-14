# EchoAI Project Instructions

## Workspace
- Package manager: `pnpm`
- Install dependencies with: `pnpm install`

## Verification
- Type check: `pnpm type-check`
- Lint: `pnpm lint`
- Test: `pnpm test`
- Build: `pnpm build`

## Agent Rules
- Inspect existing patterns before editing.
- Keep changes scoped to the user request.
- Ask before running commands that install dependencies, publish packages, push git history, or access the network.
- Show a concise summary of changed files and verification results before finishing.
