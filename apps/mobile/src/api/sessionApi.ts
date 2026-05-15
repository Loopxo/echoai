import {
  type MobileChatSendRequest,
  type MobileChatSendResponse,
  type MobileEntityId,
  type MobileRunStatus,
  type MobileSessionDetail,
  type MobileSessionSource,
  type MobileSessionSummary,
  MobileProtocolMethods,
} from "../protocol";

import type { EchoAIMobileClient } from "./mobileClient";

export interface EchoAISessionListOptions {
  workspaceId: MobileEntityId;
  source?: MobileSessionSource;
  projectId?: MobileEntityId;
}

export interface EchoAISessionRef {
  sessionId: MobileEntityId;
  source: MobileSessionSource;
}

export interface EchoAISessionResumeResult {
  session: MobileSessionDetail;
  runId?: MobileEntityId;
  status: MobileRunStatus;
}

export class EchoAISessionApi {
  constructor(private readonly client: EchoAIMobileClient) {}

  list(options: EchoAISessionListOptions): Promise<{ sessions: MobileSessionSummary[] }> {
    return this.client.request(MobileProtocolMethods.SESSION_LIST, options);
  }

  get(ref: EchoAISessionRef): Promise<MobileSessionDetail> {
    return this.client.request(MobileProtocolMethods.SESSION_GET, ref);
  }

  resume(ref: EchoAISessionRef): Promise<EchoAISessionResumeResult> {
    return this.client.request(MobileProtocolMethods.SESSION_RESUME, ref);
  }

  send(request: MobileChatSendRequest): Promise<MobileChatSendResponse> {
    return this.client.request(MobileProtocolMethods.CHAT_SEND, request);
  }

  abort(sessionId: MobileEntityId, runId: MobileEntityId, source: MobileSessionSource): Promise<{ runId: MobileEntityId; status: "cancelled" }> {
    return this.client.request(MobileProtocolMethods.CHAT_ABORT, { sessionId, runId, source });
  }
}

export function createEchoAISessionApi(client: EchoAIMobileClient): EchoAISessionApi {
  return new EchoAISessionApi(client);
}
