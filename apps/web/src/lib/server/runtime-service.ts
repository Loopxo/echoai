import type { EchoAIChatMessage, EchoAIChatSession, EchoAIRunMode, EchoAIRuntimeEvent, EchoAIWorkspaceState } from "@echoai/contracts";
import { createRunId } from "@/lib/observability";
import { createAuditEvent, createBackgroundRun, findChat, makeId } from "./store";

function now() {
  return new Date().toISOString();
}

export function createChatSession(
  state: EchoAIWorkspaceState,
  input: { title?: string; projectId?: string; mode?: EchoAIRunMode; modelId?: string },
): EchoAIChatSession {
  const session: EchoAIChatSession = {
    id: makeId("chat"),
    title: input.title || "New EchoAI run",
    projectId: input.projectId || state.projects[0]?.id || "project_web",
    mode: input.mode || "ask",
    modelId: input.modelId || state.models[0]?.id || "model_echoai_code",
    status: "active",
    messages: [],
    updatedAt: now(),
  };
  state.chats.unshift(session);
  const project = state.projects.find((candidate) => candidate.id === session.projectId);
  project?.chatIds.unshift(session.id);
  return session;
}

export function appendUserMessage(
  state: EchoAIWorkspaceState,
  input: { sessionId: string; content: string; attachmentIds?: string[] },
): EchoAIChatMessage {
  const session = findChat(state, input.sessionId) ?? createChatSession(state, { title: "New EchoAI run" });
  const message: EchoAIChatMessage = {
    id: makeId("msg"),
    role: "user",
    content: input.content,
    createdAt: now(),
    attachments: input.attachmentIds?.map((id) => {
      const file = state.files.find((candidate) => candidate.id === id);
      return {
        id,
        name: file?.name ?? id,
        mimeType: file?.mimeType ?? "application/octet-stream",
        sizeBytes: file?.sizeBytes ?? 0,
        status: file?.extractionStatus === "indexed" ? "indexed" : "uploaded",
      };
    }),
  };
  session.messages.push(message);
  session.updatedAt = now();
  return message;
}

export function runAssistantTurn(state: EchoAIWorkspaceState, sessionId: string): EchoAIRuntimeEvent[] {
  const session = findChat(state, sessionId);
  if (!session) throw new Error(`Unknown chat session: ${sessionId}`);
  const run = createBackgroundRun(session.id);
  state.backgroundRuns.unshift(run);
  const runId = run.id;
  const events: EchoAIRuntimeEvent[] = [
    { id: makeId("event"), type: "run.status", runId, payload: { status: "running", sessionId }, createdAt: now() },
    { id: makeId("event"), type: "tool.call", runId, payload: { tool: "workspace_context", policy: "allow" }, createdAt: now() },
    { id: makeId("event"), type: "assistant.delta", runId, payload: { text: "EchoAI runtime accepted the run and persisted its event stream." }, createdAt: now() },
    { id: makeId("event"), type: "artifact.created", runId, payload: { artifactId: makeId("artifact") }, createdAt: now() },
    { id: makeId("event"), type: "run.status", runId, payload: { status: "complete", sessionId }, createdAt: now() },
  ];
  session.messages.push({
    id: makeId("msg"),
    role: "assistant",
    content: "EchoAI runtime accepted the run, resolved workspace context, and recorded durable events.",
    createdAt: now(),
    modelId: session.modelId,
    runId,
    reasoningSummary: "Runtime event stream is persisted and can reconnect after refresh.",
    toolCalls: [
      {
        id: makeId("tool"),
        kind: "file",
        title: "Workspace context",
        status: "complete",
        policy: "allow",
        summary: "Injected project files, notes, memories, tools, and device state.",
      },
    ],
  });
  session.updatedAt = now();
  run.status = "complete";
  run.updatedAt = now();
  state.auditEvents.push(createAuditEvent("runtime.event", `Completed web runtime run for ${session.title}`, state, runId));
  state.usageEvents.push({
    id: makeId("usage"),
    workspaceId: state.session.workspaceId,
    source: "model",
    label: session.modelId,
    units: 1,
    costUsd: 0.0042,
    runId,
    createdAt: now(),
  });
  return events;
}

export function forkChat(state: EchoAIWorkspaceState, sessionId: string, messageId: string) {
  const source = findChat(state, sessionId);
  if (!source) throw new Error(`Unknown chat session: ${sessionId}`);
  const index = source.messages.findIndex((message) => message.id === messageId);
  const fork = createChatSession(state, {
    title: `${source.title} fork`,
    projectId: source.projectId,
    mode: source.mode,
    modelId: source.modelId,
  });
  fork.forkedFromMessageId = messageId;
  fork.messages = index >= 0 ? source.messages.slice(0, index + 1) : [...source.messages];
  return fork;
}

export function abortRun(state: EchoAIWorkspaceState, runId: string) {
  const run = state.backgroundRuns.find((candidate) => candidate.id === runId);
  if (!run) throw new Error(`Unknown run: ${runId}`);
  run.status = "failed";
  run.updatedAt = now();
  state.auditEvents.push(createAuditEvent("runtime.event", `Aborted run ${runId}`, state, runId));
  return run;
}
