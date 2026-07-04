# Changelog

All notable changes to EchoAI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New first-class Chinese model providers: **Zhipu / GLM** (`zhipu`/`glm`),
  **Qwen / DashScope** (`qwen`/`dashscope`), and **MiniMax** (`minimax`).
- **Ollama** provider for fully-free local models (zero spend) with no API key.
- Environment-variable key resolution for all providers (e.g. `ZHIPU_API_KEY`,
  `QWEN_API_KEY`/`DASHSCOPE_API_KEY`, `MINIMAX_API_KEY`).
- Real multi-agent orchestration: `echoai orchestrate "<task>"` decomposes a
  task into a dependency-aware DAG and runs workers in parallel in isolated
  workspace copies, then merges results with conflict detection and optional
  verification (planner → parallel workers → merge).
- Config-driven hosted model routing: vendor registry plus `MODEL_ALIASES_JSON`
  and `MODEL_PRICING_JSON` overrides so routing presets and pricing can change
  without a code deploy.
- Hosted cloud: pluggable rate-limit store (Redis-ready), `kid`-based JWT key
  rotation, an `/admin/reconcile` cost-drift endpoint, an optional per-user
  daily spend cap, and a unit-tested pure `pricing.ts` module.
- Web app: real hosted-cloud completion path (opt-in via `ECHOAI_WEB_CLOUD_*`),
  failing closed to the local deterministic path.
- Mobile app: real navigation shell + app-state context + instantiated mobile
  client (replacing the static screen gallery).
- Channels: Signal inbound receive loop and web-channel session persistence.
- Eval suite expanded to 25 tasks; `EVALS.md` and a nightly eval CI workflow.
- **Shared design system** (`@echoai/design`): brand tokens (color scales,
  type/space/radius/shadow/motion, dark+light) plus dependency-free React
  primitives — `Icon` set, `Markdown` (code blocks + copy), `DiffView`
  (LCS + unified-diff), `Button`, `Badge`, `Spinner`, `Skeleton`, `EmptyState`.
- **Desktop UX overhaul**: fixed the broken navigation (Home is now a command
  center; every page is a focused view), added dark mode, markdown/code chat
  rendering, a `git diff` viewer in the terminal panel, motion, focus rings,
  and refined scrollbars.
- **Web app UX**: real icon set (replacing emoji glyphs), a fuzzy command
  palette, and markdown/code rendering in chat — all on the shared tokens.
- Open-source governance: `CODE_OF_CONDUCT.md`, `SECURITY.md`, this changelog,
  GitHub issue/PR templates, `docs/ARCHITECTURE.md`, `docs/OPEN-SOURCE-VS-HOSTED.md`.

### Changed

- Refreshed DeepSeek and Kimi model catalogs (Kimi K2 default).
- Groq now extends the OpenAI-compatible provider and supports agentic tool
  calling.
- Hosted cloud routing extended beyond DeepSeek/Kimi to GLM, Qwen, and MiniMax.
- Clarified the intent-routing layer: `AdvancedAgentOrchestrator` is now also
  exported as `PersonaRouter` and documented as single-agent persona selection
  (distinct from the new `MultiAgentOrchestrator`).
- Rewrote `CONTRIBUTING.md` for the current pnpm monorepo and commands.

### Fixed

- iOS build break from a duplicate `@main` entry point; removed the dead
  localhost chat stub and vestigial SwiftPM manifest.
- Removed the dead Android `com.echoai` source tree; enabled release signing
  (env-driven) and R8 minification + resource shrinking.
- Synced `src/providers/factory.ts` with the live provider set.
- Removed `console.log` instrumentation from the agents layer.
