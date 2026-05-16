import type { MobileChatEvent, MobileEntityId, MobileRunStatus } from "../protocol";

export interface ChatStreamingState {
  completedMessageId?: MobileEntityId;
  runId?: MobileEntityId;
  sessionId?: MobileEntityId;
  status: MobileRunStatus | "idle";
  text: string;
  toolCallId?: MobileEntityId;
}

export const initialChatStreamingState: ChatStreamingState = {
  status: "idle",
  text: "",
};

export function reduceChatStreamEvent(state: ChatStreamingState, event: MobileChatEvent): ChatStreamingState {
  if (event.type === "message.delta") {
    return {
      ...state,
      runId: event.runId,
      sessionId: event.sessionId,
      status: "running",
      text: `${state.text}${event.text}`,
    };
  }

  if (event.type === "message.completed") {
    return {
      ...state,
      completedMessageId: event.message.id,
      runId: event.runId,
      sessionId: event.sessionId,
      status: "completed",
    };
  }

  if (event.type === "tool.started" || event.type === "tool.completed") {
    return {
      ...state,
      runId: event.runId,
      sessionId: event.sessionId,
      status: "running",
      toolCallId: event.toolCallId,
    };
  }

  if (event.type === "approval.requested") {
    return {
      ...state,
      runId: event.runId,
      sessionId: event.sessionId,
      status: "waiting-for-approval",
    };
  }

  return {
    ...state,
    runId: event.runId,
    sessionId: event.sessionId,
    status: event.status,
  };
}
