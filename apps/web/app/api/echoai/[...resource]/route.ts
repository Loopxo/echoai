import { NextResponse } from "next/server";
import { getWebEnv } from "@/lib/env";
import { createDefaultWorkspace, getMockSession, refreshSession } from "@/lib/auth";
import { globalSearch } from "@/lib/search";
import { workspaceState } from "@/lib/data";
import { getRuntimeEventStream } from "@/lib/runtime";
import { estimateModelCost, filterModels, providerHealthChecks, resolveFallbackChain } from "@/lib/models";
import { deletionPlan, lexicalSearch, semanticSearch } from "@/lib/knowledge";
import { exportNote, proposeMemory, retrieveMemories } from "@/lib/notes-memory";
import { browserAutomationTool, codeSandboxTool, exposedIntegrationTools, mcpToolBrowser, skillLibrary, toolPolicyMatrix } from "@/lib/tools";
import { handoffToDevice, pairDevice, runAutomation } from "@/lib/operations";
import { ticketCoverage, ticketSummary } from "@/lib/tickets";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function streamRuntime() {
  const encoder = new TextEncoder();
  const events = getRuntimeEventStream("run_stream");
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

export async function GET(request: Request, { params }: { params: Promise<{ resource: string[] }> }) {
  const { resource } = await params;
  const path = resource.join("/");
  const url = new URL(request.url);

  if (path === "env") return json({ ok: true, appUrl: getWebEnv().ECHOAI_WEB_APP_URL });
  if (path === "auth/session") return json(getMockSession());
  if (path === "auth/refresh") return json(refreshSession(getMockSession()));
  if (path === "auth/audit") return json(workspaceState.auditEvents);
  if (path === "workspace") return json(workspaceState);
  if (path === "flags") return json(workspaceState.flags);
  if (path === "search") return json(globalSearch(url.searchParams.get("q") ?? ""));
  if (path === "notifications") return json(["task-complete", "automation-failed", "device-pair-request", "billing-alert"]);
  if (path === "chat/sessions") return json(workspaceState.chats);
  if (path.startsWith("chat/export")) return json({ formats: ["markdown", "json", "pdf", "docx"], redaction: ["private", "public"] });
  if (path === "chat/stream") return streamRuntime();
  if (path === "runtime/events") return json(getRuntimeEventStream(url.searchParams.get("runId") ?? undefined));
  if (path === "runtime/tasks") return json(workspaceState.backgroundRuns);
  if (path === "models") return json(workspaceState.models);
  if (path === "models/health") return json(providerHealthChecks());
  if (path === "models/filter") return json(filterModels({ tools: true, reasoning: true }));
  if (path === "models/estimate") return json(estimateModelCost(url.searchParams.get("modelId") ?? "model_echoai_code", 12000, 2400));
  if (path === "models/fallback") return json(resolveFallbackChain(url.searchParams.get("modelId") ?? "model_free_router"));
  if (path === "projects") return json(workspaceState.projects);
  if (path === "files") return json(workspaceState.files);
  if (path === "files/delete-plan") return json(deletionPlan(url.searchParams.get("fileId") ?? "file_plan"));
  if (path === "knowledge/lexical") return json(lexicalSearch(url.searchParams.get("q") ?? "runtime"));
  if (path === "knowledge/semantic") return json(semanticSearch(url.searchParams.get("q") ?? "AgentKernel"));
  if (path === "notes") return json(workspaceState.notes);
  if (path === "notes/export") return json(exportNote(workspaceState.notes[0], "markdown"));
  if (path === "memories") return json(workspaceState.memories);
  if (path === "memories/propose") return json(proposeMemory(url.searchParams.get("sessionId") ?? "chat_launch"));
  if (path === "memories/retrieve") return json(retrieveMemories(url.searchParams.get("projectId") ?? "project_web", url.searchParams.get("q") ?? "web"));
  if (path === "tools") return json(workspaceState.toolPolicies);
  if (path === "tools/policies") return json(toolPolicyMatrix());
  if (path === "mcp/tools") return json(mcpToolBrowser());
  if (path === "skills") return json(skillLibrary());
  if (path === "integrations") return json(workspaceState.integrations);
  if (path === "integrations/exposed-tools") return json(exposedIntegrationTools(url.searchParams.get("integrationId") ?? "integration_github"));
  if (path === "browser/session") return json(browserAutomationTool);
  if (path === "code/sandbox") return json(codeSandboxTool);
  if (path === "automations") return json(workspaceState.automations);
  if (path === "automations/run") return json(runAutomation(url.searchParams.get("automationId") ?? "automation_digest"));
  if (path === "outputs") return json(workspaceState.outputs);
  if (path === "billing") return json(workspaceState.billing);
  if (path === "devices") return json(workspaceState.devices);
  if (path === "devices/pair") return json(pairDevice(url.searchParams.get("deviceId") ?? "device_android"));
  if (path === "devices/handoff") return json(handoffToDevice(url.searchParams.get("deviceId") ?? "device_mac", "Run workspace action"));
  if (path === "tickets") return json({ summary: ticketSummary, tickets: ticketCoverage });

  return json({ error: "Unknown EchoAI web API resource", path }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string[] }> }) {
  const { resource } = await params;
  const path = resource.join("/");
  const form = request.headers.get("content-type")?.includes("form")
    ? Object.fromEntries((await request.formData()).entries())
    : await request.json().catch(() => ({}));

  if (path === "auth/sign-in") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (path === "auth/sign-up") {
    return json(createDefaultWorkspace(String(form.email ?? "new@echoai.local")));
  }

  if (path === "integrations/oauth") {
    return json({ status: "connected", provider: form.provider ?? "github", disconnected: false });
  }

  if (path === "files/upload") {
    return json({ status: "queued", fileType: "auto-detected", recovery: "retry-token-issued" });
  }

  if (path === "devices/handoff") {
    return json(handoffToDevice(String(form.deviceId ?? "device_mac"), String(form.payload ?? "Run workspace action")));
  }

  return json({ accepted: true, path, form });
}
