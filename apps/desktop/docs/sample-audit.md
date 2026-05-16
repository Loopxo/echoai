# EchoAI Desktop Sample Audit

Date: 2026-05-16

EchoAI Desktop uses the local sample repositories as reference architecture only unless a license file and attribution path are clear.

## Findings

| Sample | License finding | Copy policy | Useful reference areas |
| --- | --- | --- | --- |
| `samples/open-cowork-main` | No license file found in local checkout | Reference-only | session manager, sandbox adapters, MCP manager, memory services, remote gateway |
| `samples/eigent-main` | Apache-style license templates found | Small compatible snippets only after notice review | project chat store, workflow graph, browser workspace, terminal workspace, component system |
| `samples/overlay-web-main` | No license file found in local checkout | Reference-only | projects, memories, automations, outputs, device handoff |

## Implementation Rule

The desktop implementation must be clean-room by default:

- Keep EchoAI-specific IPC contracts, service names, persistence schemas, and UI structure.
- Port product ideas and architecture patterns, not unlicensed source files.
- Before copying any Eigent snippet, add attribution and verify that the copied code is covered by Apache-compatible license text.
- Treat Open Cowork and Overlay sample code as read-only reference until a license is supplied.
