import type { EchoAIExternalAdapter } from "@echoai/contracts";

type AdapterDefinition = Omit<EchoAIExternalAdapter, "status">;

const adapterDefinitions: AdapterDefinition[] = [
  {
    id: "adapter_workos",
    name: "WorkOS-compatible auth",
    category: "auth",
    requiredEnv: ["ECHOAI_WEB_WORKOS_CLIENT_ID", "ECHOAI_WEB_WORKOS_API_KEY"],
    capability: "Enterprise SSO, social sign-in, org sync, and native bearer token validation.",
  },
  {
    id: "adapter_stripe",
    name: "Stripe billing",
    category: "billing",
    requiredEnv: ["ECHOAI_WEB_STRIPE_SECRET"],
    capability: "Subscriptions, invoices, top-ups, checkout, customer portal, and webhook reconciliation.",
  },
  {
    id: "adapter_r2",
    name: "Cloudflare R2 object storage",
    category: "storage",
    requiredEnv: ["ECHOAI_WEB_R2_ACCOUNT_ID", "ECHOAI_WEB_R2_BUCKET", "ECHOAI_WEB_R2_ACCESS_KEY_ID", "ECHOAI_WEB_R2_SECRET_ACCESS_KEY"],
    capability: "Owner-scoped uploads, generated assets, short-lived file access, and hard deletes.",
  },
  {
    id: "adapter_ai_gateway",
    name: "EchoAI model gateway",
    category: "model",
    requiredEnv: ["ECHOAI_WEB_AI_GATEWAY_KEY"],
    capability: "Hosted premium routing, free model limits, BYOK routing, usage ledger, and fallback chains.",
  },
  {
    id: "adapter_composio",
    name: "OAuth connector bridge",
    category: "oauth",
    requiredEnv: ["ECHOAI_WEB_COMPOSIO_API_KEY"],
    capability: "Gmail, Calendar, Drive, Slack, GitHub, Notion, and other external tool connectors.",
  },
  {
    id: "adapter_daytona",
    name: "Hosted code sandbox",
    category: "sandbox",
    requiredEnv: ["ECHOAI_WEB_DAYTONA_API_KEY"],
    capability: "Quota-scoped hosted code execution, shell tasks, and sandbox lifecycle reconciliation.",
  },
];

function isConfigured(requiredEnv: string[]) {
  return requiredEnv.every((key) => {
    const value = process.env[key];
    return Boolean(value && !value.includes("replace") && !value.includes("mock"));
  });
}

export function resolveExternalAdapters(): EchoAIExternalAdapter[] {
  return adapterDefinitions.map((adapter) => ({
    ...adapter,
    status: isConfigured(adapter.requiredEnv) ? "ready" : "needs_configuration",
  }));
}

export function requireAdapter(adapterId: string) {
  const adapter = resolveExternalAdapters().find((candidate) => candidate.id === adapterId);
  if (!adapter) {
    throw new Error(`Unknown EchoAI adapter: ${adapterId}`);
  }

  if (adapter.status !== "ready") {
    return {
      ok: false as const,
      adapter,
      error: `${adapter.name} requires ${adapter.requiredEnv.join(", ")}`,
    };
  }

  return { ok: true as const, adapter };
}
