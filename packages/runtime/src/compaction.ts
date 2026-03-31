import { randomUUID } from "node:crypto";
import type { KernelMessage, KernelSession } from "./types.js";

export interface CompactionOptions {
  maxMessages?: number;
  preserveHead?: number;
  preserveTail?: number;
}

function buildSummaryMessage(messages: KernelMessage[]): KernelMessage {
  const sampled = messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(0, 4000);

  return {
    id: randomUUID(),
    role: "system",
    content: `Compacted session summary:\n${sampled}`,
    createdAt: Date.now(),
    metadata: {
      compacted: true,
      summarizedMessages: messages.length,
    },
  };
}

export function compactSession(
  session: KernelSession,
  options: CompactionOptions = {}
): KernelSession {
  const maxMessages = options.maxMessages ?? 40;
  const preserveHead = options.preserveHead ?? 4;
  const preserveTail = options.preserveTail ?? 20;

  if (session.messages.length <= maxMessages) {
    return session;
  }

  const head = session.messages.slice(0, preserveHead);
  const middle = session.messages.slice(preserveHead, session.messages.length - preserveTail);
  const tail = session.messages.slice(-preserveTail);

  session.messages = [...head, buildSummaryMessage(middle), ...tail];
  session.compactedAt = Date.now();
  session.updatedAt = Date.now();
  return session;
}
