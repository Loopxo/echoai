import type { MobileApprovalRequest } from "../protocol";

const riskRank: Record<MobileApprovalRequest["risk"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function getPendingApprovals(approvals: MobileApprovalRequest[]): MobileApprovalRequest[] {
  return approvals
    .filter((approval) => approval.status === "pending")
    .sort((left, right) => riskRank[right.risk] - riskRank[left.risk] || left.requestedAt.localeCompare(right.requestedAt));
}
