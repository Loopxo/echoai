import { ChatPanel } from "@/components/chat-panel";
import { DataTable, FeaturePage, PageHeader, StatGrid } from "@/components/feature-page";
import type { EchoAIWorkspaceState } from "@echoai/contracts";
import { importedProviderDefinitions, providerHealthChecks } from "@/lib/models";
import { browserAutomationTool, codeSandboxTool, mcpToolBrowser, skillLibrary, toolPolicyMatrix } from "@/lib/tools";
import { buildWorkspaceContext, compactSession, getArtifactStore, getBackgroundTasks, getCloudAuditStore, getRuntimeEventStream } from "@/lib/runtime";
import { billingEntitlements, outputGallery, runAutomation } from "@/lib/operations";
import { deletionPlan, lexicalSearch, semanticSearch } from "@/lib/knowledge";
import { noteContext, proposeMemory, retrieveMemories } from "@/lib/notes-memory";
import { ticketCoverage, ticketSummary } from "@/lib/tickets";
import { workspaceState as seedWorkspaceState } from "./data";

let workspaceState = seedWorkspaceState;

function dashboard() {
  return (
    <>
      <PageHeader title="Command Center" eyebrow="EchoAI private web app">
        <a className="primary-action" href="/app/chat">Open chat</a>
      </PageHeader>
      <StatGrid
        stats={[
          { label: "Tickets", value: ticketSummary.total, detail: "W-001..W-100 implemented as React app surfaces." },
          { label: "Active runs", value: workspaceState.backgroundRuns.length, detail: "Durable jobs survive refresh." },
          { label: "Model lanes", value: workspaceState.models.length, detail: "Hosted, free, BYOK, and local desktop." },
          { label: "Devices", value: workspaceState.devices.length, detail: "Desktop, mobile, CLI, and gateway endpoints." },
        ]}
      />
      <section className="onboarding">
        {["Models", "Desktop", "Mobile", "First chat"].map((step, index) => (
          <article key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
            <p>{index === 0 ? "Confirm provider lanes and vault policy." : index === 1 ? "Pair local gateway for workspace actions." : index === 2 ? "Enable approvals and mobile handoff." : "Start a runtime-backed session."}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function accountPage() {
  return (
    <FeaturePage
      title="Account"
      eyebrow="Identity, organization, roles, and devices"
      stats={[
        { label: "Signed in", value: workspaceState.session.email, detail: "Mock session refresh is available through API." },
        { label: "Roles", value: workspaceState.session.roles.join(", "), detail: "Admin gates protect billing, provider keys, and admin pages." },
        { label: "Members", value: workspaceState.members.length, detail: "Owner, admin, and member roles are represented." },
      ]}
      rows={workspaceState.members.map((member) => ({ name: member.name, email: member.email, role: member.role, status: member.status }))}
    />
  );
}

function chatPage(sessionId?: string) {
  const session = workspaceState.chats.find((chat) => chat.id === sessionId) ?? workspaceState.chats[0];
  return (
    <>
      <PageHeader title={sessionId ? session.title : "Chat"} eyebrow="Streaming transport, persistence, tools, reasoning policy, exports, sharing, and handoff" />
      <ChatPanel session={session} models={workspaceState.models} />
    </>
  );
}

function runtimePage() {
  return (
    <FeaturePage
      title="Runtime"
      eyebrow="AgentKernel server adapter, events, approvals, artifacts, tasks, compaction, and context"
      stats={[
        { label: "Events", value: getRuntimeEventStream("run_preview").length, detail: "Deltas, tools, approvals, artifacts, and status." },
        { label: "Tasks", value: getBackgroundTasks().length, detail: "Runs survive page refresh." },
        { label: "Artifacts", value: getArtifactStore().length, detail: "Generated outputs have stable URLs." },
      ]}
      rows={[
        { item: "Cloud sessions", value: workspaceState.chats.length, detail: "Persisted registry" },
        { item: "Audit store", value: getCloudAuditStore().length, detail: "Runtime and auth events" },
        { item: "Compaction", value: compactSession(workspaceState.chats[0]).memoryCandidate, detail: "Summary plus memory" },
        { item: "Context", value: buildWorkspaceContext("project_web").files.length, detail: "Files, notes, memories, tools, devices" },
      ]}
    />
  );
}

function modelsPage() {
  return (
    <FeaturePage
      title="Models"
      eyebrow="Hosted, free, BYOK, local, health, filters, cost, fallback, usage"
      stats={[
        { label: "Routes", value: workspaceState.models.length, detail: "Model registry table is available." },
        { label: "Provider mappings", value: importedProviderDefinitions.length, detail: "EchoAI provider definitions mapped to web settings." },
        { label: "Usage", value: `$${workspaceState.billing.monthlySpend}`, detail: "Daily and monthly model spend surface." },
      ]}
      rows={workspaceState.models.map((model) => ({
        label: model.label,
        provider: model.provider,
        lane: model.lane,
        status: model.status,
        capabilities: model.capabilities,
      }))}
    >
      <DataTable rows={providerHealthChecks().map((check) => ({ model: check.label, status: check.status }))} />
    </FeaturePage>
  );
}

function projectsPage(projectId?: string) {
  const project = workspaceState.projects.find((candidate) => candidate.id === projectId);
  if (project) {
    return (
      <FeaturePage
        title={project.name}
        eyebrow="Project detail"
        stats={[
          { label: "Chats", value: project.chatIds.length, detail: "Project-linked sessions." },
          { label: "Files", value: project.fileIds.length, detail: "Project-scoped knowledge." },
          { label: "Automations", value: project.automationIds.length, detail: "Recurring prompts and output targets." },
        ]}
        rows={[
          ...project.chatIds.map((id) => ({ type: "chat", id, route: `/app/chat/${id}` })),
          ...project.noteIds.map((id) => ({ type: "note", id, route: "/app/notes" })),
          ...project.fileIds.map((id) => ({ type: "file", id, route: "/app/files" })),
          ...project.memoryIds.map((id) => ({ type: "memory", id, route: "/app/memories" })),
          ...project.automationIds.map((id) => ({ type: "automation", id, route: "/app/automations" })),
          ...project.outputIds.map((id) => ({ type: "output", id, route: "/app/outputs" })),
        ]}
      />
    );
  }

  return (
    <FeaturePage
      title="Projects"
      eyebrow="Create, rename, archive, and search projects"
      stats={[
        { label: "Projects", value: workspaceState.projects.length, detail: "Active and archived workspace scopes." },
        { label: "Files", value: workspaceState.files.length, detail: "Linked knowledge assets." },
        { label: "Search", value: "Ready", detail: "Projects are included in global search." },
      ]}
      rows={workspaceState.projects.map((candidate) => ({
        name: candidate.name,
        status: candidate.status,
        chats: candidate.chatIds.length,
        files: candidate.fileIds.length,
        route: `/app/projects/${candidate.id}`,
      }))}
    />
  );
}

function filesPage() {
  return (
    <FeaturePage
      title="Files"
      eyebrow="Upload, tree, viewer, extraction, embeddings, lexical search, semantic search, deletion"
      stats={[
        { label: "Uploads", value: workspaceState.files.length, detail: "Progress, type detection, and failure recovery are modeled." },
        { label: "Lexical hits", value: lexicalSearch("runtime").length, detail: "Exact search over names and content." },
        { label: "Semantic hits", value: semanticSearch("AgentKernel").length, detail: "Retrieval returns cited chunks." },
      ]}
      rows={workspaceState.files.map((file) => ({
        name: file.name,
        type: file.kind,
        path: file.path,
        progress: `${file.uploadProgress}%`,
        index: file.extractionStatus,
        chunks: file.chunks.length,
      }))}
    >
      <DataTable rows={deletionPlan("file_customer_pdf").steps.map((step, index) => ({ order: index + 1, step }))} />
    </FeaturePage>
  );
}

function notesPage() {
  return (
    <FeaturePage
      title="Notes"
      eyebrow="Markdown, tables, code, tasks, links, images, slash commands, context, export"
      stats={[
        { label: "Notes", value: workspaceState.notes.length, detail: "Create, edit, pin, link, archive." },
        { label: "Context", value: noteContext("note_boundary") ? "Ready" : "Missing", detail: "Notes can be mentioned in chat." },
        { label: "Exports", value: "MD PDF DOCX", detail: "Export targets are modeled." },
      ]}
      rows={workspaceState.notes.map((note) => ({
        title: note.title,
        pinned: note.pinned,
        archived: note.archived,
        updated: note.updatedAt,
      }))}
    />
  );
}

function memoriesPage() {
  const proposal = proposeMemory("chat_launch");
  return (
    <FeaturePage
      title="Memories"
      eyebrow="Extraction, approval, project scope, retrieval, privacy"
      stats={[
        { label: "Memories", value: workspaceState.memories.length, detail: "View, add, edit, delete, tag." },
        { label: "Proposal", value: proposal.status, detail: "Assistant proposals require approval." },
        { label: "Retrieval", value: retrieveMemories("project_web", "web").length, detail: "Injected with traceable reason." },
      ]}
      rows={workspaceState.memories.map((memory) => ({
        text: memory.text,
        scope: memory.scope,
        status: memory.status,
        tags: memory.tags,
      }))}
    />
  );
}

function toolsPage(section = "tools") {
  const browser = browserAutomationTool;
  const sandbox = codeSandboxTool;
  const rows =
    section === "mcp"
      ? mcpToolBrowser().map((tool) => ({ server: tool.server, tool: tool.tool, status: tool.status, inspectable: tool.inspectable }))
      : section === "integrations"
        ? workspaceState.integrations.map((integration) => ({ name: integration.name, status: integration.status, tools: integration.exposedTools }))
        : section === "skills"
          ? skillLibrary().map((skill) => ({ name: skill.name, status: skill.status, capabilities: skill.capabilities }))
          : toolPolicyMatrix().map((policy) => ({ category: policy.category, policy: policy.policy, reason: policy.reason, editable: policy.editable }));

  return (
    <FeaturePage
      title={section === "mcp" ? "MCP" : section === "integrations" ? "Integrations" : section === "skills" ? "Skills" : "Tools"}
      eyebrow="Built-ins, MCP, skills, OAuth, browser automation, code sandbox, policy"
      stats={[
        { label: "Policies", value: workspaceState.toolPolicies.length, detail: "Allow, ask, deny by category." },
        { label: "Browser", value: browser.sandbox, detail: `${browser.quotas.minutes} minute quota.` },
        { label: "Sandbox", value: sandbox.sandbox, detail: `${sandbox.quotas.cpuSeconds} CPU second quota.` },
      ]}
      rows={rows}
    />
  );
}

function automationsPage() {
  return (
    <FeaturePage
      title="Automations"
      eyebrow="Recurring prompts, runner, audit trail, retries, output targets"
      stats={[
        { label: "Automations", value: workspaceState.automations.length, detail: "Schedule, context, and target are visible." },
        { label: "Runner", value: runAutomation("automation_digest").status, detail: "Scheduled jobs carry audit and retry policy." },
        { label: "Outputs", value: workspaceState.outputs.length, detail: "Run artifacts land in gallery." },
      ]}
      rows={workspaceState.automations.map((automation) => ({
        name: automation.name,
        schedule: automation.schedule,
        status: automation.status,
        output: automation.outputTarget,
      }))}
    />
  );
}

function outputsPage() {
  return (
    <FeaturePage
      title="Outputs"
      eyebrow="Generated media, documents, reports, code artifacts"
      stats={[
        { label: "Artifacts", value: outputGallery().length, detail: "Browsable gallery." },
        { label: "Store", value: getArtifactStore().length, detail: "Stable URL backing." },
        { label: "Kinds", value: "5", detail: "Document, report, code, media, log." },
      ]}
      rows={workspaceState.outputs.map((output) => ({
        title: output.title,
        kind: output.kind,
        url: output.url,
        created: output.createdAt,
      }))}
    />
  );
}

function billingPage() {
  const account = billingEntitlements();
  return (
    <FeaturePage
      title="Billing"
      eyebrow="Subscription, credits, invoices, entitlements, usage limits"
      stats={[
        { label: "Plan", value: account.plan, detail: "Team workspace entitlement set." },
        { label: "Credits", value: account.creditsRemaining, detail: "Visible model usage budget." },
        { label: "Spend", value: `$${account.monthlySpend}`, detail: "Monthly usage ledger surface." },
      ]}
      rows={[
        ...account.entitlements.map((entitlement) => ({ type: "entitlement", value: entitlement, status: "enabled" })),
        ...account.invoices.map((invoice) => ({ type: "invoice", value: invoice.id, status: invoice.status, amount: invoice.amount })),
      ]}
    />
  );
}

function devicesPage() {
  return (
    <FeaturePage
      title="Devices"
      eyebrow="Desktop and mobile pairing, online status, handoff"
      stats={[
        { label: "Devices", value: workspaceState.devices.length, detail: "Desktop, mobile, CLI, and gateway." },
        { label: "Online", value: workspaceState.devices.filter((device) => device.status === "online").length, detail: "Ready to receive handoff." },
        { label: "Pairing", value: workspaceState.devices.filter((device) => device.status === "pairing").length, detail: "Trust approval in progress." },
      ]}
      rows={workspaceState.devices.map((device) => ({
        name: device.name,
        type: device.type,
        status: device.status,
        capabilities: device.capabilities,
        lastSeen: device.lastSeenAt,
      }))}
    />
  );
}

function ticketsPage() {
  return (
    <FeaturePage
      title="Web Ticket Coverage"
      eyebrow="W-001 through W-100"
      stats={[
        { label: "Total", value: ticketSummary.total, detail: "All planned web tickets." },
        { label: "Complete", value: ticketSummary.complete, detail: "Complete in app code." },
        { label: "Private hooks", value: ticketSummary.completeWithPrivateHook, detail: "Require credentials or cloud services." },
      ]}
      rows={ticketCoverage.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        area: ticket.area,
        status: ticket.status,
      }))}
    />
  );
}

export function renderAppPage(segments: string[] = [], state: EchoAIWorkspaceState = seedWorkspaceState) {
  workspaceState = state;
  const [first, second, third] = segments;
  if (!first) return dashboard();
  if (first === "account") return accountPage();
  if (first === "chat") return chatPage(second);
  if (first === "sessions") return chatPage(second);
  if (first === "runtime") return runtimePage();
  if (first === "models" || first === "usage") return modelsPage();
  if (first === "projects") return third === "chat" ? chatPage() : projectsPage(second);
  if (first === "files" || first === "knowledge") return filesPage();
  if (first === "notes") return notesPage();
  if (first === "memories") return memoriesPage();
  if (first === "tools") return toolsPage("tools");
  if (first === "mcp") return toolsPage("mcp");
  if (first === "integrations") return toolsPage("integrations");
  if (first === "skills") return toolsPage("skills");
  if (first === "automations") return automationsPage();
  if (first === "outputs") return outputsPage();
  if (first === "billing") return billingPage();
  if (first === "devices" || first === "desktop" || first === "mobile") return devicesPage();
  if (first === "admin" && second === "tickets") return ticketsPage();
  if (first === "admin") return ticketsPage();
  if (first === "settings") return accountPage();
  return dashboard();
}
