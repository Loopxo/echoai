import type { EchoAIChatSession, EchoAIWorkspaceState } from "@echoai/contracts";
import { estimateModelCost, resolveFallbackChain } from "@/lib/models";
import { requireAdapter } from "./adapters";
import { recordUsage } from "./operations-service";

export function completeWithGateway(
  state: EchoAIWorkspaceState,
  input: { session: EchoAIChatSession; prompt: string; runId?: string },
) {
  const model = state.models.find((candidate) => candidate.id === input.session.modelId) ?? state.models[0];
  const gateway = model?.lane === "local" ? requireAdapter("adapter_local_model_gateway") : requireAdapter("adapter_ai_gateway");
  const promptTokens = Math.max(1, Math.ceil(input.prompt.length / 4));
  const outputTokens = 80;
  const cost = estimateModelCost(model?.id ?? "model_echoai_code", promptTokens, outputTokens);
  recordUsage(state, {
    source: "model",
    label: model?.label ?? "EchoAI model",
    units: promptTokens + outputTokens,
    costUsd: cost.estimatedUsd,
    runId: input.runId,
  });

  if (!gateway.ok) {
    const fallback = resolveFallbackChain(model?.id ?? "model_echoai_code").find((candidate) => candidate.lane === "local");
    return {
      provider: "local-fallback",
      model: fallback?.label ?? "Local deterministic fallback",
      text: "EchoAI local model gateway fallback completed the request. Configure ECHOAI_WEB_AI_GATEWAY_KEY to route hosted/free/BYOK models in production.",
      cost,
      gateway,
    };
  }

  if (gateway.adapter.id === "adapter_local_model_gateway") {
    return {
      provider: gateway.adapter.name,
      model: model?.label ?? "EchoAI model",
      text: "EchoAI local model gateway fallback completed the request. Configure ECHOAI_WEB_AI_GATEWAY_KEY to route hosted/free/BYOK models in production.",
      cost,
      gateway,
    };
  }

  return {
    provider: gateway.adapter.name,
    model: model?.label ?? "EchoAI model",
    text: "EchoAI model gateway accepted the request through a configured production adapter.",
    cost,
    gateway,
  };
}
