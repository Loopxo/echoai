import type { EchoAIProductionReadinessItem } from "@echoai/contracts";
import { resolveExternalAdapters } from "./adapters";

const fallbackLabels: Record<string, string> = {
  adapter_workos: "Signed local sessions and native bearer tokens are available for development.",
  adapter_stripe: "Local usage ledger and billing state are available; Stripe checkout/webhooks need credentials.",
  adapter_r2: "Local object storage is available; R2 needs bucket and access keys.",
  adapter_ai_gateway: "Local deterministic gateway fallback is available; hosted/free/BYOK routing needs gateway key.",
  adapter_composio: "Local integration registry is available; OAuth connector execution needs Composio key.",
  adapter_daytona: "Local sandbox contract is available; hosted sandbox execution needs Daytona key.",
};

function areaFor(category: string): EchoAIProductionReadinessItem["area"] {
  if (category === "auth") return "auth";
  if (category === "billing") return "billing";
  if (category === "storage") return "storage";
  if (category === "model") return "model";
  if (category === "oauth") return "oauth";
  if (category === "sandbox") return "sandbox";
  return "runtime";
}

export function productionReadiness(): EchoAIProductionReadinessItem[] {
  return resolveExternalAdapters().map((adapter) => {
    const missingEnv = adapter.requiredEnv.filter((key) => {
      const value = process.env[key];
      return !value || value.includes("replace") || value.includes("mock");
    });
    return {
      id: adapter.id,
      area: areaFor(adapter.category),
      status: adapter.status,
      summary: adapter.capability,
      missingEnv,
      localFallback: fallbackLabels[adapter.id] ?? "Implemented locally.",
    };
  });
}
