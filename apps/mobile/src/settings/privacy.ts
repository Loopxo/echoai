export type PrivacyAction = "export-local-cache" | "delete-local-cache" | "request-account-export" | "request-account-delete";

export interface PrivacyRequest {
  action: PrivacyAction;
  requestedAt: string;
}

export function createPrivacyRequest(action: PrivacyAction): PrivacyRequest {
  return {
    action,
    requestedAt: new Date().toISOString(),
  };
}
