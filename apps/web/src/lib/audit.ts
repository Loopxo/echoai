import type { EchoAIAuditEvent, EchoAIId } from "@echoai/contracts";
import { createRunId } from "./observability";

export function auditEvent(
  type: EchoAIAuditEvent["type"],
  summary: string,
  actorId: EchoAIId,
  workspaceId: EchoAIId,
  runId?: EchoAIId,
): EchoAIAuditEvent {
  return {
    id: createRunId("audit"),
    type,
    actorId,
    workspaceId,
    runId,
    summary,
    createdAt: new Date().toISOString(),
  };
}

export const authAuditEvents: EchoAIAuditEvent[] = [
  auditEvent("auth.sign_in", "Owner signed in with email magic link.", "user_founder", "workspace_echoai"),
  auditEvent("auth.refresh", "Long-lived web session refreshed without interrupting active chat.", "user_founder", "workspace_echoai"),
  auditEvent("device.paired", "Mobile device pairing request approved.", "user_founder", "workspace_echoai"),
  auditEvent("provider_key.changed", "BYOK provider key rotated in the private vault.", "user_founder", "workspace_echoai"),
];
