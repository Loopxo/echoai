import { NextResponse } from "next/server";
import type { EchoAIRuntimeEvent, EchoAIWorkspaceState } from "@echoai/contracts";
import { getWebEnv } from "@/lib/env";
import { estimateModelCost, filterModels, providerHealthChecks, resolveFallbackChain } from "@/lib/models";
import { exportNote, proposeMemory, retrieveMemories } from "@/lib/notes-memory";
import { browserAutomationTool, codeSandboxTool, exposedIntegrationTools, mcpToolBrowser, skillLibrary, toolPolicyMatrix } from "@/lib/tools";
import { ticketCoverage, ticketSummary } from "@/lib/tickets";
import { clearSessionCookie, createNativeBearerToken, createSignedSession, makeSessionCookie, readBearerSession, readSessionFromRequest } from "@/lib/server/auth-service";
import { requireAdapter, resolveExternalAdapters } from "@/lib/server/adapters";
import { addIndexedFile, hardDeleteFile, searchWorkspaceKnowledge } from "@/lib/server/knowledge-service";
import { abortRun, appendUserMessage, createChatSession, forkChat, runAssistantTurn } from "@/lib/server/runtime-service";
import { handoffToDeviceById, pairDeviceById, queueAutomation, recordUsage, updateToolPolicy } from "@/lib/server/operations-service";
import { createAuditEvent, getWorkspaceStore } from "@/lib/server/store";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function stateWithAdapters(state: EchoAIWorkspaceState): EchoAIWorkspaceState {
  const configured = resolveExternalAdapters();
  const existing = state.externalAdapters.filter((adapter) => !configured.some((candidate) => candidate.id === adapter.id));
  return {
    ...state,
    externalAdapters: [...existing, ...configured],
  };
}

function searchState(state: EchoAIWorkspaceState, query: string) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];
  return [
    ...state.chats.map((item) => ({ type: "chat", id: item.id, title: item.title, href: `/app/chat/${item.id}` })),
    ...state.projects.map((item) => ({ type: "project", id: item.id, title: item.name, href: `/app/projects/${item.id}` })),
    ...state.notes.map((item) => ({ type: "note", id: item.id, title: item.title, href: "/app/notes" })),
    ...state.files.map((item) => ({ type: "file", id: item.id, title: item.name, href: "/app/files" })),
    ...state.memories.map((item) => ({ type: "memory", id: item.id, title: item.text, href: "/app/memories" })),
  ].filter((item) => item.title.toLowerCase().includes(normalized));
}

async function runtimeStream(sessionId: string | null) {
  let events: EchoAIRuntimeEvent[] = [];
  await getWorkspaceStore().mutate((state) => {
    const targetSessionId = sessionId ?? state.chats[0]?.id;
    if (!targetSessionId) {
      const chat = createChatSession(state, { title: "Runtime stream" });
      events = runAssistantTurn(state, chat.id);
      return;
    }
    events = runAssistantTurn(state, targetSessionId);
  });

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      },
    },
  );
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.includes("form")) {
    return Object.fromEntries((await request.formData()).entries());
  }
  return request.json().catch(() => ({}));
}

export async function GET(request: Request, { params }: { params: Promise<{ resource: string[] }> }) {
  const { resource } = await params;
  const path = resource.join("/");
  const url = new URL(request.url);
  const state = stateWithAdapters(await getWorkspaceStore().read());

  if (path === "env") return json({ ok: true, appUrl: getWebEnv().ECHOAI_WEB_APP_URL, adapters: state.externalAdapters });
  if (path === "auth/session") return json(readBearerSession(request) ?? readSessionFromRequest(request) ?? state.session);
  if (path === "auth/refresh") {
    const session = createSignedSession(state);
    return json(session, { headers: { "set-cookie": makeSessionCookie(session) } });
  }
  if (path === "auth/native-token") return json({ token: createNativeBearerToken(state.session), expiresInSeconds: 900 });
  if (path === "auth/audit") return json(state.auditEvents);
  if (path === "workspace") return json(state);
  if (path === "flags") return json(state.flags);
  if (path === "search") return json(searchState(state, url.searchParams.get("q") ?? ""));
  if (path === "notifications") return json(["task-complete", "automation-failed", "device-pair-request", "billing-alert"]);
  if (path === "chat/sessions") return json(state.chats);
  if (path.startsWith("chat/export")) return json({ formats: ["markdown", "json", "pdf", "docx"], redaction: ["private", "public"] });
  if (path === "chat/stream") return runtimeStream(url.searchParams.get("sessionId"));
  if (path === "runtime/events") return json(state.backgroundRuns);
  if (path === "runtime/tasks") return json(state.backgroundRuns);
  if (path === "models") return json(state.models);
  if (path === "models/health") return json(providerHealthChecks());
  if (path === "models/filter") return json(filterModels({ tools: true, reasoning: true }));
  if (path === "models/estimate") return json(estimateModelCost(url.searchParams.get("modelId") ?? "model_echoai_code", 12000, 2400));
  if (path === "models/fallback") return json(resolveFallbackChain(url.searchParams.get("modelId") ?? "model_free_router"));
  if (path === "provider-keys") return json(state.providerKeys.map((key) => ({ ...key, encryptedRef: "redacted" })));
  if (path === "projects") return json(state.projects);
  if (path === "files") return json(state.files);
  if (path === "files/delete-plan") return json({ fileId: url.searchParams.get("fileId") ?? "file_plan", steps: ["database record", "storage object", "chunks", "embeddings", "audit"] });
  if (path === "knowledge/lexical" || path === "knowledge/semantic") return json(searchWorkspaceKnowledge(state, url.searchParams.get("q") ?? "runtime"));
  if (path === "notes") return json(state.notes);
  if (path === "notes/export") return json(exportNote(state.notes[0], "markdown"));
  if (path === "memories") return json(state.memories);
  if (path === "memories/propose") return json(proposeMemory(url.searchParams.get("sessionId") ?? "chat_launch"));
  if (path === "memories/retrieve") return json(retrieveMemories(url.searchParams.get("projectId") ?? "project_web", url.searchParams.get("q") ?? "web"));
  if (path === "tools") return json(state.toolPolicies);
  if (path === "tools/policies") return json(toolPolicyMatrix());
  if (path === "mcp/tools") return json(mcpToolBrowser());
  if (path === "skills") return json(skillLibrary());
  if (path === "integrations") return json(state.integrations);
  if (path === "integrations/exposed-tools") return json(exposedIntegrationTools(url.searchParams.get("integrationId") ?? "integration_github"));
  if (path === "browser/session") return json({ ...browserAutomationTool, adapter: requireAdapter("adapter_ai_gateway") });
  if (path === "code/sandbox") return json({ ...codeSandboxTool, adapter: requireAdapter("adapter_daytona") });
  if (path === "automations") return json(state.automations);
  if (path === "outputs") return json(state.outputs);
  if (path === "billing") return json(state.billing);
  if (path === "billing/usage") return json(state.usageEvents);
  if (path === "adapters") return json(state.externalAdapters);
  if (path === "devices") return json(state.devices);
  if (path === "tickets") return json({ summary: ticketSummary, tickets: ticketCoverage });

  return json({ error: "Unknown EchoAI web API resource", path }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string[] }> }) {
  const { resource } = await params;
  const path = resource.join("/");
  const body = await readBody(request);

  if (path === "auth/sign-in") {
    let session = null;
    await getWorkspaceStore().mutate((state) => {
      session = createSignedSession(state, String(body.email ?? state.session.email));
      state.session = session;
      state.auditEvents.push(createAuditEvent("auth.sign_in", `Signed in ${session.email}`, state));
    });
    return NextResponse.redirect(new URL("/app", request.url), {
      headers: { "set-cookie": makeSessionCookie(session!) },
    });
  }

  if (path === "auth/sign-up") {
    const state = await getWorkspaceStore().mutate((draft) => {
      draft.session = createSignedSession(draft, String(body.email ?? "new@echoai.local"));
      draft.members.push({
        id: `user_${draft.members.length + 1}`,
        name: String(body.workspace ?? "New workspace owner"),
        email: draft.session.email,
        role: "owner",
        status: "active",
      });
      draft.auditEvents.push(createAuditEvent("auth.sign_in", `Created workspace for ${draft.session.email}`, draft));
    });
    return json(state.session, { headers: { "set-cookie": makeSessionCookie(state.session) } });
  }

  if (path === "auth/logout") {
    await getWorkspaceStore().mutate((state) => {
      state.auditEvents.push(createAuditEvent("auth.sign_out", `Signed out ${state.session.email}`, state));
    });
    return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
  }

  if (path === "workspace/reset") return json(await getWorkspaceStore().reset());

  const state = await getWorkspaceStore().mutate((draft) => {
    if (path === "chat/create") return createChatSession(draft, {
      title: String(body.title ?? "New EchoAI run"),
      projectId: String(body.projectId ?? draft.projects[0]?.id ?? "project_web"),
      mode: body.mode === "act" || body.mode === "code" || body.mode === "research" || body.mode === "media" || body.mode === "automation" ? body.mode : "ask",
      modelId: String(body.modelId ?? draft.models[0]?.id ?? "model_echoai_code"),
    }) && draft;
    if (path === "chat/message") return appendUserMessage(draft, {
      sessionId: String(body.sessionId ?? draft.chats[0]?.id),
      content: String(body.content ?? ""),
      attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds.map(String) : undefined,
    }) && draft;
    if (path === "chat/run") return runAssistantTurn(draft, String(body.sessionId ?? draft.chats[0]?.id)) && draft;
    if (path === "chat/fork") return forkChat(draft, String(body.sessionId), String(body.messageId)) && draft;
    if (path === "runtime/abort") return abortRun(draft, String(body.runId)) && draft;
    if (path === "files/upload") return addIndexedFile(draft, {
      projectId: String(body.projectId ?? "project_web"),
      name: String(body.name ?? "upload.txt"),
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : undefined,
      text: typeof body.text === "string" ? body.text : undefined,
    }) && draft;
    if (path === "files/delete") return hardDeleteFile(draft, String(body.fileId)) && draft;
    if (path === "tools/policies") return updateToolPolicy(draft, String(body.category), body.policy === "allow" || body.policy === "deny" ? body.policy : "ask") && draft;
    if (path === "automations/run") return queueAutomation(draft, String(body.automationId ?? "automation_digest")) && draft;
    if (path === "usage/record") return recordUsage(draft, {
      source: body.source === "browser" || body.source === "sandbox" || body.source === "media" || body.source === "automation" || body.source === "storage" ? body.source : "model",
      label: String(body.label ?? "manual"),
      units: Number(body.units ?? 1),
      costUsd: Number(body.costUsd ?? 0),
      runId: typeof body.runId === "string" ? body.runId : undefined,
    }) && draft;
    if (path === "devices/pair") return pairDeviceById(draft, String(body.deviceId ?? "device_android")) && draft;
    if (path === "devices/handoff") return handoffToDeviceById(draft, String(body.deviceId ?? "device_mac"), String(body.payload ?? "Run workspace action")) && draft;
    if (path === "integrations/oauth") {
      const integration = draft.integrations.find((candidate) => candidate.id === String(body.integrationId ?? "integration_github"));
      if (integration) integration.status = "connected";
      return draft;
    }
    return draft;
  });

  return json(stateWithAdapters(state));
}
