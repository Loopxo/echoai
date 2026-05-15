# EchoAI Web App and Overlay Plan

Status: planning document  
Scope: private EchoAI web product, not the open-source CLI package  
Primary references: `samples/overlay-web-main`, existing `packages/web`, existing `src`, `packages/runtime`, `packages/gateway`, `packages/memory`, `packages/skills`, `packages/browser`, `packages/canvas`

## Product Intent

EchoAI Web should become the browser home for the EchoAI ecosystem. The CLI remains the powerful local developer tool, but the web app becomes the place where users log in, chat with hosted and BYOK models, manage projects, upload knowledge, save memories, create notes, run automations, view outputs, connect integrations, and hand off work to desktop and mobile devices.

The target is not a marketing site only. It is an authenticated work surface with the same core capability as the CLI plus Overlay-style personal workspace features:

- multi-model chat
- free and premium model routing
- BYOK provider keys
- hosted EchoAI premium credits
- project workspaces
- memories
- knowledge/files
- notes
- outputs
- integrations
- MCP servers
- skills
- automations
- session history
- device pairing
- mobile and desktop handoff
- billing, usage, and plan limits
- admin and observability

## Strategic Decision

Build this as a private app package outside the published CLI surface. Keep the open-source CLI/runtime useful, but move paid hosted web, billing, central auth, hosted model routing, provider-key vault, and production sync into private product modules.

Recommended path:

- Keep `echoai` npm CLI open-source.
- Keep core runtime contracts in shareable packages.
- Add private web app under `hosted/echoai-cloud` or a future private repo.
- Reuse only legal, audited code from samples.
- Treat Overlay code as a feature reference unless license is confirmed.
- Treat Open Cowork and Eigent as implementation references for desktop and multi-agent flows.

## Existing EchoAI Assets To Reuse

| Existing area | Reuse |
|---|---|
| `packages/runtime` | Agent kernel, sessions, tools, permissions, background tasks, audit logs, memory hooks |
| `src/runtime/cli-kernel.ts` | Provider-to-runtime adapter pattern |
| `src/providers/*` | Provider clients for EchoAI, OpenAI, Claude, Groq, DeepSeek, Kimi, NIM, Meta |
| `src/models/registry.ts` | Model catalog, filters, capabilities, pricing sync base |
| `src/cli/auth.ts` | Hosted login and usage flow ideas |
| `src/cli/sessions.ts` | Session export, share, resume concepts |
| `src/cli/memory.ts` | Memory CRUD and project memory behavior |
| `src/cli/mcp.ts` | MCP server management flows |
| `src/cli/tasks.ts` | Background task lifecycle |
| `src/review` | Code review heuristics as web action |
| `packages/gateway` | JSON-RPC gateway protocol for desktop/mobile/device sync |
| `channels/*` | Remote channel integrations |
| `packages/web` | Current Astro docs/site package, content and share renderer ideas |
| `apps/android` and `apps/macos` | Device pairing, chat send, gateway connection patterns |

## Sample Code To Study Or Port

| Sample source | Candidate reuse |
|---|---|
| `samples/overlay-web-main/src/app/app/*` | Authenticated app route structure and page split |
| `samples/overlay-web-main/src/components/app/ChatInterface.tsx` | Web chat UI patterns |
| `samples/overlay-web-main/src/components/app/AppSidebar.tsx` | Workspace navigation |
| `samples/overlay-web-main/src/components/app/KnowledgeView.tsx` | File/knowledge UI |
| `samples/overlay-web-main/src/components/app/MemoriesView.tsx` | Memory management UI |
| `samples/overlay-web-main/src/components/app/NotebookEditor.tsx` | TipTap note editor |
| `samples/overlay-web-main/src/components/app/AutomationsInlinePanel.tsx` | Automation UX |
| `samples/overlay-web-main/src/components/app/OutputsView.tsx` | Generated output gallery |
| `samples/overlay-web-main/src/lib/model-data.ts` | Multi-provider model presentation |
| `samples/overlay-web-main/src/lib/model-pricing.ts` | Variable pricing logic |
| `samples/overlay-web-main/src/lib/ai-gateway.ts` | Hosted AI gateway strategy |
| `samples/overlay-web-main/src/lib/openrouter-service.ts` | OpenRouter/free model access strategy |
| `samples/overlay-web-main/src/lib/tools/*` | Tool exposure policy and execution split |
| `samples/overlay-web-main/src/lib/daytona.ts` | Sandbox execution concept |
| `samples/overlay-web-main/src/lib/composio-tools.ts` | App integration tool bridge |
| `samples/overlay-web-main/src/lib/mcp-tools.ts` | MCP-to-web tool bridge |
| `samples/overlay-web-main/convex/*` | Realtime data, usage, files, automations, memories, projects |
| `samples/overlay-web-main/workers/chat-stream` | Durable streaming relay pattern |

## Target Architecture

```text
Browser
  |
  | HTTPS, SSE, WebSocket
  v
EchoAI Web App
  - Next.js app shell
  - authenticated pages
  - chat streaming
  - billing/account UI
  - device handoff UI
  |
  +--> EchoAI Cloud API
  |     - identity
  |     - usage ledger
  |     - hosted model routing
  |     - BYOK vault
  |     - files and knowledge indexing
  |     - project/session storage
  |     - automation runner
  |
  +--> EchoAI Gateway
  |     - local desktop bridge
  |     - mobile bridge
  |     - node/device commands
  |     - live task events
  |
  +--> External Integrations
        - MCP servers
        - Composio-like connectors
        - browser automation
        - sandbox execution
        - storage provider
```

## Data Domains

- Users
- Organizations
- Workspaces
- Projects
- Conversations
- Messages
- Tool calls
- Runs
- Artifacts
- Files
- File chunks
- Embeddings
- Memories
- Notes
- Skills
- MCP servers
- Integrations
- Automations
- Automation runs
- Devices
- Gateway sessions
- Provider keys
- Model catalog
- Usage ledger
- Billing subscriptions
- Entitlements
- Audit logs

## Core Page Map

Public:

- `/`
- `/pricing`
- `/download`
- `/docs`
- `/enterprise`
- `/for-developers`
- `/for-business`
- `/privacy`
- `/terms`
- `/security`

Auth:

- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/callback`
- `/auth/reset-password`
- `/auth/mobile-complete`
- `/account`

App:

- `/app`
- `/app/chat`
- `/app/chat/[sessionId]`
- `/app/projects`
- `/app/projects/[projectId]`
- `/app/projects/[projectId]/chat`
- `/app/projects/[projectId]/files`
- `/app/projects/[projectId]/notes`
- `/app/projects/[projectId]/automations`
- `/app/knowledge`
- `/app/files`
- `/app/notes`
- `/app/memories`
- `/app/outputs`
- `/app/tools`
- `/app/mcp`
- `/app/integrations`
- `/app/automations`
- `/app/sessions`
- `/app/devices`
- `/app/desktop`
- `/app/mobile`
- `/app/usage`
- `/app/billing`
- `/app/settings`
- `/app/settings/models`
- `/app/settings/providers`
- `/app/settings/security`
- `/app/settings/permissions`
- `/app/settings/data`
- `/app/admin`

## Model Strategy

EchoAI should support three model modes:

1. Hosted premium models through EchoAI Cloud credits.
2. Free model pool using providers that expose free or low-cost models, especially OpenRouter free routes, selected Groq/NIM/Kimi options, and promotional hosted allowance.
3. BYOK models where the user stores provider keys in an encrypted vault and pays the provider directly.

Key rules:

- Free models must be rate limited and clearly labeled.
- Premium models must use the same usage ledger as CLI `echoai usage`.
- BYOK keys must never be sent to the public open-source repo or logged.
- Model capabilities must drive UI: tools, reasoning, image input, audio input, output modalities, context length, cost.
- Use `src/models/registry.ts` as the base registry concept, but move live pricing and free-tier routing into private cloud code.

## Web Tickets

### Foundation

- W-001: Create private web app package. Acceptance: app can run independently from the open-source CLI package.
- W-002: Decide final framework. Acceptance: Next.js app router chosen for product app, Astro remains docs-only unless replaced.
- W-003: Define private repo boundary. Acceptance: billing, hosted routing, vault, and user data stay outside npm package.
- W-004: Add shared contracts package. Acceptance: web, desktop, mobile, gateway share typed request/response models.
- W-005: Add environment schema validation. Acceptance: startup fails fast when required private env vars are missing.
- W-006: Add feature flag system. Acceptance: free models, media, integrations, and automations can be enabled per user/org.
- W-007: Add app-wide error boundary. Acceptance: route errors render a useful recovery state.
- W-008: Add observability baseline. Acceptance: server logs, client errors, and run IDs are correlated.
- W-009: Add audit event model. Acceptance: auth, provider key, billing, device, and tool events are recorded.
- W-010: Add seed/demo workspace. Acceptance: internal testing user can load realistic sample sessions and projects.

### Auth and Account

- W-011: Implement sign-in page. Acceptance: user can sign in with email/social provider.
- W-012: Implement sign-up page. Acceptance: new user creates account and gets default workspace.
- W-013: Implement auth callback. Acceptance: auth provider redirects into web app and creates session cookie.
- W-014: Implement mobile auth complete page. Acceptance: mobile deep link can finish web-based auth.
- W-015: Implement logout. Acceptance: session cookie is revoked and user returns to public page.
- W-016: Implement account page. Acceptance: user can view identity, org, plan, and connected devices.
- W-017: Implement organization membership. Acceptance: workspace can have owner/admin/member roles.
- W-018: Implement role permissions. Acceptance: billing, provider keys, and admin pages require correct role.
- W-019: Implement session refresh. Acceptance: long-lived web sessions refresh without losing active chat.
- W-020: Implement auth audit logs. Acceptance: sign-in, sign-out, failed auth, token refresh, and device login are captured.

### App Shell

- W-021: Build authenticated layout. Acceptance: sidebar, top bar, account menu, command palette, and content slot exist.
- W-022: Build responsive shell. Acceptance: desktop, tablet, and mobile browser layouts are usable.
- W-023: Build app sidebar. Acceptance: Chat, Projects, Knowledge, Notes, Memories, Outputs, Tools, Automations, Devices, Settings are visible.
- W-024: Build global search. Acceptance: user can search sessions, projects, notes, files, and memories.
- W-025: Build command palette. Acceptance: user can create chat/project/note/automation from keyboard.
- W-026: Build notification center. Acceptance: task completion, failed automation, device pair request, and billing alerts appear.
- W-027: Build onboarding tour. Acceptance: new user sees setup steps for models, desktop, mobile, and first chat.
- W-028: Build empty states. Acceptance: every core page has a focused next action.
- W-029: Build loading skeletons. Acceptance: all data-heavy pages have stable loading states.
- W-030: Build app theme. Acceptance: EchoAI brand theme works in light and dark mode.

### Chat

- W-031: Build chat route. Acceptance: user can create and open chat sessions.
- W-032: Build streaming chat transport. Acceptance: assistant tokens stream with run ID and reconnect support.
- W-033: Build message persistence. Acceptance: user and assistant turns persist with timestamps and model metadata.
- W-034: Build tool call rendering. Acceptance: file reads, shell commands, MCP calls, and browser tasks render as structured blocks.
- W-035: Build reasoning/thinking display policy. Acceptance: hidden, summarized, or full traces can be controlled by model/provider policy.
- W-036: Build model picker. Acceptance: picker shows hosted, free, BYOK, local, and capability badges.
- W-037: Build mode picker. Acceptance: Ask, Act, Code, Research, Media, and Automation modes map to system prompts/tool sets.
- W-038: Build attachment upload. Acceptance: user can attach image, audio, PDF, DOCX, CSV, text, and code files.
- W-039: Build mention resolver. Acceptance: user can mention projects, files, notes, memories, tools, and devices.
- W-040: Build chat stop and retry. Acceptance: user can abort a run and retry failed turns safely.
- W-041: Build chat branch/fork. Acceptance: user can branch from any message into a new session.
- W-042: Build chat export. Acceptance: export to markdown, JSON, PDF, and DOCX.
- W-043: Build share link. Acceptance: user can create public/private share link with redaction controls.
- W-044: Build local desktop handoff. Acceptance: web chat can ask connected desktop to run local workspace actions.
- W-045: Build mobile handoff. Acceptance: web chat can deliver a run update or request to paired mobile.

### Runtime Integration

- W-046: Wrap `AgentKernel` for server use. Acceptance: cloud chat can execute the same abstract tool lifecycle as CLI.
- W-047: Add server completion provider adapter. Acceptance: hosted and BYOK provider calls plug into kernel.
- W-048: Add web permission resolver. Acceptance: write/process/network tools ask user or follow policy.
- W-049: Add cloud session registry. Acceptance: sessions persist in database instead of local filesystem.
- W-050: Add cloud audit store. Acceptance: kernel approval and tool events persist per user/workspace.
- W-051: Add artifact store. Acceptance: generated files and outputs persist with stable URLs.
- W-052: Add runtime event stream. Acceptance: web UI receives deltas, tool calls, approvals, artifacts, and status.
- W-053: Add background task model. Acceptance: long-running runs survive page refresh.
- W-054: Add compaction service. Acceptance: long sessions summarize automatically with user-visible memory.
- W-055: Add workspace context builder. Acceptance: project files, notes, memories, and selected tools are injected predictably.

### Models and Providers

- W-056: Build model registry table. Acceptance: all models have provider, ID, capabilities, price, free/premium/BYOK status.
- W-057: Import EchoAI provider definitions. Acceptance: existing provider list maps to web provider settings.
- W-058: Add OpenRouter free model routing. Acceptance: free model pool works with rate limits and fallback.
- W-059: Add hosted premium router. Acceptance: EchoAI Cloud routes to premium models and records usage.
- W-060: Add BYOK vault. Acceptance: user keys are encrypted at rest and scoped by workspace/org.
- W-061: Add provider health checks. Acceptance: user can test key and model before saving.
- W-062: Add model capability filters. Acceptance: chat picker can filter for tools, vision, reasoning, audio, image generation.
- W-063: Add cost estimator. Acceptance: before a premium run, UI can estimate approximate cost.
- W-064: Add model fallback chain. Acceptance: if free model fails, system tries configured fallback or asks user.
- W-065: Add model usage dashboard. Acceptance: user can see daily/monthly spend by model/provider/project.

### Projects, Files, and Knowledge

- W-066: Build projects page. Acceptance: user can create, rename, archive, and search projects.
- W-067: Build project detail page. Acceptance: project shows chats, notes, files, memories, automations, outputs.
- W-068: Build file upload flow. Acceptance: files upload with progress, type detection, and failure recovery.
- W-069: Build file tree. Acceptance: user can organize files into folders and project scopes.
- W-070: Build file viewer. Acceptance: PDF, image, markdown, code, CSV, DOCX text, and plain text preview.
- W-071: Build text extraction pipeline. Acceptance: uploaded files produce searchable text when supported.
- W-072: Build embedding pipeline. Acceptance: files are chunked, embedded, and linked to workspace/project.
- W-073: Build lexical search. Acceptance: exact text search works over file names and content.
- W-074: Build semantic search. Acceptance: knowledge retrieval returns relevant chunks with citations.
- W-075: Build file deletion policy. Acceptance: delete removes database records, storage object, chunks, and embeddings.

### Notes and Memories

- W-076: Build notes page. Acceptance: user can create, edit, pin, project-link, and archive notes.
- W-077: Build rich text editor. Acceptance: markdown, tables, code, tasks, links, images, and slash commands work.
- W-078: Build note-to-chat context. Acceptance: user can mention note in chat and include it in context.
- W-079: Build note export. Acceptance: note exports to markdown, PDF, and DOCX.
- W-080: Build memories page. Acceptance: user can view, add, edit, delete, and tag memories.
- W-081: Build memory extraction. Acceptance: assistant can propose memories after useful conversations.
- W-082: Build memory approval. Acceptance: proposed memories require user acceptance unless auto-save is enabled.
- W-083: Build project memory. Acceptance: memories can be global, workspace, or project scoped.
- W-084: Build memory retrieval. Acceptance: relevant memories are injected into prompts with traceable reason.
- W-085: Build memory privacy controls. Acceptance: user can disable, export, or delete memory.

### Tools, MCP, Skills, Integrations

- W-086: Build tools page. Acceptance: available built-in tools show status, permissions, and capability badges.
- W-087: Build MCP server page. Acceptance: user can add, test, disable, and delete MCP server configs.
- W-088: Build MCP tool browser. Acceptance: server tools can be inspected before use.
- W-089: Build skill library page. Acceptance: user can install, create, edit, and delete skills.
- W-090: Build integration catalog. Acceptance: external apps are searchable with install/setup status.
- W-091: Build OAuth integration flow. Acceptance: supported integrations can connect and disconnect safely.
- W-092: Build integration tool exposure. Acceptance: connected apps expose only allowed tools to the agent.
- W-093: Build browser automation tool. Acceptance: web tasks can run in a sandboxed browser session.
- W-094: Build code sandbox tool. Acceptance: web app can run code in a hosted sandbox with quotas.
- W-095: Build tool policy editor. Acceptance: user/admin can set allow/ask/deny per tool category.

### Automations, Outputs, Billing, Devices

- W-096: Build automations page. Acceptance: user can create recurring prompts with schedule, context, and output target.
- W-097: Build automation runner. Acceptance: scheduled jobs run with audit trail and retry policy.
- W-098: Build outputs gallery. Acceptance: generated media, documents, reports, and code artifacts are browsable.
- W-099: Build billing and entitlements. Acceptance: subscription, credits, invoices, and plan limits are visible.
- W-100: Build devices page. Acceptance: desktop and mobile apps pair, show online status, and receive handoff requests.

## Delivery Milestones

1. Private app scaffold, auth, app shell, chat.
2. Hosted/BYOK/free model router, usage ledger, billing.
3. Projects, files, knowledge, memories, notes.
4. Tools, MCP, skills, integrations.
5. Automations, outputs, device handoff.
6. Admin, observability, security hardening, launch.

## Ticket Delivery Discipline

- Keep one ticket per implementation branch unless adjacent tickets must land together to keep the app buildable.
- Use commit messages in the format `web: complete W-### short outcome`.
- Include the ticket ID in PR titles, changelog notes, and release QA checklists.
- Do not mark a ticket complete until its acceptance line is demonstrably satisfied in the authenticated app and relevant API path.
- For private SaaS features, keep billing, hosted routing, provider-key vaulting, and user data outside the published CLI package.
- Every shipped ticket should include the smallest useful verification: unit test, type check, integration smoke, or documented manual QA.

## Build/Buy Decisions

- Use EchoAI runtime for agent lifecycle rather than importing Overlay's agent system wholesale.
- Use Convex-like realtime ideas, but choose backend based on private SaaS needs.
- Use Cloudflare Worker streaming relay only if Vercel/host streaming is unreliable for long runs.
- Use Composio-like connector strategy only if product needs many external app integrations quickly.
- Use a separate encrypted vault service for BYOK provider keys.

## Security Requirements

- No provider keys in browser local storage.
- No secrets in logs.
- Signed, httpOnly session cookies.
- Rate limits on free models, login, native auth, and chat.
- Workspace-level permission policy.
- Tool execution audit logs.
- SSRF protection for fetch/browser tools.
- File upload malware/type checks where practical.
- Hard delete and export flows for user data.

## Success Metrics

- Time from signup to first useful answer under 2 minutes.
- Free model route has low friction but clear upgrade path.
- Paid users can run premium models without managing provider keys.
- BYOK users trust key storage and can inspect usage.
- Desktop and mobile pairing feel native, not bolted on.
- Web session can hand off a local coding task to desktop without losing chat context.
