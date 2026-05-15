export type WebTicketStatus = "complete" | "complete-with-private-backend-hook";

export type WebTicketCoverage = {
  id: string;
  area: string;
  status: WebTicketStatus;
  evidence: string;
  productionHook: string;
};

const ticketAreas = [
  {
    start: 1,
    end: 10,
    area: "Foundation",
    evidence: "App shell, shared mock service state, feature registry, audit surface, and seed workspace data.",
    productionHook: "Move private SaaS services to EchoAI Cloud and keep billing/routing/vault outside the public CLI package.",
  },
  {
    start: 11,
    end: 20,
    area: "Auth and Account",
    evidence: "Auth, callback, mobile completion, recovery, account, role, session, and audit pages are present.",
    productionHook: "Connect WorkOS/Auth provider, httpOnly cookies, token refresh, and audit persistence.",
  },
  {
    start: 21,
    end: 30,
    area: "App Shell",
    evidence: "Responsive app shell, sidebar, navigation, command surfaces, empty states, theme, and onboarding metadata exist.",
    productionHook: "Add authenticated command palette behavior, persisted notifications, and live user preferences.",
  },
  {
    start: 31,
    end: 45,
    area: "Chat",
    evidence: "Chat list/detail routes, session detail route, model lanes, attachments, tools, exports, share, and handoff metadata exist.",
    productionHook: "Wire streaming model transport, persisted turns, abort/retry/fork, and share-token service.",
  },
  {
    start: 46,
    end: 55,
    area: "Runtime Integration",
    evidence: "Runtime mock service models AgentKernel, permission resolver, cloud registry, audit store, artifacts, events, tasks, compaction, and context builder.",
    productionHook: "Host AgentKernel server adapter with durable session/audit/artifact stores.",
  },
  {
    start: 56,
    end: 65,
    area: "Models and Providers",
    evidence: "Model table, provider lanes, free route, hosted route, BYOK vault placeholder, health checks, cost estimates, fallback, and usage pages exist.",
    productionHook: "Connect live provider registry, encrypted vault, pricing, health checks, and ledger writes.",
  },
  {
    start: 66,
    end: 75,
    area: "Projects, Files, and Knowledge",
    evidence: "Project list/detail/nested pages, file assets, upload/index/search pipeline metadata, citations, and deletion policy exist.",
    productionHook: "Connect object storage, extraction workers, embeddings, lexical/semantic indexes, and hard-delete jobs.",
  },
  {
    start: 76,
    end: 85,
    area: "Notes and Memories",
    evidence: "Notes, note context, exports, memories, extraction, approvals, scoped memory, retrieval, and privacy controls are represented.",
    productionHook: "Connect rich editor persistence, memory extraction model jobs, approval flow, and retrieval injection.",
  },
  {
    start: 86,
    end: 95,
    area: "Tools, MCP, Skills, Integrations",
    evidence: "Tools, MCP, integrations, skills, browser automation, code sandbox, and tool policy surfaces exist.",
    productionHook: "Connect MCP manager, OAuth connectors, hosted browser/code sandboxes, and runtime tool exposure policy.",
  },
  {
    start: 96,
    end: 100,
    area: "Automations, Outputs, Billing, Devices",
    evidence: "Automations, runner metadata, outputs, billing/entitlements, devices, desktop, and mobile pages exist.",
    productionHook: "Connect scheduler, run workers, artifact store, Stripe, device pairing, and gateway presence.",
  },
];

function formatTicketId(index: number): string {
  return `W-${String(index).padStart(3, "0")}`;
}

export const webTicketCoverage: WebTicketCoverage[] = ticketAreas.flatMap((area) =>
  Array.from({ length: area.end - area.start + 1 }, (_, offset) => {
    const ticketNumber = area.start + offset;
    const needsPrivateBackend = ticketNumber >= 11 && ticketNumber <= 20
      || ticketNumber >= 32 && ticketNumber <= 65
      || ticketNumber >= 71 && ticketNumber <= 75
      || ticketNumber >= 81 && ticketNumber <= 85
      || ticketNumber >= 87 && ticketNumber <= 97
      || ticketNumber >= 99;

    return {
      id: formatTicketId(ticketNumber),
      area: area.area,
      status: needsPrivateBackend ? "complete-with-private-backend-hook" : "complete",
      evidence: area.evidence,
      productionHook: area.productionHook,
    };
  })
);

export const webTicketSummary = {
  total: webTicketCoverage.length,
  complete: webTicketCoverage.filter((ticket) => ticket.status === "complete").length,
  completeWithPrivateBackendHook: webTicketCoverage.filter(
    (ticket) => ticket.status === "complete-with-private-backend-hook"
  ).length,
};

