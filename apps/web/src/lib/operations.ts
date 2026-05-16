import { automations, billing, devices, outputs } from "./data";
import { createRunId } from "./observability";

export function runAutomation(automationId: string) {
  const automation = automations.find((candidate) => candidate.id === automationId);
  return {
    runId: createRunId("automation"),
    automationId,
    status: automation?.status === "active" ? "queued" : "needs-activation",
    retryPolicy: automation?.retryPolicy ?? "manual",
    auditTrail: [...(automation?.auditTrail ?? []), "run-requested"],
  };
}

export function outputGallery() {
  return outputs;
}

export function billingEntitlements() {
  return billing;
}

export function pairDevice(deviceId: string) {
  return {
    deviceId,
    status: devices.find((device) => device.id === deviceId)?.status ?? "pairing",
    pairCode: "ECHO-2026",
  };
}

export function handoffToDevice(deviceId: string, payload: string) {
  const device = devices.find((candidate) => candidate.id === deviceId);
  return {
    deviceId,
    accepted: device?.status === "online" || device?.status === "pairing",
    target: device?.name ?? "Unknown device",
    payload,
  };
}
