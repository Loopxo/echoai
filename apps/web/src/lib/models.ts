import type { EchoAIModelRoute } from "@echoai/contracts";
import { modelRoutes } from "./data";

export type ModelCapabilityFilter = Partial<Record<"tools" | "vision" | "reasoning" | "audio" | "image", boolean>>;

export const importedProviderDefinitions = [
  { provider: "openai", source: "src/providers/openai.ts", webSetting: "BYOK or hosted premium" },
  { provider: "claude", source: "src/providers/claude.ts", webSetting: "BYOK or hosted premium" },
  { provider: "groq", source: "src/providers/groq.ts", webSetting: "Free or BYOK fallback" },
  { provider: "openrouter", source: "src/providers/openrouter.ts", webSetting: "Free model pool" },
];

export function filterModels(filters: ModelCapabilityFilter): EchoAIModelRoute[] {
  return modelRoutes.filter((route) =>
    Object.entries(filters).every(([capability, required]) =>
      required ? route.capabilities.includes(capability as EchoAIModelRoute["capabilities"][number]) : true,
    ),
  );
}

export function estimateModelCost(modelId: string, inputTokens: number, outputTokens: number) {
  const model = modelRoutes.find((route) => route.id === modelId) ?? modelRoutes[0];
  return {
    modelId: model.id,
    inputTokens,
    outputTokens,
    estimatedUsd:
      (inputTokens / 1_000_000) * model.inputPerMillion + (outputTokens / 1_000_000) * model.outputPerMillion,
  };
}

export function resolveFallbackChain(preferredModelId: string): EchoAIModelRoute[] {
  const preferred = modelRoutes.find((route) => route.id === preferredModelId);
  return [
    ...(preferred ? [preferred] : []),
    ...modelRoutes.filter((route) => route.id !== preferredModelId && route.status === "ready"),
    ...modelRoutes.filter((route) => route.id !== preferredModelId && route.status !== "ready"),
  ];
}

export function providerHealthChecks() {
  return modelRoutes.map((route) => ({
    id: route.id,
    label: route.label,
    status: route.status === "needs-key" ? "needs encrypted vault key" : route.status,
  }));
}
