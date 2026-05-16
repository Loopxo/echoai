import type { EchoAIWorkspaceState } from "@echoai/contracts";
import { createAuditEvent, makeId } from "./store";
import { recordUsage } from "./operations-service";

function now() {
  return new Date().toISOString();
}

export function runSchedulerTick(state: EchoAIWorkspaceState) {
  const dueAutomations = state.automations.filter((automation) => automation.status === "active");
  const queuedRuns = dueAutomations.map((automation) => {
    const run = {
      id: makeId("automation_run"),
      sessionId: state.chats[0]?.id ?? "automation",
      status: "queued" as const,
      survivesRefresh: true,
      updatedAt: now(),
    };
    automation.auditTrail.push(`scheduler-tick:${run.id}`);
    state.backgroundRuns.unshift(run);
    state.auditEvents.push(createAuditEvent("automation.queued", `Scheduler queued ${automation.name}`, state, run.id));
    recordUsage(state, {
      source: "automation",
      label: automation.name,
      units: 1,
      costUsd: 0,
      runId: run.id,
    });
    return run;
  });

  return {
    tickedAt: now(),
    due: dueAutomations.length,
    queuedRuns,
  };
}
