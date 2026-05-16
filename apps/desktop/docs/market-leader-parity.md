# EchoAI Desktop Market-Leader Parity

Date: 2026-05-16

This benchmark defines what “surpass the samples” means for EchoAI Desktop.

## Product Position

EchoAI Desktop is a local-first professional agent workspace. It is not a hosted web wrapper. The desktop owns filesystem context, terminal tasks, browser automation state, tool approvals, local memory, device handoff, diagnostics, and release readiness.

## Capability Matrix

| Range | Area | Evidence in desktop implementation |
| --- | --- | --- |
| D-001-D-010 | Audit and architecture | typed IPC, workbench service, clean-room audit, parity matrix |
| D-011-D-025 | Desktop shell | native workbench shell, project controls, command center, activity surfaces |
| D-026-D-040 | Agent runtime | AgentKernel integration, sessions, streaming runtime events, exports |
| D-041-D-055 | Tools, terminal, sandbox | command classifier, terminal task service, approval queue, sandbox status |
| D-056-D-070 | Browser, files, workflow | workspace file service, browser sessions, workflow graph, artifacts |
| D-071-D-083 | MCP, skills, memory | MCP registry, skills index, local memory records, privacy posture |
| D-084-D-093 | Remote, automations, handoff | gateway, pairing, remote requests, channels, schedules, privacy dashboard |
| D-094-D-100 | Release quality | updater service, release checklist, log search, diagnostics docs, smoke scripts |

## Parity Targets

| Sample influence | Target | EchoAI direction |
| --- | --- | --- |
| Open Cowork | secure runtime, sandbox, MCP, memory, gateway | equivalent native services with stricter clean-room policy and release checklist |
| Eigent | project UX, workflow graph, browser/terminal workspaces | integrated workbench panel with workflows, approvals, terminal, files, browser state |
| Overlay | projects, memory, automations, outputs, handoff | local-first desktop-owned equivalents with optional web/mobile companions |

## Depth Added After Initial Foundation

- Sandbox planner: maps commands to native, WSL2, or Lima profiles and marks safe, approval-required, or blocked work before execution.
- MCP lifecycle: exposes enabled/disabled server state, stdio transport metadata, tool counts, and health status in the native workbench.
- Memory depth: keeps a local memory index, tags, pinning, and ranked search results for workspace/project/global context.
- Workflow depth: supports operator templates, node progression, approval pauses, execution state, and verification stages.
- Browser/terminal UX: records browser workspace actions and summarizes terminal task state alongside workflow and approval context.

## Release Gate

A release candidate is not market-ready until typecheck, unit tests, package dry-run, release checklist, diagnostics export, and manual Electron launch all pass.
