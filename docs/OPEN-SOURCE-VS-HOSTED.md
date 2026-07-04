# Open Source vs. Hosted

EchoAI has two parts. This document makes the boundary explicit so contributors
know what is MIT-licensed open source and what is the commercial hosted service.

## Open source (MIT) — this repository

Everything that makes EchoAI a usable coding agent on your own machine:

- CLI and interactive runtime (`src/`, `dist/`)
- Runtime kernel, tools, permissions, sessions, memory (`packages/runtime`, etc.)
- Providers and local BYOK support (`src/providers`) — DeepSeek, Kimi, Zhipu/GLM,
  Qwen, MiniMax, Groq, Claude, OpenAI
- Multi-agent orchestration (`src/agents/orchestration`)
- Local control gateway (`packages/gateway`)
- MCP integration, LSP code intelligence, TUI
- Messaging channels (`channels/`)
- Client apps (`apps/`)
- Eval harness (`evals/`)

With a local provider key, you can use 100% of the open-source product without
any hosted account. This is the recommended path for students: bring a cheap or
free Chinese model key and run everything locally.

## Hosted (commercial) — `hosted/echoai-cloud/`

The paid SaaS that resells managed access to cheap Chinese models with billing:

- Account auth (OAuth device flow), JWT/refresh tokens
- Credit ledger and metered usage (`usdMicros`)
- Billing and checkout (LemonSqueezy) + webhooks
- Managed provider keys (encrypted) and hosted BYOK
- Model-routing gateway (DeepSeek, Kimi, Zhipu/GLM, Qwen, MiniMax)
- Admin tooling, metrics, rate limiting

> The hosted workspace currently lives under `hosted/echoai-cloud/` for
> development convenience and is intended to move to a **private repository**
> before launch. It is not covered by the open-source MIT license.

## How the two connect

- `echoai config setup` / `.env` → local BYOK, keys never leave your machine.
- `echoai login` → authenticates to the hosted service; the CLI stores only
  access/refresh tokens in `~/.echoai/auth.json` and uses the `echoai` provider
  to route through hosted credits.

`packages/gateway` is the **local** control gateway used by clients and
channels. It is not the hosted billing/model API.
