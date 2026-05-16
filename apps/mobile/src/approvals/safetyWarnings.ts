import type { MobileApprovalRequest } from "../protocol";

export type ApprovalSafetyLevel = "normal" | "strong-confirmation";

const destructiveWords = ["delete", "remove", "rm", "reset", "wipe", "destroy", "revoke"];
const externalWords = ["curl", "wget", "deploy", "publish", "transfer", "payment"];

export function getApprovalSafetyLevel(approval: MobileApprovalRequest): ApprovalSafetyLevel {
  const haystack = `${approval.title} ${approval.reason ?? ""} ${approval.toolName} ${JSON.stringify(approval.details)}`.toLowerCase();
  if (approval.risk === "high") return "strong-confirmation";
  if (destructiveWords.some((word) => haystack.includes(word))) return "strong-confirmation";
  if (externalWords.some((word) => haystack.includes(word))) return "strong-confirmation";
  return "normal";
}
