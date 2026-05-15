# EchoAI Desktop

Private Electron desktop surface for EchoAI on Windows and macOS.

This package hosts the first desktop foundation slice from `docs/plans/echoai-desktop-app-plan.md`:

- D-001 through D-003: Electron, Vite React, and split main/preload/renderer builds.
- D-004 and D-005: typed preload IPC bridge with secure renderer defaults.
- D-006 and D-007: single-instance lock and `echoai://` protocol capture.
- D-008 through D-010: stable app directories, searchable logs, and recovery state.

## Commands

```sh
pnpm --filter @echoai/desktop dev
pnpm --filter @echoai/desktop build
pnpm --filter @echoai/desktop typecheck
pnpm --filter @echoai/desktop test
```
