# Desktop Release Readiness

## Build Matrix

| Platform | Runner | Artifact |
|---|---|---|
| macOS arm64 | `macos-14` | DMG and ZIP |
| Windows x64 | `windows-2022` | NSIS installer |

## Required Secrets

| Secret | Purpose |
|---|---|
| `APPLE_ID` | Apple notarization login |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple notarization password |
| `APPLE_TEAM_ID` | Apple developer team |
| `CSC_LINK` | macOS signing certificate |
| `CSC_KEY_PASSWORD` | macOS signing certificate password |
| `WIN_CSC_LINK` | Windows code-signing certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows certificate password |
| `ECHOAI_UPDATE_FEED_URL` | Generic auto-update feed root |

## Smoke Checks

1. Run `pnpm --filter @echoai/desktop release:check`.
2. Build platform artifacts with `pnpm --filter @echoai/desktop package:mac` or `pnpm --filter @echoai/desktop package:win`.
3. Install the generated artifact on a clean macOS or Windows profile.
4. Launch EchoAI, open Settings, select a workspace, quit, and relaunch.
5. Confirm the workspace and window recovery state are restored.
6. Confirm `echoai://auth/callback?code=smoke` focuses the app and appears in activity state.
7. Run `pnpm --filter @echoai/desktop smoke:installer` to verify artifacts are present.
