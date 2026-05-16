# EchoAI React Native Android Build Pipeline

Ticket: M-099

## Preconditions

- Android native project generated for the React Native app.
- Release keystore available through CI secrets.
- `key.properties` or Gradle signing config injected outside source control.
- Google Play upload key configured for AAB release.

## Pipeline

1. Install workspace dependencies with `pnpm install`.
2. Run `pnpm exec tsc -p apps/mobile/tsconfig.json`.
3. Run Android lint and unit checks from the native Android project.
4. Build debug APK for smoke validation.
5. Build release AAB with signing config.
6. Upload the signed AAB to the configured Play track.

## Local Smoke

Run `pnpm --filter @echoai/mobile android:release` after Android native project generation and release signing are configured.
