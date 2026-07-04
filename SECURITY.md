# Security Policy

## Supported Versions

EchoAI is under active development. Security fixes are applied to the latest
published `2.x` release line.

| Version | Supported |
| ------- | --------- |
| 2.x     | ✅        |
| < 2.0   | ❌        |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via one of:

- GitHub: open a [private security advisory](https://github.com/Loopxo/echoai/security/advisories/new)
- Email: **security@vijeetshah.com**

Include:

- A description of the vulnerability and its impact.
- Steps to reproduce or a proof of concept.
- Affected versions and environment.
- Any suggested remediation.

We aim to acknowledge reports within 3 business days and provide a remediation
timeline after triage. Please give us a reasonable window to ship a fix before
public disclosure.

## Scope and Sensitive Areas

EchoAI executes tools, runs shell commands, edits files, and can reach the
network on behalf of a model. The following areas are especially security
relevant:

- The runtime permission model (`packages/runtime/src/permissions.ts`) — risk
  classification, safe-path approvals, workspace containment.
- Built-in tools that write files or run commands (`packages/runtime/src/builtin-tools.ts`).
- The gateway transport and any remote/device pairing (`packages/gateway`).
- Provider API key storage and the hosted BYOK key vault.
- MCP server configuration (treat as trusted configuration — a malicious stdio
  command or remote MCP endpoint can execute code or exfiltrate data).

## Handling Secrets

- Never commit API keys or `.env` files.
- Provider keys are stored locally; hosted BYOK keys are encrypted with
  AES-256-GCM. Do not log decrypted key material.
- Report any code path that echoes secret values into logs or model context.
