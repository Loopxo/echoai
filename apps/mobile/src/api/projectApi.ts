import {
  type MobileEntityId,
  type MobileProjectContext,
  type MobileProjectSummary,
  MobileProtocolMethods,
} from "../protocol";

import type { EchoAIMobileClient } from "./mobileClient";

export class EchoAIProjectApi {
  constructor(private readonly client: EchoAIMobileClient) {}

  list(workspaceId: MobileEntityId): Promise<{ projects: MobileProjectSummary[] }> {
    return this.client.request(MobileProtocolMethods.PROJECT_LIST, { workspaceId });
  }

  get(workspaceId: MobileEntityId, projectId: MobileEntityId): Promise<MobileProjectContext> {
    return this.client.request(MobileProtocolMethods.PROJECT_GET, { workspaceId, projectId });
  }
}

export function createEchoAIProjectApi(client: EchoAIMobileClient): EchoAIProjectApi {
  return new EchoAIProjectApi(client);
}
