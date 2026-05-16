import {
  type MobileApprovalDecision,
  type MobileApprovalRequest,
  type MobileApprovalStatus,
  type MobileEntityId,
  MobileProtocolMethods,
} from "../protocol";

import type { EchoAIMobileClient } from "./mobileClient";

export class EchoAIApprovalApi {
  constructor(private readonly client: EchoAIMobileClient) {}

  list(workspaceId: MobileEntityId, status?: MobileApprovalStatus): Promise<{ approvals: MobileApprovalRequest[] }> {
    return this.client.request(MobileProtocolMethods.APPROVAL_LIST, { workspaceId, status });
  }

  decide(decision: MobileApprovalDecision): Promise<{ approval: MobileApprovalRequest }> {
    return this.client.request(MobileProtocolMethods.APPROVAL_DECIDE, decision);
  }
}

export function createEchoAIApprovalApi(client: EchoAIMobileClient): EchoAIApprovalApi {
  return new EchoAIApprovalApi(client);
}
