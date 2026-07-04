# EchoAI Architecture

EchoAI is a runtime-first coding-agent platform. The same runtime powers the
CLI, desktop, web, mobile, and messaging channels.

## Layers

```
        Clients
  CLI · Desktop · Web · Mobile · iOS · macOS · Android · Channels
        |
        v
  Gateway (packages/gateway)            Providers (src/providers)
  JSON-RPC transport, device control    DeepSeek · Kimi · Zhipu/GLM · Qwen ·
                                        MiniMax · Groq · Claude · OpenAI · EchoAI
        |                                       |
        +-------------------+-------------------+
                            v
                  AgentKernel (packages/runtime)
   streamed event loop · tool orchestration · sessions · compaction · tasks
                            |
        +-------------------+-------------------+
        v                   v                   v
  Built-in tools      Permissions          Memory / Sessions
  read/write/patch    layered rules,       persisted runtime state,
  search/test/lsp     risk tiers,          audit log, session memory
                      safe-path approvals
                            |
                            v
                  Local system: files · shell · git · LSP · MCP
```

## Core concepts

### Runtime kernel (`packages/runtime`)
An event-driven loop (`runEvents`) streams assistant deltas and tool calls.
Read-only/low-risk tool calls run in parallel; mutating calls run serially. A
loop guard blocks repeated/failing tool signatures. Sessions persist as
structured state; long sessions auto-compact.

### Providers (`src/providers`)
Each provider implements `AIProvider`. The OpenAI-compatible base class powers
the Chinese providers (DeepSeek, Kimi, Zhipu/GLM, Qwen, MiniMax) and Groq —
they differ only by base URL, model catalog, and auth. Providers expose
`completeWithTools` and `streamWithTools` for agentic tool use.

### Permissions (`packages/runtime/src/permissions.ts`)
Layered rule priority: `policy > flag > local > project > user > safe_path`.
Risk tiers (low→critical) classify commands, paths, and network access.
Workspace containment is enforced; plan mode denies writes.

### Multi-agent orchestration (`src/agents/orchestration`)
`MultiAgentOrchestrator` decomposes a task into a dependency-aware DAG, runs
independent subtasks in parallel via the kernel's `runSubagent` + isolated
workspace copies, then merges file changes back with conflict detection and an
optional verification command. This is distinct from `PersonaRouter`
(`src/agents/nlp/agent-orchestrator.ts`), which only selects a single persona.

### Gateway (`packages/gateway`)
A local control plane (HTTP + WebSocket, JSON-RPC 2.0) that lets desktop, web,
and mobile clients drive the runtime and channels. Device auth and pairing
guard remote access.

## Model strategy

EchoAI is optimized to run great coding agents on inexpensive Chinese models so
the tool stays affordable for students. Users can bring their own key (BYOK,
stored locally) or use hosted credits that route only to Chinese vendors with a
metered credit ledger.

## State

Runtime state lives under `~/.echoai` (sessions, audit log, memory, tasks).
Project memory is read from `ECHOAI.md` and `.echoai/memory.jsonl`.
