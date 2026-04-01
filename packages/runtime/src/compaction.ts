import { randomUUID } from "node:crypto";
import type {
  KernelCompactionReport,
  KernelMessage,
  KernelSession,
} from "./types.js";

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
): KernelCompactionReport {
  const maxMessages = options.maxMessages ?? 40;
  const preserveHead = options.preserveHead ?? 4;
  const preserveTail = options.preserveTail ?? 20;
  const beforeCount = session.messages.length;
  const report: KernelCompactionReport = {
    beforeCount,
    afterCount: beforeCount,
    removedMessages: 0,
    summarizedMessages: 0,
    appliedStrategies: [],
  };

  if (beforeCount <= maxMessages) {
    return report;
  }

  const head = session.messages.slice(0, preserveHead);
  const tailStart = Math.max(preserveHead, session.messages.length - preserveTail);
  const tail = session.messages.slice(tailStart);
  let middle = session.messages.slice(preserveHead, tailStart);

  middle = removeOldToolMessages(head, middle, tail, maxMessages, report);

  if (head.length + middle.length + tail.length > maxMessages && middle.length > 0) {
    const keepMiddleCount = Math.max(0, maxMessages - head.length - tail.length - 1);
    const toSummarize = middle.slice(0, Math.max(0, middle.length - keepMiddleCount));
    const retained = keepMiddleCount > 0 ? middle.slice(-keepMiddleCount) : [];

    if (toSummarize.length > 0) {
      report.appliedStrategies.push("summary");
      report.summarizedMessages += toSummarize.length;
      middle = [buildSummaryMessage(toSummarize), ...retained];
    }
  }

  if (head.length + middle.length + tail.length > maxMessages) {
    const overflow = head.length + middle.length + tail.length - maxMessages;
    if (overflow > 0) {
      report.appliedStrategies.push("truncate");
      report.removedMessages += overflow;
      middle = middle.slice(overflow);
    }
  }

  session.messages = [...head, ...middle, ...tail];
  session.compactedAt = Date.now();
  session.updatedAt = Date.now();
  report.afterCount = session.messages.length;
  return report;
}

function removeOldToolMessages(
  head: KernelMessage[],
  middle: KernelMessage[],
  tail: KernelMessage[],
  maxMessages: number,
  report: KernelCompactionReport
): KernelMessage[] {
  const overflow = head.length + middle.length + tail.length - maxMessages;
  if (overflow <= 0) {
    return middle;
  }

  const removableIndexes = middle
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === "tool")
    .map(({ index }) => index);

  if (removableIndexes.length === 0) {
    return middle;
  }

  report.appliedStrategies.push("microcompact");
  const removableSet = new Set(removableIndexes.slice(0, overflow));
  report.removedMessages += removableSet.size;
  return middle.filter((_, index) => !removableSet.has(index));
}
