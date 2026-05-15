# EchoAI Mobile App Plan

Status: planning document  
Scope: private mobile app ecosystem for iOS and Android  
Primary references: existing `apps/ios`, existing `apps/android`, `apps/shared/EchoAIKit`, `samples/overlay-web-main`, `packages/gateway`, `packages/runtime`

## Product Intent

EchoAI Mobile should not be a tiny chat clone. It should be the mobile control surface for the whole EchoAI ecosystem:

- chat with EchoAI from anywhere
- use hosted, free, BYOK, and project-scoped models
- view and resume sessions from web/desktop/CLI
- approve desktop actions remotely
- pair with desktop as a trusted device
- capture camera, screen, audio, files, and location as optional context
- receive notifications when local or cloud tasks finish
- manage projects, memories, notes, files, and automations
- trigger desktop cowork/local agent tasks
- monitor tools, MCP, browser, and terminal runs

Existing code already has meaningful mobile direction:

- Android has gateway discovery, foreground node service, chat controller, canvas, camera, screen recording, voice wake, SMS, location, and device auth.
- iOS has gateway discovery, chat, camera, screen, location, voice, settings, and shared Swift protocol ideas.
- `apps/shared/EchoAIKit` contains protocol and command types that can become the stable cross-platform mobile contract.

## Product Boundary

MVP features are the first shippable private mobile app:

- secure sign-in, sign-out, account state, and token storage
- cloud chat with streaming responses, stop, retry, model picker, and session list
- desktop pairing through QR/manual connection with trusted-device revocation
- mobile approval inbox for desktop file, shell, browser, and MCP actions
- push notifications for approvals and run completion
- project picker, basic project detail, file upload, and share sheet intake
- camera capture, audio capture, and optional location context
- settings for models, notifications, permissions, privacy, and debug log export
- iOS TestFlight and Android internal-track builds with a focused QA checklist

Pro features are paid/private-workflow upgrades after MVP stability:

- hybrid cloud-to-desktop handoff for local workspace tasks
- remote desktop run monitoring with logs, file changes, diffs, and browser status
- mobile memory management, memory approvals, notes, and richer project knowledge
- premium hosted model routing, BYOK preference controls, usage, and workspace switching
- automation monitoring and mobile controls for scheduled tasks
- encrypted local cache for sensitive sessions, files, and offline capture queue
- desktop wake, remote tunnel support, and web handoff for active sessions

Later features need platform, policy, or demand validation before build:

- always-on voice wake on iOS beyond supported foreground/background limits
- Android SMS capability unless product policy justifies the permission burden
- iOS screen capture flows outside platform-supported broadcast/web-view scenarios
- advanced media capture beyond first-party camera/audio context
- organization admin controls that duplicate the web app without mobile-specific value
- full mobile-first editing of generated artifacts when web/desktop are better surfaces

## Strategic Decision

Use native iOS and Android for device capabilities, not a simple webview. Use shared contracts and a common backend/gateway protocol so behavior remains consistent.

Recommended structure:

- Keep native SwiftUI iOS under `apps/ios`.
- Keep native Kotlin/Compose Android under `apps/android`.
- Promote `apps/shared/EchoAIKit` into a complete shared Swift package for iOS/macOS.
- Add generated TypeScript/Kotlin/Swift contracts from the same schema.
- Build mobile features against EchoAI Cloud and local desktop gateway.

## Existing EchoAI Assets To Reuse

| Existing area | Reuse |
|---|---|
| `apps/android/app/src/main/java/ai/echoai/android` | New Android app foundation |
| `apps/android/app/src/main/java/ai/echoai/android/NodeRuntime.kt` | Runtime coordinator, gateway sessions, device capabilities |
| `apps/android/app/src/main/java/ai/echoai/android/gateway/*` | Gateway discovery, TLS, session, auth |
| `apps/android/app/src/main/java/ai/echoai/android/chat/*` | Mobile chat controller and models |
| `apps/android/app/src/main/java/ai/echoai/android/node/*` | Camera, canvas, location, screen record, SMS managers |
| `apps/android/app/src/main/java/ai/echoai/android/voice/*` | Voice wake and talk mode |
| `apps/ios/EchoAI/Sources/Gateway/*` | iOS gateway discovery and connection |
| `apps/ios/EchoAI/Sources/Chat/*` | iOS chat transport and chat sheet |
| `apps/ios/EchoAI/Sources/Camera/*` | Camera controller |
| `apps/ios/EchoAI/Sources/Location/*` | Location service |
| `apps/ios/EchoAI/Sources/Screen/*` | Screen capture/web view concepts |
| `apps/ios/EchoAI/Sources/Voice/*` | Voice wake/talk mode |
| `apps/shared/EchoAIKit/Sources/*` | Shared protocol, command, device, auth, canvas, gateway, storage types |
| `packages/gateway` | JSON-RPC device protocol to desktop/cloud |
| `samples/overlay-web-main/src/lib/mobile-auth-client.ts` | Mobile auth transfer concept |
| `samples/overlay-web-main/src/app/auth/mobile-complete/page.tsx` | Web-to-mobile auth completion |

## Current Mobile Cleanup Needed

Android currently has both:

- newer package: `ai.echoai.android`
- older prototype package: `com.echoai`

The old `com.echoai` Kotlin files look like an earlier simple chat app and should be removed or moved to samples after confirming they are unused. They import Gson, while the main Gradle dependencies do not show Gson. The manifest points to `.MainActivity` under namespace `ai.echoai.android`, so the newer package is the real target.

iOS and shared Swift package manifests need verification. Some package target paths referenced by `apps/shared/EchoAIKit/Package.swift` may not match the flat current source layout. This must be fixed before relying on shared package builds.

## Target Architecture

```text
iOS App / Android App
  - chat
  - sessions
  - projects
  - capture context
  - approvals
  - devices
  - notifications
  - voice
  |
  +--> EchoAI Cloud
  |     - auth
  |     - hosted chat
  |     - synced sessions/projects/files/memory
  |     - push notifications
  |     - billing/usage
  |
  +--> Desktop Gateway
  |     - local workspace actions
  |     - terminal/task events
  |     - approval requests
  |     - device capabilities
  |
  +--> Device Node
        - camera
        - mic/voice
        - screen capture
        - location
        - local files/share sheet
        - notifications
```

## Mobile App Modes

1. Cloud mode: user talks to EchoAI Cloud directly.
2. Desktop-paired mode: user controls a nearby or remote desktop runtime.
3. Hybrid mode: cloud chat can hand off local tasks to desktop.
4. Offline capture mode: user saves voice/file/photo notes to sync later.

## Mobile Page Map

Shared:

- Launch
- Sign in
- Sign up
- Auth callback
- Pair desktop
- Home
- Chat list
- Chat detail
- New chat
- Project list
- Project detail
- Files
- File detail
- Notes
- Note editor
- Memories
- Automations
- Automation detail
- Tasks/runs
- Run detail
- Approvals
- Devices
- Desktop remote
- Capture
- Voice
- Notifications
- Account
- Usage
- Settings
- Debug/logs

iOS-specific:

- Local network permission screen
- Speech recognition permission screen
- Microphone permission screen
- Camera permission screen
- Location permission screen
- Screen broadcast/screen web view flow
- Share extension intake

Android-specific:

- Nearby Wi-Fi/location discovery permission
- Foreground service setup
- Notification permission
- Camera permission
- Microphone permission
- Media projection permission
- SMS permission if retained
- Share sheet intake
- Battery optimization guidance

## Mobile Tickets

### Product Foundation

- M-001: Define mobile product boundary. Acceptance: mobile feature list is separated into MVP, pro, and later.
- M-002: Define shared protocol schema. Acceptance: cloud, desktop, iOS, Android, and web share typed contracts.
- M-003: Define device trust model. Acceptance: paired device, logged-in cloud device, and guest device behaviors are clear.
- M-004: Define private app distribution. Acceptance: App Store, Play Store, TestFlight, internal APK tracks are planned.
- M-005: Define mobile data policy. Acceptance: what syncs, stores locally, and deletes is documented.
- M-006: Define mobile permissions policy. Acceptance: every OS permission has clear user-facing purpose.
- M-007: Define mobile analytics policy. Acceptance: telemetry is opt-in/controlled and excludes prompt contents unless explicitly allowed.
- M-008: Define feature flags. Acceptance: capture, SMS, voice wake, screen record, and desktop control can be disabled by plan/org/platform.
- M-009: Define mobile design system. Acceptance: iOS and Android share visual language while respecting platform norms.
- M-010: Define QA device matrix. Acceptance: supported iOS/Android versions and required test devices are listed.

### Shared Contracts and Backend

- M-011: Create canonical API contract. Acceptance: auth, chat, sessions, devices, approvals, files, projects, automations are typed.
- M-012: Generate Swift models. Acceptance: iOS compiles generated request/response types.
- M-013: Generate Kotlin models. Acceptance: Android compiles generated request/response types.
- M-014: Generate TypeScript models. Acceptance: web/desktop/cloud use same schema.
- M-015: Add contract versioning. Acceptance: old mobile clients can be rejected or downgraded safely.
- M-016: Add mobile session API. Acceptance: list, get, send, abort, resume chat work through cloud.
- M-017: Add mobile project API. Acceptance: list projects and project context from cloud.
- M-018: Add mobile files API. Acceptance: upload, list, preview metadata, delete files.
- M-019: Add mobile device API. Acceptance: register, pair, unpair, list, revoke devices.
- M-020: Add mobile approval API. Acceptance: approval requests can be fetched, approved, denied, and audited.

### Auth and Account

- M-021: Implement mobile sign-in. Acceptance: iOS and Android can sign in through secure browser flow.
- M-022: Implement mobile sign-up. Acceptance: new user can create account and first workspace.
- M-023: Implement web-to-mobile auth complete. Acceptance: browser auth can deep-link back to mobile.
- M-024: Implement token storage iOS. Acceptance: tokens stored in Keychain.
- M-025: Implement token storage Android. Acceptance: tokens stored with encrypted preferences/keystore.
- M-026: Implement refresh tokens. Acceptance: mobile stays signed in without manual relogin.
- M-027: Implement logout. Acceptance: local tokens and sensitive cache are cleared.
- M-028: Implement account page. Acceptance: user can view plan, usage, devices, and workspace.
- M-029: Implement org/workspace switcher. Acceptance: user can switch workspace if multiple exist.
- M-030: Implement auth audit display. Acceptance: user sees recent login and device events.

### Device Pairing and Gateway

- M-031: Implement desktop discovery iOS. Acceptance: iOS can discover local EchoAI gateway via Bonjour/local network.
- M-032: Implement desktop discovery Android. Acceptance: Android can discover local EchoAI gateway via mDNS/DNS-SD/manual entry.
- M-033: Implement manual gateway connect. Acceptance: user can enter host, port, TLS option, and token.
- M-034: Implement QR pairing. Acceptance: desktop displays QR and mobile pairs securely.
- M-035: Implement pair approval. Acceptance: desktop must approve new mobile device.
- M-036: Implement TLS pinning. Acceptance: gateway identity is remembered and mismatch warns user.
- M-037: Implement reconnect logic. Acceptance: mobile reconnects after app foreground/network change.
- M-038: Implement paired device list. Acceptance: mobile shows desktop status, name, workspace, and capabilities.
- M-039: Implement unpair/revoke. Acceptance: user can remove a desktop/mobile trust link.
- M-040: Implement remote tunnel support. Acceptance: mobile can connect to desktop through cloud/tunnel when enabled.

### Chat

- M-041: Build chat list. Acceptance: synced cloud and desktop sessions appear with source labels.
- M-042: Build chat detail. Acceptance: messages stream and persist with markdown/tool blocks.
- M-043: Build new chat flow. Acceptance: user can choose cloud, desktop, project, and model.
- M-044: Build model picker. Acceptance: hosted, free, BYOK, and desktop/local models are visible by capability.
- M-045: Build chat send. Acceptance: text prompt sends to cloud or desktop gateway.
- M-046: Build streaming display. Acceptance: assistant output updates live and survives brief disconnect.
- M-047: Build stop button. Acceptance: user can abort active cloud/desktop run.
- M-048: Build retry/edit. Acceptance: user can retry failed mobile turns.
- M-049: Build attachment picker. Acceptance: user can add image, document, audio, and file attachments.
- M-050: Build share target intake. Acceptance: mobile share sheet can send files/text/URLs into EchoAI chat.

### Tool Trace and Approvals

- M-051: Build run status screen. Acceptance: user can inspect active and completed runs.
- M-052: Build tool call cards. Acceptance: file, shell, browser, MCP, and desktop actions render clearly.
- M-053: Build approval inbox. Acceptance: pending local/desktop approvals show high-priority notifications.
- M-054: Build approve/deny flow. Acceptance: decision is signed/sent and desktop continues or stops.
- M-055: Build approval details. Acceptance: user sees command/path/tool/risk/reason before approval.
- M-056: Build timeout handling. Acceptance: expired approval requests are marked and not actionable.
- M-057: Build remote logs. Acceptance: mobile can view tail of active desktop task logs.
- M-058: Build desktop screen snapshot preview. Acceptance: if allowed, mobile can see current GUI/browser task state.
- M-059: Build push notifications for approvals. Acceptance: approval request wakes mobile with deep link.
- M-060: Build safety warnings. Acceptance: destructive or external actions show stronger confirmation.

### Projects, Files, Notes, Memories

- M-061: Build project list. Acceptance: projects sync and can be searched.
- M-062: Build project detail. Acceptance: chats, notes, files, memories, automations, and outputs are grouped.
- M-063: Build file upload. Acceptance: photos, videos, documents, and files upload with progress.
- M-064: Build file preview. Acceptance: image, text, PDF metadata, markdown, and code preview work.
- M-065: Build camera capture. Acceptance: user can capture image/video into chat or project.
- M-066: Build audio capture. Acceptance: user can record audio and send/transcribe to chat.
- M-067: Build note list. Acceptance: notes can be viewed and searched.
- M-068: Build note editor. Acceptance: lightweight markdown/rich text editing works on mobile.
- M-069: Build memories page. Acceptance: user can add/edit/delete memories from mobile.
- M-070: Build memory suggestions. Acceptance: assistant-proposed memories can be approved from mobile.

### Desktop Remote Control

- M-071: Build desktop home. Acceptance: paired desktop status, workspace, active run, and quick actions show.
- M-072: Build send-to-desktop prompt. Acceptance: mobile can ask desktop to work in current local workspace.
- M-073: Build workspace selector. Acceptance: mobile can choose from desktop-approved workspaces.
- M-074: Build desktop terminal run view. Acceptance: mobile can monitor long command output.
- M-075: Build desktop file changed view. Acceptance: mobile can inspect files changed by agent.
- M-076: Build remote diff approval. Acceptance: mobile can approve/reject pending patch from desktop.
- M-077: Build desktop browser task view. Acceptance: mobile can monitor browser automation status.
- M-078: Build desktop notification controls. Acceptance: user chooses which desktop events notify mobile.
- M-079: Build wake desktop flow. Acceptance: if supported, mobile can request desktop gateway activation.
- M-080: Build handoff back to web. Acceptance: mobile can open the same session in web app.

### Voice, Capture, and Native Device Features

- M-081: Build push-to-talk. Acceptance: user can dictate prompt and send to chat.
- M-082: Build voice wake iOS feasibility. Acceptance: constraints and supported foreground/background behavior documented.
- M-083: Build voice wake Android. Acceptance: foreground service can listen when enabled and permitted.
- M-084: Build talk mode. Acceptance: assistant can speak responses when user enables it.
- M-085: Build camera context command. Acceptance: agent can request camera capture only after explicit user permission.
- M-086: Build location context command. Acceptance: user can share approximate or precise location per request or setting.
- M-087: Build screen capture Android. Acceptance: Android MediaProjection flow can stream/snapshot when user starts it.
- M-088: Build screen flow iOS. Acceptance: iOS screen capability is scoped to what platform allows and documented.
- M-089: Build SMS capability decision. Acceptance: SMS feature is either product-approved with strict permission or removed.
- M-090: Build offline capture queue. Acceptance: notes/photos/audio captured offline sync later.

### Settings, Security, and Release

- M-091: Build settings home. Acceptance: account, models, devices, permissions, notifications, privacy, debug are accessible.
- M-092: Build model settings. Acceptance: default model and free/premium/BYOK preference can be selected.
- M-093: Build notification settings. Acceptance: user controls run complete, approval, automation, billing, and device alerts.
- M-094: Build permission dashboard. Acceptance: user sees OS permissions and why each is used.
- M-095: Build privacy/export/delete. Acceptance: user can export/delete local mobile cache and request account data deletion.
- M-096: Build local cache encryption. Acceptance: sensitive cached sessions/files/tokens are protected.
- M-097: Build debug logs. Acceptance: user can export redacted logs for support.
- M-098: Add iOS build pipeline. Acceptance: TestFlight build can be produced with correct signing.
- M-099: Add Android build pipeline. Acceptance: debug/release APK or AAB can be produced with correct signing.
- M-100: Add mobile QA checklist. Acceptance: auth, chat, pairing, approval, upload, push, background, and logout are tested.

## Delivery Milestones

1. Mobile auth, cloud chat, session list.
2. Desktop pairing and gateway chat.
3. Approvals, notifications, and run monitoring.
4. Projects, files, notes, memories.
5. Capture features: camera, audio, share sheet, optional location/screen.
6. Release hardening, store builds, privacy/security review.

## Ticket Delivery Discipline

- Keep one ticket per implementation branch unless adjacent tickets must land together to keep the app buildable.
- Use commit messages in the format `mobile: complete M-### short outcome`.
- Include the ticket ID in PR titles, changelog notes, and release QA checklists.
- Do not mark a ticket complete until its acceptance line is demonstrably satisfied on both target platforms or explicitly scoped to one platform.
- For shared protocol work, update Swift, Kotlin, and TypeScript contracts in the same ticket or document why one client is intentionally deferred.
- Every shipped ticket should include the smallest useful verification: unit test, build check, simulator/device smoke, or documented manual QA.

## iOS Notes

- Use SwiftUI and async/await.
- Store tokens in Keychain.
- Treat background voice/screen behavior carefully because iOS restrictions are strict.
- Use local network permission for gateway discovery.
- Use push notifications for approvals and run completion.
- Keep shared protocol code in a properly structured Swift package.

## Android Notes

- Use Kotlin and Jetpack Compose.
- Remove or isolate the old `com.echoai` prototype tree if unused.
- Foreground service is required for voice wake, screen capture, and persistent node behavior.
- Nearby Wi-Fi, location, notification, camera, microphone, and media projection permissions must be requested only when needed.
- Use encrypted preferences/Android Keystore for credentials.

## Success Metrics

- User can install mobile app, sign in, and send first chat in under 2 minutes.
- User can pair desktop from QR/manual flow in under 1 minute.
- Approval notification to decision round trip is under 10 seconds.
- Mobile can reliably resume sessions started on CLI, desktop, or web.
- Mobile capture creates useful context without surprising privacy behavior.
- Desktop remote control feels secure enough for real local coding tasks.
