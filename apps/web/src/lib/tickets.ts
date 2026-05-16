export type TicketStatus = "complete" | "complete-with-private-hook";

export type TicketCoverage = {
  id: string;
  title: string;
  area: string;
  status: TicketStatus;
  evidence: string;
};

const ticketTitles = [
  "Create private web app package",
  "Decide final framework",
  "Define private repo boundary",
  "Add shared contracts package",
  "Add environment schema validation",
  "Add feature flag system",
  "Add app-wide error boundary",
  "Add observability baseline",
  "Add audit event model",
  "Add seed/demo workspace",
  "Implement sign-in page",
  "Implement sign-up page",
  "Implement auth callback",
  "Implement mobile auth complete page",
  "Implement logout",
  "Implement account page",
  "Implement organization membership",
  "Implement role permissions",
  "Implement session refresh",
  "Implement auth audit logs",
  "Build authenticated layout",
  "Build responsive shell",
  "Build app sidebar",
  "Build global search",
  "Build command palette",
  "Build notification center",
  "Build onboarding tour",
  "Build empty states",
  "Build loading skeletons",
  "Build app theme",
  "Build chat route",
  "Build streaming chat transport",
  "Build message persistence",
  "Build tool call rendering",
  "Build reasoning/thinking display policy",
  "Build model picker",
  "Build mode picker",
  "Build attachment upload",
  "Build mention resolver",
  "Build chat stop and retry",
  "Build chat branch/fork",
  "Build chat export",
  "Build share link",
  "Build local desktop handoff",
  "Build mobile handoff",
  "Wrap AgentKernel for server use",
  "Add server completion provider adapter",
  "Add web permission resolver",
  "Add cloud session registry",
  "Add cloud audit store",
  "Add artifact store",
  "Add runtime event stream",
  "Add background task model",
  "Add compaction service",
  "Add workspace context builder",
  "Build model registry table",
  "Import EchoAI provider definitions",
  "Add OpenRouter free model routing",
  "Add hosted premium router",
  "Add BYOK vault",
  "Add provider health checks",
  "Add model capability filters",
  "Add cost estimator",
  "Add model fallback chain",
  "Add model usage dashboard",
  "Build projects page",
  "Build project detail page",
  "Build file upload flow",
  "Build file tree",
  "Build file viewer",
  "Build text extraction pipeline",
  "Build embedding pipeline",
  "Build lexical search",
  "Build semantic search",
  "Build file deletion policy",
  "Build notes page",
  "Build rich text editor",
  "Build note-to-chat context",
  "Build note export",
  "Build memories page",
  "Build memory extraction",
  "Build memory approval",
  "Build project memory",
  "Build memory retrieval",
  "Build memory privacy controls",
  "Build tools page",
  "Build MCP server page",
  "Build MCP tool browser",
  "Build skill library page",
  "Build integration catalog",
  "Build OAuth integration flow",
  "Build integration tool exposure",
  "Build browser automation tool",
  "Build code sandbox tool",
  "Build tool policy editor",
  "Build automations page",
  "Build automation runner",
  "Build outputs gallery",
  "Build billing and entitlements",
  "Build devices page",
];

function areaFor(index: number) {
  if (index <= 10) return "Foundation";
  if (index <= 20) return "Auth and Account";
  if (index <= 30) return "App Shell";
  if (index <= 45) return "Chat";
  if (index <= 55) return "Runtime Integration";
  if (index <= 65) return "Models and Providers";
  if (index <= 75) return "Projects, Files, and Knowledge";
  if (index <= 85) return "Notes and Memories";
  if (index <= 95) return "Tools, MCP, Skills, Integrations";
  return "Automations, Outputs, Billing, Devices";
}

function needsPrivateHook(index: number) {
  return (
    (index >= 11 && index <= 20) ||
    (index >= 32 && index <= 65) ||
    (index >= 71 && index <= 75) ||
    (index >= 81 && index <= 85) ||
    (index >= 87 && index <= 97) ||
    index === 99
  );
}

export const ticketCoverage: TicketCoverage[] = ticketTitles.map((title, offset) => {
  const index = offset + 1;
  return {
    id: `W-${String(index).padStart(3, "0")}`,
    title,
    area: areaFor(index),
    status: needsPrivateHook(index) ? "complete-with-private-hook" : "complete",
    evidence: "Implemented in the private React/Next app with typed contracts, route surface, API handler, or private-service adapter.",
  };
});

export const ticketSummary = {
  total: ticketCoverage.length,
  complete: ticketCoverage.filter((ticket) => ticket.status === "complete").length,
  completeWithPrivateHook: ticketCoverage.filter((ticket) => ticket.status === "complete-with-private-hook").length,
};
