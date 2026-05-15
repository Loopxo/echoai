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

Existing code already has meaningful mobile direction, but the product app is now React Native-only:

- Android has gateway discovery, foreground node service, chat controller, canvas, camera, screen recording, voice wake, SMS, location, and device auth that can be wrapped or ported behind React Native native modules when needed.
- iOS has gateway discovery, chat, camera, screen, location, voice, settings, and shared Swift protocol ideas that can be wrapped or ported behind React Native native modules when needed.
- `packages/types` contains the canonical TypeScript protocol contract that the React Native app consumes directly.

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

Build one React Native mobile product for iOS and Android. Use TypeScript-first shared contracts and isolate platform-specific capability work behind explicit React Native native modules only when JavaScript cannot access the OS feature directly.

Recommended structure:

- Add the React Native app under `apps/mobile`.
- Keep existing `apps/ios` and `apps/android` as reference/prototype code until replaced or wrapped.
- Use `packages/types/src/mobile.ts` as the contract source for the app.
- Put iOS/Android-only features behind small native modules with a TypeScript interface and feature flag.
- Build mobile features against EchoAI Cloud and local desktop gateway.

## Shared Protocol Schema

The canonical mobile protocol starts in `@echoai/types` at `packages/types/src/mobile.ts`. The React Native app imports this contract directly. It defines:

- protocol version and target platforms for cloud, web, desktop, iOS, and Android
- shared entities for auth state, workspaces, models, sessions, messages, files, projects, devices, approvals, and automations
- method names and request/response maps for the first mobile API surface
- chat/run event names for streaming, tool progress, approval requests, and run status
- a `mobileProtocolSchema` inventory that app code and future generators can use
- a `mobileApiContract` map that assigns each method to a domain, transport, auth requirement, request type, and response type

M-012, M-013, and M-014 now target React Native TypeScript models, client helpers, and native module interface definitions instead of generated Swift/Kotlin app models.

React Native API client helpers for M-014 live under `apps/mobile/src/api` and use the shared method constants plus request/response maps from `@echoai/types`.

## Device Trust Model

Mobile devices can exist in five trust states:

| State | Identity | Allowed behavior | Blocked behavior |
|---|---|---|---|
| Guest | No cloud login and no desktop pair | View public/auth screens, start sign-in, scan pairing QR | Chat, sync, approvals, desktop control, push |
| Cloud-authenticated | Signed in through EchoAI Cloud with secure local token storage | Cloud chat, session list, project/file upload, account settings, push for cloud runs | Local desktop actions until a desktop pair is approved |
| Pairing | Cloud-authenticated device has requested trust with a desktop gateway | Show pairing challenge, wait for desktop approval, retry/expire pairing | Remote shell/file/browser control and approvals |
| Trusted paired device | Desktop approved the mobile device and TLS/gateway identity is pinned | Send desktop prompts, view allowed run status/logs, approve/deny desktop actions, revoke trust | Access unapproved workspaces, bypass desktop policy, approve expired requests |
| Revoked | User, org, or desktop revoked the device | Local cache cleanup, sign in again, request new pairing | Sync, push, desktop gateway access, approval decisions |

Trust rules:

- Cloud login proves the user account; desktop pairing proves permission to control one desktop runtime.
- A trusted mobile device is scoped to the workspace and desktop capabilities granted by the desktop app.
- Approval decisions must include device ID, account ID, approval ID, timestamp, and request hash for audit.
- TLS pinning or equivalent gateway identity binding is required before a mobile device can issue desktop-control calls.
- Revocation from cloud or desktop takes precedence over cached mobile state and must force reconnect/re-auth.
- Guest devices never receive push notifications or approval payloads.

## Private App Distribution

Distribution should stay private until cloud billing, provider-key vaulting, push notifications, and desktop pairing are production-ready.

| Channel | Audience | Build type | Gate |
|---|---|---|---|
| iOS local debug | Engineers | Xcode debug build | Manual simulator/device smoke |
| iOS TestFlight internal | Team and trusted testers | Signed release/TestFlight build | Auth, chat, pairing, push, logout smoke pass |
| iOS App Store public/private listing | Production users or approved orgs | App Store release | Privacy labels, review notes, account deletion, support URL, security review |
| Android local debug | Engineers | Debug APK | Emulator/device smoke |
| Android internal testing | Team and trusted testers | Signed AAB/APK | Auth, chat, pairing, push, logout smoke pass |
| Android closed/open testing | Beta users | Play-signed AAB | Store listing, data safety, permissions review, crash threshold |
| Enterprise/internal APK | Managed orgs only | Signed APK/AAB | MDM/install docs, update policy, revocation path |

Release rules:

- App identifiers stay `ai.echoai.android` for Android and the EchoAI iOS bundle ID defined by the Xcode project.
- Signing certificates, provisioning profiles, Play upload keys, and push credentials are private infrastructure secrets, not repo content.
- Test builds may target staging cloud endpoints; production builds must reject staging endpoints unless a debug entitlement is present.
- Store submissions must include permission rationale for camera, microphone, local network, notifications, location, and screen capture where applicable.
- External distribution waits until M-098, M-099, and M-100 pass on the supported device matrix.

## Mobile Data Policy

Data classes:

| Data | Local storage | Cloud sync | Delete/export behavior |
|---|---|---|---|
| Auth tokens | Keychain/Keystore only | Token metadata only | Logout removes local tokens; account deletion revokes server tokens |
| Device identity and pairing keys | Secure local storage | Device registry and audit metadata | Revocation removes pairing keys and disables push |
| Chat messages | Encrypted cache for recent sessions | Synced when cloud or hybrid mode is enabled | Export by workspace/session; delete removes cache and cloud copy where owned |
| Desktop gateway transcripts | Cache only for user-visible run state | Sync only when user/org enables desktop sync | Desktop remains source of truth unless exported |
| Files and attachments | Temporary upload cache and previews | Uploaded to selected workspace/project | Delete removes local cache, object storage, indexing rows, and embeddings |
| Camera/audio/location captures | Pending upload queue until sent | Synced only after explicit send/share action | User can delete unsent captures locally |
| Memories and notes | Encrypted cache for offline viewing/editing | Synced by workspace/project scope | Export/delete through memory and notes APIs |
| Approvals and audit events | Minimal local history for recent decisions | Required server/desktop audit record | Audit records are retained by policy even after local cache clear |
| Debug logs | Redacted rotating local files | Uploaded only by explicit support action | User can clear local logs; support bundle excludes prompts by default |

Policy rules:

- Prompt, message, file, and capture content must not enter analytics events.
- Sensitive cache uses platform-backed encryption before M-096 is marked complete.
- Offline capture queues must show pending state and never silently upload over an unexpected workspace.
- Cloud sync is per workspace and must respect org policy, user logout, and revoked device state.
- Local cache clear is available without deleting the cloud account.
- Account deletion and data export are coordinated with web/cloud APIs, but mobile must expose the entry point.

## Mobile Permissions Policy

Permissions are requested just in time, with a pre-permission explanation tied to the user action that needs access.

| Permission | Platform | Purpose | Request trigger | Owning tickets |
|---|---|---|---|---|
| Local network / Bonjour | iOS | Discover nearby desktop gateway | Pair desktop flow | M-031, M-034 |
| Nearby Wi-Fi / location discovery | Android | Discover mDNS/DNS-SD desktop gateway | Pair desktop flow | M-032, M-034 |
| Camera | iOS/Android | Capture image/video context and scan pairing QR | Camera capture or QR pairing | M-034, M-065, M-085 |
| Microphone | iOS/Android | Push-to-talk, audio capture, talk mode input | Voice/audio action | M-066, M-081, M-084 |
| Speech recognition | iOS where needed | Dictation/transcription when native speech is used | Push-to-talk setup | M-081 |
| Notifications | iOS/Android | Approval requests, run completion, automation alerts | User enables notifications or pairs device | M-059, M-093 |
| Location | iOS/Android | Optional user-approved location context | User taps share location or enables location context | M-086 |
| Media/files/photos | iOS/Android | Attach documents, images, audio, and share sheet intake | Attachment picker or share target | M-049, M-050, M-063 |
| Screen recording / MediaProjection | Android | User-started screen context stream/snapshot | Screen capture action | M-087 |
| Screen broadcast / web-view flow | iOS | Platform-supported screen context capture | Screen flow action | M-088 |
| Foreground service | Android | Persistent voice wake, screen capture, and node mode | Enabling background-capable feature | M-083, M-087 |
| Battery optimization exemption | Android | Keep explicit foreground node/session alive when user opts in | Background node setup | M-083, M-090 |
| SMS | Android only if retained | Optional message capability after product approval | Disabled until M-089 decision | M-089 |

Permission rules:

- No permission is requested during first launch unless the user explicitly starts the related flow.
- Denied permissions leave the app usable with the feature disabled and a clear recovery path in settings.
- Background-capable permissions require stronger copy and a visible status indicator while active.
- SMS stays behind a feature flag and is removed from release builds unless product/security approval keeps it.
- The permission dashboard must show OS permission state, EchoAI feature owner, and current enabled/disabled setting.

## Mobile Analytics Policy

Analytics default to product/reliability metadata only. Prompt text, assistant text, file content, attachment content, location coordinates, command output, approval details, and provider keys are never analytics payloads.

Allowed event groups:

| Group | Example events | Allowed properties |
|---|---|---|
| Activation | app installed, first launch, sign-in started/completed, first chat sent | app version, platform, build channel, workspace plan, duration, success/failure |
| Reliability | chat stream failed, reconnect attempted, push delivery opened, upload failed | error code, network type, retry count, endpoint class, source cloud/desktop |
| Feature usage | model picker opened, desktop pairing started, approval decided, share sheet used | feature name, source, boolean success, coarse item counts |
| Performance | cold start, chat first-token latency, upload duration, pairing duration | duration buckets, payload size buckets, device class |
| Billing/entitlement | paywall shown, usage page opened, entitlement blocked | plan tier, entitlement key, route source |

Controls:

- Users can disable product analytics from mobile privacy settings.
- Enterprise/org policy can force analytics off or restrict it to reliability events.
- Crash logs and support bundles are separate from analytics and require redaction before upload.
- Any new analytics event touching chat, files, desktop control, approvals, or location needs privacy review.
- Analytics event names and properties must be documented next to the implementation before release.

## Mobile Feature Flags

The shared flag keys live in `packages/types/src/mobile.ts` as `MobileFeatureFlags` with defaults in `mobileFeatureFlagDefaults`.

| Flag | Default | Purpose |
|---|---|---|
| `mobile.capture.camera` | on | Camera capture and QR pairing |
| `mobile.capture.audio` | on | Audio capture and push-to-talk |
| `mobile.capture.location` | on | Optional per-request location context |
| `mobile.capture.screen.android` | off | Android MediaProjection screen context |
| `mobile.capture.screen.ios` | off | iOS screen/broadcast flow experiments |
| `mobile.capture.share-sheet` | on | OS share sheet intake |
| `mobile.capability.sms.android` | off | Android SMS capability pending M-089 |
| `mobile.voice.wake.android` | off | Android foreground-service voice wake |
| `mobile.voice.wake.ios-feasibility` | off | iOS voice wake feasibility testing |
| `mobile.desktop.control` | on | Paired desktop prompts, approvals, and run monitoring |
| `mobile.desktop.remote-tunnel` | off | Cloud/tunnel path to desktop gateway |
| `mobile.approvals.push` | on | Push notifications for approval requests |
| `mobile.offline.capture-queue` | off | Offline notes/photos/audio sync queue |

Flag rules:

- Remote/org/workspace policy overrides defaults; local debug overrides are not allowed in release builds.
- Disabled flags must hide the entry point and reject deep links/API calls for that feature.
- Permission requests must check the matching flag before asking the OS.
- SMS, screen capture, voice wake, and remote tunnel stay off until security and platform QA explicitly enable them.

## Mobile Design System

The mobile design system should keep EchoAI recognizable while using React Native components that respect platform conventions.

Shared principles:

- The primary app surface is a dense work/control app, not a marketing page.
- Chat, approvals, run status, pairing, and capture actions should be reachable with one-handed mobile use.
- Gateway state uses the same semantic status everywhere: connected, connecting, error, offline.
- Permission and approval surfaces use direct language, visible risk level, and the exact action being requested.
- Voice/talk mode uses an orb/status treatment, but active recording/listening state must always be explicit.
- Cards are reserved for repeated records such as sessions, projects, files, runs, approvals, and devices.
- Platform-specific React Native controls can be used where behavior is OS-standard.

Shared tokens:

| Token | iOS direction | Android direction |
|---|---|---|
| Status success | system green | Material success/green |
| Status warning | system yellow/orange | Material warning/yellow |
| Status danger | system red | Material error/red |
| Status offline | secondary/gray | onSurfaceVariant/gray |
| Overlay surface | Blur/material-style React Native surface where available | Material-style React Native surface container with controlled alpha |
| Compact radius | 14pt for pills/overlays | 14dp for pills/overlays |
| Iconography | SF Symbols | Material Icons |
| Motion | short React Native transitions, reduced-motion aware | short React Native transitions, reduced-motion aware |

Component baseline:

- Status pill: gateway state, active mode/activity, tap target to status/settings.
- Chat composer: text, attachment, voice, send/stop, model/session source.
- Approval card: tool name, risk, affected resource, timeout, approve/deny.
- Device card: platform, trust state, last seen, revoke action.
- Capture sheet: camera/audio/file/location actions with permission state.
- Settings rows: title, short status, disclosure/toggle, never long explanatory paragraphs.

Accessibility rules:

- Every icon-only control has a localized accessibility label.
- Dynamic type must not clip approval, permission, or destructive-action text.
- Color is never the only status signal.
- Motion-sensitive users get static connection/listening indicators.

## Mobile QA Device Matrix

Current React Native baseline:

- One React Native TypeScript app under `apps/mobile`.
- iOS and Android builds are produced from the same app package.
- Native prototype code under `apps/ios` and `apps/android` is reference material, not the target product surface.

Required smoke devices:

| Platform | Minimum | Primary | Large/edge | Required coverage |
|---|---|---|---|---|
| iOS | iPhone on iOS 18 | Current iPhone standard size | iPad or large iPhone | Auth, cloud chat, local network prompt, QR pairing, push, camera, microphone, location, logout |
| Android | API 31 device/emulator | Current Pixel API 36 | Large-screen Android/tablet or foldable emulator | Auth, cloud chat, mDNS/manual pairing, push, camera, microphone, share sheet, foreground service, logout |

Release blockers:

- Sign-in, chat send/stream/stop, session resume, and logout pass on every required smoke device.
- Pairing and TLS identity mismatch handling pass on one physical iOS and one physical Android device on the same LAN as desktop gateway.
- Push notification deep links work for approval requests and run completion on both platforms.
- Permission denial paths are tested for camera, microphone, location, notifications, and local network/discovery.
- Android foreground-service notification remains visible while screen capture or voice wake is active.
- No release build contains debug endpoints, local debug feature overrides, or unredacted support logging.

Nice-to-have coverage:

- Low-connectivity network, airplane-mode recovery, and app foreground/background reconnect.
- Small screen dynamic type / font scaling.
- Dark/light mode and system reduced-motion setting.
- Upgrade from previous TestFlight/internal build without losing tokens or pairing state.

## Existing EchoAI Assets To Reuse

| Existing area | Reuse |
|---|---|
| `apps/mobile` | React Native product app target |
| `packages/types/src/mobile.ts` | React Native TypeScript mobile protocol source |
| `apps/android/app/src/main/java/ai/echoai/android` | Reference code for Android native modules |
| `apps/android/app/src/main/java/ai/echoai/android/NodeRuntime.kt` | Reference runtime coordinator, gateway sessions, device capabilities |
| `apps/android/app/src/main/java/ai/echoai/android/gateway/*` | Reference gateway discovery, TLS, session, auth |
| `apps/android/app/src/main/java/ai/echoai/android/chat/*` | Reference chat controller and models |
| `apps/android/app/src/main/java/ai/echoai/android/node/*` | Reference camera, canvas, location, screen record, SMS managers |
| `apps/android/app/src/main/java/ai/echoai/android/voice/*` | Reference voice wake and talk mode |
| `apps/ios/EchoAI/Sources/Gateway/*` | Reference code for iOS gateway native module |
| `apps/ios/EchoAI/Sources/Chat/*` | Reference code for chat transport behavior |
| `apps/ios/EchoAI/Sources/Camera/*` | Reference code for camera native module |
| `apps/ios/EchoAI/Sources/Location/*` | Reference code for location native module |
| `apps/ios/EchoAI/Sources/Screen/*` | Reference code for screen capture/web view concepts |
| `apps/ios/EchoAI/Sources/Voice/*` | Reference code for voice/talk mode native module |
| `packages/gateway` | JSON-RPC device protocol to desktop/cloud |
| `samples/overlay-web-main/src/lib/mobile-auth-client.ts` | Mobile auth transfer concept |
| `samples/overlay-web-main/src/app/auth/mobile-complete/page.tsx` | Web-to-mobile auth completion |

## Current Mobile Cleanup Needed

Android currently has both:

- newer package: `ai.echoai.android`
- older prototype package: `com.echoai`

The old `com.echoai` Kotlin files look like an earlier simple chat app and should be removed or moved to samples after confirming they are unused. They import Gson, while the main Gradle dependencies do not show Gson. The manifest points to `.MainActivity` under namespace `ai.echoai.android`, so the newer package is the real target.

Existing native manifests can be fixed later only if native modules need them. React Native app delivery should not depend on compiling the prototype SwiftUI/Kotlin apps.

## Target Architecture

```text
React Native App
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
- M-012: Add React Native TypeScript protocol exports. Acceptance: mobile app imports shared request/response types from `@echoai/types`.
- M-013: Define React Native native module interfaces. Acceptance: gateway discovery, TLS, push, camera, audio, location, screen, and secure storage interfaces are typed.
- M-014: Add TypeScript API client helpers. Acceptance: web/desktop/cloud/mobile use the same method constants and request/response maps.
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
- M-024: Implement React Native secure token storage. Acceptance: iOS uses Keychain and Android uses Keystore-backed encrypted storage through one TypeScript API.
- M-025: Implement secure storage recovery/error states. Acceptance: locked, unavailable, corrupted, and revoked credential states are handled on both platforms.
- M-026: Implement refresh tokens. Acceptance: mobile stays signed in without manual relogin.
- M-027: Implement logout. Acceptance: local tokens and sensitive cache are cleared.
- M-028: Implement account page. Acceptance: user can view plan, usage, devices, and workspace.
- M-029: Implement org/workspace switcher. Acceptance: user can switch workspace if multiple exist.
- M-030: Implement auth audit display. Acceptance: user sees recent login and device events.

### Device Pairing and Gateway

- M-031: Implement React Native desktop discovery interface. Acceptance: iOS Bonjour/local network and Android mDNS/DNS-SD/manual discovery are exposed through one TypeScript API.
- M-032: Implement React Native discovery UI. Acceptance: discovered and manual desktop gateway endpoints appear in one pairing screen.
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
- M-098: Add React Native iOS build pipeline. Acceptance: TestFlight build can be produced with correct signing.
- M-099: Add React Native Android build pipeline. Acceptance: debug/release APK or AAB can be produced with correct signing.
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
- For shared protocol work, update the TypeScript contract first and native module interfaces only when platform capability code requires them.
- Every shipped ticket should include the smallest useful verification: unit test, build check, simulator/device smoke, or documented manual QA.

## React Native Notes

- Use React Native with TypeScript as the only mobile product surface.
- Use native modules only for OS capabilities React Native cannot safely provide directly.
- Store tokens through one TypeScript secure-storage API backed by Keychain on iOS and Keystore/encrypted storage on Android.
- Treat iOS background voice/screen behavior carefully because platform restrictions are strict.
- Use local network/Bonjour on iOS and mDNS/DNS-SD/manual entry on Android behind one gateway discovery interface.
- Foreground service is required on Android for voice wake, screen capture, and persistent node behavior.

## Success Metrics

- User can install mobile app, sign in, and send first chat in under 2 minutes.
- User can pair desktop from QR/manual flow in under 1 minute.
- Approval notification to decision round trip is under 10 seconds.
- Mobile can reliably resume sessions started on CLI, desktop, or web.
- Mobile capture creates useful context without surprising privacy behavior.
- Desktop remote control feels secure enough for real local coding tasks.
