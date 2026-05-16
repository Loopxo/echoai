import type { EchoAIPolicy, EchoAIWorkspaceState } from "@echoai/contracts";
import { createAuditEvent, makeId, touchDevice } from "./store";

function now() {
  return new Date().toISOString();
}

export function recordUsage(
  state: EchoAIWorkspaceState,
  input: { source: "model" | "browser" | "sandbox" | "media" | "automation" | "storage"; label: string; units: number; costUsd: number; runId?: string },
) {
  const event = {
    id: makeId("usage"),
    workspaceId: state.session.workspaceId,
    createdAt: now(),
    ...input,
  };
  state.usageEvents.push(event);
  state.billing.monthlySpend = Math.round((state.billing.monthlySpend + input.costUsd) * 10000) / 10000;
  state.billing.creditsRemaining = Math.max(0, Math.round((state.billing.creditsRemaining - input.costUsd) * 10000) / 10000);
  state.auditEvents.push(createAuditEvent("usage.recorded", `Recorded ${input.source} usage for ${input.label}`, state, input.runId));
  return event;
}

export function updateToolPolicy(state: EchoAIWorkspaceState, category: string, policy: EchoAIPolicy) {
  const row = state.toolPolicies.find((candidate) => candidate.category === category);
  if (!row) throw new Error(`Unknown tool category: ${category}`);
  row.policy = policy;
  state.auditEvents.push(createAuditEvent(policy === "deny" ? "tool.denied" : "tool.approved", `Set ${category} policy to ${policy}`, state));
  return row;
}

export function queueAutomation(state: EchoAIWorkspaceState, automationId: string) {
  const automation = state.automations.find((candidate) => candidate.id === automationId);
  if (!automation) throw new Error(`Unknown automation: ${automationId}`);
  const run = {
    id: makeId("automation_run"),
    sessionId: state.chats[0]?.id ?? "automation",
    status: "queued" as const,
    survivesRefresh: true,
    updatedAt: now(),
  };
  automation.auditTrail.push(`queued:${run.id}`);
  state.backgroundRuns.unshift(run);
  state.auditEvents.push(createAuditEvent("automation.queued", `Queued automation ${automation.name}`, state, run.id));
  return run;
}

export function pairDeviceById(state: EchoAIWorkspaceState, deviceId: string) {
  const device = state.devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);
  Object.assign(device, touchDevice({ ...device, status: "online" }));
  state.auditEvents.push(createAuditEvent("device.paired", `Paired ${device.name}`, state));
  return device;
}

export function handoffToDeviceById(state: EchoAIWorkspaceState, deviceId: string, payload: string) {
  const device = state.devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);
  const accepted = device.status === "online" || device.status === "pairing";
  state.auditEvents.push(createAuditEvent("device.handoff", `${accepted ? "Sent" : "Blocked"} handoff to ${device.name}: ${payload}`, state));
  return {
    deviceId,
    target: device.name,
    accepted,
    payload,
  };
}
