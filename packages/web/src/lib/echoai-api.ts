import {
  automations,
  devices,
  milestones,
  modelRoutes,
  projects,
  statusMetrics,
  toolSurfaces,
} from "./echoai-app-data";

export const echoaiWebApiVersion = "2026-05-16.web-foundation";

export function createEchoAIAppState() {
  return {
    version: echoaiWebApiVersion,
    generatedAt: new Date(0).toISOString(),
    product: {
      name: "EchoAI Web",
      mode: "private-app-foundation",
      runtime: "packages/runtime AgentKernel",
      gateway: "packages/gateway JSON-RPC",
    },
    statusMetrics,
    modelRoutes,
    projects,
    toolSurfaces,
    automations,
    devices,
    milestones,
  };
}

export function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

