# EchoAI LSP Setup

EchoAI uses installed language servers for code intelligence and falls back to ripgrep when a server is missing.

Supported first wave:

- TypeScript/JavaScript: `pnpm add -D typescript typescript-language-server`
- Python: `python3 -m pip install pyright`
- Go: `go install golang.org/x/tools/gopls@latest`
- Rust: `rustup component add rust-analyzer`

Check readiness:

```sh
echoai diagnose
```

Runtime tools backed by LSP when available:

- `get_diagnostics`
- `goto_definition`
- `find_references`
- `symbol_search`
- `workspace_symbols`

Language servers are local developer dependencies. EchoAI does not bundle every server into the npm package.
