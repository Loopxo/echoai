# EchoAI Mobile QA Checklist

Ticket: M-100

## Auth

- Sign up creates account and first workspace.
- Secure browser sign-in returns through `echoai://auth/mobile-complete`.
- Refresh token keeps the session alive.
- Logout clears local tokens and sensitive cache.

## Chat

- Cloud sessions list, open, stream, stop, retry, and send attachments.
- Desktop gateway sessions list, open, stream, stop, and reconnect after foreground/network changes.
- Share target intake creates chat drafts from text, URLs, and files.

## Pairing And Approvals

- Desktop discovery shows native and manual endpoints.
- QR and manual pairing require desktop approval.
- TLS mismatch warns before connection.
- Approval inbox, details, approve/deny, timeout, push deep link, and safety warning flows work.

## Projects And Capture

- Project list/detail, files, notes, memories, and memory suggestions sync.
- File upload, preview, camera, audio, location, Android screen capture, and iOS screen-scoped flows behave as documented.
- Offline capture queue syncs after connectivity returns.

## Release

- Permission dashboard reasons match OS prompts.
- Notification settings persist.
- Debug log export is redacted.
- iOS TestFlight archive and Android signed AAB use external signing credentials.
