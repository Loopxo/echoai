# EchoAI Desktop App Plan

Status: planning document  
Scope: private/pro desktop product for Windows and macOS  
Primary references: `samples/open-cowork-main`, `samples/eigent-main`, existing `apps/macos`, `packages/runtime`, `packages/gateway`, `packages/tui`, `packages/browser`, `packages/canvas`

## Product Intent

EchoAI Desktop should be the full local command center for EchoAI. It should package the CLI/runtime into a polished Windows and macOS app with chat, workspace control, file editing, terminal tasks, MCP, skills, browser automation, GUI automation, device pairing, and remote control from web/mobile.

The desktop app is the strongest place to do sensitive local work:

- local filesystem access
- local terminal execution
- local IDE/editor integrations
- local browser control
- GUI automation
- local model discovery
- workspace indexing
- approval prompts
- desktop notifications
- secure device gateway
- mobile/web bridge

The existing Swift macOS app can remain as a native companion, but the requested cross-platform Windows/macOS app should use Electron because the samples already demonstrate Electron builder, IPC, renderer UI, and sandbox packaging.

## Strategic Decision

Build a new Electron desktop app that embeds EchoAI runtime instead of trying to make the CLI UI do everything. The CLI remains available and can be called by power users. Desktop becomes the everyday GUI.

Recommended package location:

- `apps/desktop` for private app source if kept in this repo temporarily.
- Future private repo before launch if the product is not open source.

Do not blindly copy sample code. Open Cowork and Eigent are references for architecture, packaging, UI, sandbox, and workforce design. Any copied code requires license review and attribution where required.

## Existing EchoAI Assets To Reuse

| Existing area | Reuse |
|---|---|
| `packages/runtime` | Agent kernel, built-in tools, permissions, tasks, session registry |
| `packages/gateway` | Desktop gateway server and JSON-RPC contracts |
| `src/runtime/cli-kernel.ts` | Provider adapter into the runtime |
| `src/config` | User/provider config migration and storage ideas |
| `src/providers` | Provider support |
| `src/cli/mcp.ts` | MCP config UX and calls |
| `src/cli/security.ts` | Security profile concepts |
| `src/cli/tasks.ts` | Background task lifecycle |
| `packages/browser` | Browser/CDP automation base |
| `packages/canvas` | Live UI/canvas host base |
| `packages/skills` | Skill loading and instruction model |
| `packages/tui` | Terminal rendering pieces and transcript ideas |
| `apps/macos` | Gateway manager, menu bar ideas, voice wake, device pairing, permission prompts |

## Sample Code To Study Or Port

| Sample source | Candidate reuse |
|---|---|
| `samples/open-cowork-main/src/main/index.ts` | Electron main process organization |
| `samples/open-cowork-main/src/preload/index.ts` | Safe IPC bridge pattern |
| `samples/open-cowork-main/src/shared/ipc-types.ts` | Typed IPC contracts |
| `samples/open-cowork-main/src/main/config/config-store.ts` | Desktop config store |
| `samples/open-cowork-main/src/main/db/database.ts` | SQLite persistence pattern |
| `samples/open-cowork-main/src/main/session/session-manager.ts` | GUI session manager |
| `samples/open-cowork-main/src/main/tools/tool-executor.ts` | Tool execution UI bridge |
| `samples/open-cowork-main/src/main/sandbox/*` | WSL/Lima/native sandbox adapters |
| `samples/open-cowork-main/src/main/mcp/*` | MCP server manager |
| `samples/open-cowork-main/src/main/skills/*` | Skill library and plugin runtime |
| `samples/open-cowork-main/src/main/remote/*` | Remote control gateway/channel logic |
| `samples/open-cowork-main/src/renderer/components/ChatView.tsx` | Chat screen |
| `samples/open-cowork-main/src/renderer/components/ContextPanel.tsx` and `src/renderer/hooks/useIPC.ts` | Reasoning/tool trace data flow |
| `samples/open-cowork-main/src/renderer/components/SettingsPanel.tsx` | Settings panel split |
| `samples/open-cowork-main/electron-builder.yml` | Builder, resources, DMG/NSIS packaging |
| `samples/eigent-main/electron/main/*` | Electron update, webview, process, dependency install ideas |
| `samples/eigent-main/src/components/WorkFlow/*` | Workforce visualization |
| `samples/eigent-main/src/components/TerminalAgentWorkspace` | Terminal workspace UI |
| `samples/eigent-main/src/components/BrowserAgentWorkspace` | Browser workspace UI |
| `samples/eigent-main/backend/app/agent/factory/*` | Specialized agent patterns |

## Target Architecture

```text
Electron Renderer
  - React app shell
  - chat
  - project/workspace views
  - trace/tools
  - settings
  - terminal/browser/canvas panels
  |
Preload
  - typed IPC bridge
  - no Node access in renderer
  |
Electron Main
  - window lifecycle
  - updater
  - secure config
  - local database
  - runtime host
  - gateway server
  - sandbox adapter
  - MCP manager
  - skills manager
  - desktop permissions
  |
EchoAI Runtime
  - AgentKernel
  - tools
  - permissions
  - tasks
  - sessions
  |
Local System
  - workspace files
  - terminal
  - browser
  - IDE
  - OS permissions
```

## Desktop Page Map

Main:

- Home
- Chat
- Workspace
- Files
- Tasks
- Trace
- Terminal
- Browser
- Canvas
- Sessions
- Artifacts
- Memory
- Skills
- MCP
- Automations
- Devices
- Channels
- Settings

Settings:

- General
- Account
- Models
- Providers
- BYOK keys
- Hosted credits
- Local models
- Workspace permissions
- Sandbox
- MCP servers
- Skills
- Integrations
- Desktop automation
- Browser profiles
- Notifications
- Privacy
- Logs
- Updates
- Advanced

Modals:

- Select workspace
- Permission approval
- Tool call details
- Provider setup
- Device pairing request
- MCP add server
- Skill install/create
- Sandbox setup
- App update
- Crash report
- Login/device code

## Runtime Strategy

Desktop should not shell out to the CLI for every operation. It should import and host the EchoAI runtime directly for speed and state control. The CLI may still be used for compatibility commands.

Required runtime services:

- DesktopSessionService
- DesktopProviderService
- DesktopToolService
- DesktopPermissionService
- DesktopTaskService
- DesktopGatewayService
- DesktopMcpService
- DesktopSkillService
- DesktopWorkspaceService
- DesktopArtifactService
- DesktopSyncService

## Sandbox Strategy

Use layered protection:

- Basic: path guard and workspace root containment.
- Medium: command approval, command classification, environment redaction.
- Windows enhanced: WSL2 worker for shell tasks.
- macOS enhanced: Lima VM worker for shell tasks.
- Browser: isolated profile per workspace/project.
- GUI automation: explicit OS permission prompts and visible trace.

## Desktop Tickets

### Foundation

- D-001: Create `apps/desktop` Electron scaffold. Acceptance: dev app opens on macOS and Windows with blank EchoAI shell.
- D-002: Configure Vite React renderer. Acceptance: renderer hot reloads and produces production bundle.
- D-003: Configure Electron main TypeScript build. Acceptance: main/preload compile separately from renderer.
- D-004: Add typed preload bridge. Acceptance: renderer has no direct Node access and all calls are typed.
- D-005: Add app security defaults. Acceptance: context isolation on, sandboxed renderer, no remote module.
- D-006: Add single instance lock. Acceptance: second launch focuses existing window.
- D-007: Add custom protocol `echoai://`. Acceptance: auth/device links open desktop app.
- D-008: Add app config directories. Acceptance: data, logs, cache, skills, MCP, artifacts paths are stable per OS.
- D-009: Add logging service. Acceptance: main, renderer, runtime, and gateway logs are searchable.
- D-010: Add crash recovery. Acceptance: app can recover and show last known workspace/session.

### Packaging and Distribution

- D-011: Add electron-builder config. Acceptance: macOS DMG/ZIP and Windows NSIS builds are configured.
- D-012: Add app icons. Acceptance: product icons render in installer, dock, taskbar, tray, and window.
- D-013: Add macOS entitlements. Acceptance: hardened runtime and notarization inputs are ready.
- D-014: Add Windows installer settings. Acceptance: install location configurable and app data preserved on uninstall.
- D-015: Add auto-update flow. Acceptance: app detects, downloads, and installs update with user consent.
- D-016: Add build resources. Acceptance: bundled Node/runtime helpers are included.
- D-017: Add native dependency unpacking. Acceptance: SQLite/native modules work after packaging.
- D-018: Add CI build matrix plan. Acceptance: Windows x64 and macOS arm64 artifacts are defined.
- D-019: Add signing secrets checklist. Acceptance: release docs list required certificates/secrets.
- D-020: Add smoke test installer. Acceptance: installed app launches and can open settings.

### App Shell and UX

- D-021: Build app shell. Acceptance: sidebar, top bar, status bar, main content, and secondary panel exist.
- D-022: Build window titlebar. Acceptance: custom controls work on Windows and macOS.
- D-023: Build home screen. Acceptance: user can select workspace, start chat, open recent session.
- D-024: Build workspace picker. Acceptance: user grants a root folder and app persists it.
- D-025: Build recent workspace list. Acceptance: recent folders show last active time and session count.
- D-026: Build command palette. Acceptance: user can launch pages/actions from keyboard.
- D-027: Build notification system. Acceptance: task, permission, update, and device alerts show consistently.
- D-028: Build responsive panels. Acceptance: trace, files, browser, and terminal panels can dock/resize.
- D-029: Build global search. Acceptance: search sessions, files, symbols, skills, tools, and settings.
- D-030: Build onboarding wizard. Acceptance: first run guides through workspace, model, permissions, mobile pairing.

### Auth, Account, and Sync

- D-031: Add hosted login. Acceptance: user can login via device code or browser callback.
- D-032: Add account status. Acceptance: app shows signed-in user, plan, credits, and workspace sync state.
- D-033: Add offline mode. Acceptance: BYOK/local mode works without hosted login where possible.
- D-034: Add token storage. Acceptance: auth tokens stored in OS keychain/credential vault.
- D-035: Add token refresh. Acceptance: app refreshes hosted session without interrupting chat.
- D-036: Add logout. Acceptance: tokens are cleared and hosted features disable.
- D-037: Add cloud sync settings. Acceptance: user can control which sessions/artifacts/memories sync.
- D-038: Add sync queue. Acceptance: offline changes sync when connection returns.
- D-039: Add conflict policy. Acceptance: session and memory conflicts resolve predictably.
- D-040: Add account audit panel. Acceptance: user can inspect recent device/login/sync events.

### Runtime Integration

- D-041: Embed `AgentKernel`. Acceptance: desktop can create a session and run a prompt locally.
- D-042: Add desktop provider adapter. Acceptance: providers from existing EchoAI config run through kernel.
- D-043: Add desktop session registry. Acceptance: sessions persist in local database.
- D-044: Add desktop audit store. Acceptance: approvals and tool calls persist locally.
- D-045: Add runtime event bridge. Acceptance: kernel events stream to renderer over IPC.
- D-046: Add run cancellation. Acceptance: user can stop active model stream and tools.
- D-047: Add run resume. Acceptance: app reload can recover active or recent run status.
- D-048: Add runtime compaction. Acceptance: long sessions compact without losing visible history.
- D-049: Add artifact service. Acceptance: generated/edited files are visible in artifact panel.
- D-050: Add session export. Acceptance: session exports to markdown, JSON, and shareable package.

### Chat and Agent UX

- D-051: Build desktop chat view. Acceptance: streaming text, user input, attachments, and session switching work.
- D-052: Build message cards. Acceptance: assistant, user, tool call, tool result, error, and approval cards render.
- D-053: Build trace panel. Acceptance: thinking, tool sequence, files touched, and commands appear in order.
- D-054: Build model picker. Acceptance: hosted, BYOK, free, local models are selectable with capability labels.
- D-055: Build prompt mode picker. Acceptance: Ask, Build, Review, Research, Plan, Automate map to runtime config.
- D-056: Build attachment support. Acceptance: drag/drop files and images into chat.
- D-057: Build file citation links. Acceptance: local file paths open in app or OS safely.
- D-058: Build approval dialog. Acceptance: write/process/network/GUI actions show scoped approval request.
- D-059: Build retry/edit message. Acceptance: user can edit prompt and rerun from a point.
- D-060: Build branch session. Acceptance: user can fork session from a message.

### Workspace and Files

- D-061: Build file explorer. Acceptance: workspace tree supports open, reveal, search, and refresh.
- D-062: Build file preview. Acceptance: text, code, markdown, image, PDF metadata, and CSV previews work.
- D-063: Build diff viewer. Acceptance: pending and applied edits show unified and side-by-side diffs.
- D-064: Build patch approval. Acceptance: file edits can be reviewed before applying.
- D-065: Build symbol search. Acceptance: LSP-backed workspace symbols are searchable.
- D-066: Build diagnostics panel. Acceptance: TypeScript/LSP diagnostics show by file and can be sent to chat.
- D-067: Build recent files context. Acceptance: agent can include recently opened/edited files.
- D-068: Build workspace indexing. Acceptance: code search and memory indexing run in background.
- D-069: Build ignored paths policy. Acceptance: node_modules, dist, secrets, and user-defined ignores are excluded.
- D-070: Build artifact open/reveal. Acceptance: generated reports/docs can open in default app or reveal in folder.

### Terminal, Tasks, and Sandbox

- D-071: Build terminal panel. Acceptance: user can run interactive or managed commands in workspace.
- D-072: Build background task panel. Acceptance: long-running tests/builds show logs, status, and stop button.
- D-073: Build command classifier. Acceptance: risky commands require approval or denial.
- D-074: Build path guard. Acceptance: file writes and command cwd stay inside approved workspace unless allowed.
- D-075: Build native executor. Acceptance: basic commands run cross-platform with captured logs.
- D-076: Build WSL2 executor. Acceptance: Windows shell tasks can run inside WSL when available.
- D-077: Build Lima executor. Acceptance: macOS shell tasks can run inside Lima when available.
- D-078: Build sandbox setup dialog. Acceptance: app detects missing WSL/Lima and guides user.
- D-079: Build sandbox sync. Acceptance: workspace paths map consistently between host and VM.
- D-080: Build process cleanup. Acceptance: orphaned child processes are stopped on app quit or run cancel.

### Tools, MCP, Skills, Browser, GUI

- D-081: Build MCP manager. Acceptance: add/list/test/remove MCP servers in desktop UI.
- D-082: Build MCP tool inspector. Acceptance: user can inspect schemas and sample calls.
- D-083: Build skills manager. Acceptance: install, create, edit, delete, and update skills.
- D-084: Bundle default EchoAI skills. Acceptance: coding, docs, spreadsheet, presentation, browser, image skills are discoverable.
- D-085: Build browser automation panel. Acceptance: app can launch controlled browser profile and show status.
- D-086: Build GUI automation permission flow. Acceptance: macOS screen/accessibility permissions are checked before GUI action.
- D-087: Build browser profile manager. Acceptance: profiles can be created per workspace/project.
- D-088: Build canvas panel. Acceptance: runtime can open local canvas/A2UI output inside desktop.
- D-089: Build computer-use bridge. Acceptance: GUI actions are visible, cancellable, and audited.
- D-090: Build tool output summaries. Acceptance: large tool outputs are summarized and expandable.

### Devices, Channels, and Release Hardening

- D-091: Start local gateway from desktop. Acceptance: web/mobile can discover or connect to desktop.
- D-092: Build device pairing UI. Acceptance: approve/reject desktop/mobile pairing requests.
- D-093: Build mobile remote control. Acceptance: paired mobile can send prompt, view run, approve action.
- D-094: Build web remote control. Acceptance: web can hand off local workspace tasks to desktop.
- D-095: Build channel settings. Acceptance: Slack/Discord/Telegram/WhatsApp/etc can be configured if supported.
- D-096: Build scheduled tasks UI. Acceptance: local recurring tasks can run via desktop runtime.
- D-097: Build privacy dashboard. Acceptance: user can see local/cloud data boundary and export/delete local data.
- D-098: Add telemetry opt-in. Acceptance: product analytics are disabled unless user/org allows them.
- D-099: Add desktop test suite. Acceptance: unit tests cover config, IPC, path guard, sandbox, sessions, tools.
- D-100: Add release readiness checklist. Acceptance: signing, updater, permissions, crash logs, smoke tests pass.

## Delivery Milestones

1. Electron scaffold, app shell, packaging smoke.
2. Runtime embedded locally with chat and sessions.
3. Workspace/files/diff/terminal/tools.
4. Sandbox, MCP, skills, browser automation.
5. Device pairing, web/mobile handoff, cloud sync.
6. Installer signing, auto-update, telemetry/privacy, launch QA.

## Ticket Delivery Discipline

- Keep one ticket per implementation branch unless adjacent tickets must land together to keep the app buildable.
- Use commit messages in the format `desktop: complete D-### short outcome`.
- Include the ticket ID in PR titles, changelog notes, and release QA checklists.
- Do not mark a ticket complete until its acceptance line is demonstrably satisfied on macOS and Windows or explicitly scoped to one platform.
- For runtime, IPC, gateway, and package changes, update contracts and renderer/main process callers in the same ticket.
- Every shipped ticket should include the smallest useful verification: unit test, type check, packaged smoke, or documented manual QA.

## Desktop Differentiators

- First-class local workspace control, not just a web wrapper.
- Runtime event trace that makes actions understandable.
- Real permission model for local files and commands.
- Web/mobile pairing that lets the desktop act as the secure local worker.
- Free, hosted, BYOK, and local model support in one app.
- Optional sandbox for command execution.

## Key Risks

- Electron app size can grow quickly if bundling Node, Python, MCP servers, and VM helpers.
- Windows WSL and macOS Lima behavior must be tested on real machines.
- GUI automation requires sensitive OS permissions and clear user trust.
- Provider keys and hosted auth tokens need OS-native secure storage.
- Existing native macOS app and new Electron app must not fight over ports, gateways, or config files.
