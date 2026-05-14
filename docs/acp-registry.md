# EchoAI ACP Registry Metadata

EchoAI exposes an Agent Client Protocol server through the stable command:

```sh
echoai acp --stdio
```

Transport is newline-delimited JSON over stdio through `@agentclientprotocol/sdk`.

Suggested registry entry:

```json
{
  "id": "echoai",
  "name": "EchoAI",
  "version": "2.3.4",
  "description": "Open-source coding-agent CLI with terminal sessions, runtime tools, permissions, ACP, and budget-aware model routing.",
  "repository": "https://github.com/Loopxo/echoai",
  "website": "https://github.com/Loopxo/echoai#readme",
  "authors": ["Vijeet Shah <vijeet@vijeetshah.com>"],
  "license": "MIT",
  "distribution": {
    "npx": {
      "package": "echoai@2.3.4",
      "args": ["acp", "--stdio"]
    }
  }
}
```

The ready-to-copy registry files are in `docs/acp-registry/echoai/`.

Compatibility target:

- Zed ACP launch using `echoai acp --stdio`
- `initialize`
- `session/new`
- `session/load`
- `session/list`
- `session/prompt`
- `session/cancel`
- `session/set_mode`
- `session/update` notifications for user text, assistant text, plans, mode changes, and usage
- `initialize` includes terminal auth with `args: ["login"]` so registry CI can verify an auth-capable agent.

Before submitting to the ACP Registry, run the local smoke:

```sh
pnpm run build
node dist/cli.js acp --capabilities
```
