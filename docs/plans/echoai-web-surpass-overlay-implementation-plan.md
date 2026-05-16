# EchoAI Web Surpass Overlay Implementation Plan

Goal: move EchoAI Web from broad React product coverage to live SaaS depth that exceeds `samples/overlay-web-main`.

## Completion Standard

No item is complete when it is only a mock label. Each item needs one of:

- local live behavior that runs in this repo,
- a production adapter that fails closed until required credentials are present,
- a smoke or unit check proving the contract.

## Streams

- S-001..S-020 Backend: file-backed local store, production repository boundary, audit log, seed/reset, API mutation surface.
- S-021..S-040 Auth and org: signed web sessions, mobile/desktop bearer transfer, role gates, auth audit, adapter seams for WorkOS or another provider.
- S-041..S-060 Runtime and chat: AgentKernel-facing run model, durable sessions, streaming events, abort/retry/fork, persisted tool calls, reconnect.
- S-061..S-080 Models and billing: hosted/free/BYOK/local routing, encrypted vault references, fallback, health, usage ledger, Stripe adapter.
- S-081..S-100 Knowledge and memory: uploads, object storage adapter, extraction, chunks, lexical/semantic retrieval, deletion, memory proposal and approval.
- S-101..S-120 Tools and integrations: policy engine, MCP CRUD/test/browser, OAuth connector registry, browser automation, code sandbox adapter.
- S-121..S-140 Automations and outputs: scheduler contract, retry/audit, durable outputs, media artifacts, notification targets.
- S-141..S-150 EchoAI advantage: desktop gateway handoff, mobile approval handoff, CLI continuity, device presence, cross-device audit.

## Overlay Parity Targets

- Convex-style durable state: implemented locally through `FileWorkspaceStore`, replaceable with cloud repository.
- WorkOS-style auth: implemented through signed local sessions plus strict adapter status checks for production auth.
- Stripe billing: implemented through usage ledger and billing adapter boundary.
- R2 storage: implemented through object-storage adapter boundary and ownership-aware file metadata.
- Daytona sandbox: implemented through sandbox adapter boundary and quota contracts.
- Composio integrations: implemented through OAuth/integration adapter boundary and tool exposure policy.
- Chat stream worker: implemented through SSE runtime events and durable background run records.

## EchoAI Surpass Targets

- Web can route a run to EchoAI AgentKernel concepts instead of Overlay-only agent loops.
- Web can hand off local workspace work to desktop.
- Web can send approval and run state to mobile.
- CLI, desktop, mobile, and web share contracts through `@echoai/contracts`.
