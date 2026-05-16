import type {
  EchoAIBackgroundRun,
  EchoAIChatSession,
  EchoAIRuntimeEvent,
  EchoAIToolPolicy,
} from "@echoai/contracts";
import { backgroundRuns, chats, files, memories, notes, toolPolicies, workspaceState } from "./data";
import { createRunId } from "./observability";

export const agentKernelServerAdapter = {
  name: "AgentKernel web adapter",
  lifecycle: ["prepare-context", "route-model", "resolve-permissions", "stream-events", "persist-artifacts"],
  source: "packages/runtime AgentKernel-compatible contract",
};

export const serverCompletionProviderAdapter = {
  lanes: ["hosted", "free", "byok", "local"],
  streamProtocol: "EchoAIRuntimeEvent",
  usageLedger: "billing and model usage dashboard",
};

export function resolvePermission(category: EchoAIToolPolicy["category"]): EchoAIToolPolicy {
  return toolPolicies.find((policy) => policy.category === category) ?? toolPolicies[0];
}

export function getCloudSessionRegistry(): EchoAIChatSession[] {
  return chats;
}

export function getCloudAuditStore() {
  return workspaceState.auditEvents;
}

export function getArtifactStore() {
  return workspaceState.outputs.map((output) => ({
    ...output,
    stableUrl: output.url,
  }));
}

export function getRuntimeEventStream(runId = createRunId("run")): EchoAIRuntimeEvent[] {
  return [
    { id: createRunId("event"), type: "run.status", runId, payload: { status: "running" }, createdAt: new Date().toISOString() },
    { id: createRunId("event"), type: "assistant.delta", runId, payload: { text: "EchoAI Web runtime stream is connected." }, createdAt: new Date().toISOString() },
    { id: createRunId("event"), type: "tool.call", runId, payload: { tool: "workspace_context_builder" }, createdAt: new Date().toISOString() },
    { id: createRunId("event"), type: "artifact.created", runId, payload: { artifactId: "output_report" }, createdAt: new Date().toISOString() },
  ];
}

export function getBackgroundTasks(): EchoAIBackgroundRun[] {
  return backgroundRuns;
}

export function compactSession(session: EchoAIChatSession) {
  return {
    sessionId: session.id,
    summary: session.messages.map((message) => `${message.role}: ${message.content}`).join("\n").slice(0, 600),
    memoryCandidate: "Remember the user wants web, desktop, mobile, and CLI to converge around one runtime.",
  };
}

export function buildWorkspaceContext(projectId: string) {
  return {
    projectId,
    files: files.filter((file) => file.projectId === projectId),
    notes: notes.filter((note) => note.projectId === projectId),
    memories: memories.filter((memory) => memory.projectId === projectId || memory.scope !== "project"),
    tools: toolPolicies.filter((policy) => policy.policy !== "deny"),
    devices: workspaceState.devices.filter((device) => device.status !== "offline"),
  };
}
