# EchoAI React Native iOS Build Pipeline

Ticket: M-098

## Preconditions

- Apple Developer team configured in Xcode.
- Bundle identifier reserved for EchoAI mobile.
- Signing certificates and provisioning profiles installed in CI or local keychain.
- App Store Connect API key available to the release job.

## Pipeline

1. Install workspace dependencies with `pnpm install`.
2. Run `pnpm exec tsc -p apps/mobile/tsconfig.json`.
3. Install iOS pods from the generated React Native iOS project.
4. Archive the Release scheme in Xcode.
5. Export an App Store signed `.ipa`.
6. Upload to TestFlight with App Store Connect credentials.

## Local Smoke

Run `pnpm --filter @echoai/mobile ios:release` after native iOS project generation and signing are configured.
