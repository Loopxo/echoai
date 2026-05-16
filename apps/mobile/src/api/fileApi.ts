import {
  type MobileEntityId,
  type MobileFileSummary,
  MobileProtocolMethods,
} from "../protocol";

import type { EchoAIMobileClient } from "./mobileClient";

export interface EchoAIFileListOptions {
  workspaceId: MobileEntityId;
  projectId?: MobileEntityId;
}

export interface EchoAIFileUploadCreateOptions extends EchoAIFileListOptions {
  file: MobileFileSummary;
}

export class EchoAIFileApi {
  constructor(private readonly client: EchoAIMobileClient) {}

  list(options: EchoAIFileListOptions): Promise<{ files: MobileFileSummary[] }> {
    return this.client.request(MobileProtocolMethods.FILE_LIST, options);
  }

  createUpload(options: EchoAIFileUploadCreateOptions): Promise<{ file: MobileFileSummary; uploadUrl?: string }> {
    return this.client.request(MobileProtocolMethods.FILE_UPLOAD_CREATE, options);
  }

  delete(workspaceId: MobileEntityId, fileId: MobileEntityId): Promise<{ fileId: MobileEntityId; deleted: true }> {
    return this.client.request(MobileProtocolMethods.FILE_DELETE, { workspaceId, fileId });
  }
}

export function createEchoAIFileApi(client: EchoAIMobileClient): EchoAIFileApi {
  return new EchoAIFileApi(client);
}
