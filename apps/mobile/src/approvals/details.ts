import type { MobileApprovalRequest } from "../protocol";

export interface ApprovalDetailRows {
  command?: string;
  path?: string;
  reason?: string;
  risk: MobileApprovalRequest["risk"];
  toolName: string;
}

export function extractApprovalDetails(approval: MobileApprovalRequest): ApprovalDetailRows {
  return {
    command: readStringDetail(approval, "command"),
    path: readStringDetail(approval, "path"),
    reason: approval.reason,
    risk: approval.risk,
    toolName: approval.toolName,
  };
}

function readStringDetail(approval: MobileApprovalRequest, key: string): string | undefined {
  const value = approval.details[key];
  return typeof value === "string" ? value : undefined;
}
