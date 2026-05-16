export interface SmsCapabilityDecision {
  decision: "removed" | "product-approved";
  reason: string;
  strictPermissionRequired: boolean;
}

export const smsCapabilityDecision: SmsCapabilityDecision = {
  decision: "removed",
  reason: "SMS access is excluded until product, privacy, and store review approve a narrow use case.",
  strictPermissionRequired: true,
};
