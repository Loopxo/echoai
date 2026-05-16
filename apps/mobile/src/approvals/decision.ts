import type { MobileApprovalDecision, MobileApprovalRequest } from "../protocol";

export function createApprovalDecision(
  approval: MobileApprovalRequest,
  decision: MobileApprovalDecision["decision"],
  options: { reason?: string; rememberForSession?: boolean } = {},
): MobileApprovalDecision {
  return {
    approvalId: approval.id,
    decidedAt: new Date().toISOString(),
    decision,
    reason: options.reason,
    rememberForSession: options.rememberForSession,
  };
}
