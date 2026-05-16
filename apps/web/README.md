# EchoAI Web App

Private React product app for EchoAI Web and Overlay-style workspace workflows.

The public `packages/web` Astro package remains the docs and marketing surface. This app is intentionally private, uses the Next.js app router, and contains the authenticated product UI, API handlers, private-service boundaries, and shared contracts.

```bash
pnpm --filter @echoai/contracts build
pnpm --filter @echoai/web-app dev
pnpm --filter @echoai/web-app build
```

Production deployments must set the required `ECHOAI_WEB_*` variables and disable mock mode.
