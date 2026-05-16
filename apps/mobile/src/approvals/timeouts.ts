import type { MobileApprovalRequest } from "../protocol";

export function isApprovalExpired(approval: MobileApprovalRequest, now: Date = new Date()): boolean {
  if (!approval.expiresAt) return false;
  const expiresAt = new Date(approval.expiresAt).getTime();
  return Number.isNaN(expiresAt) || expiresAt <= now.getTime();
}

export function getApprovalEffectiveStatus(approval: MobileApprovalRequest, now: Date = new Date()): MobileApprovalRequest["status"] {
  if (approval.status === "pending" && isApprovalExpired(approval, now)) {
    return "expired";
  }
  return approval.status;
}

export function canActOnApproval(approval: MobileApprovalRequest, now: Date = new Date()): boolean {
  return getApprovalEffectiveStatus(approval, now) === "pending";
}
