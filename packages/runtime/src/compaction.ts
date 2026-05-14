import { randomUUID } from "node:crypto";
import type {
  KernelCompactionReport,
  KernelMessage,
  KernelSession,
  KernelCompletionProvider,
} from "./types.js";

export interface CompactionOptions {
  maxMessages?: number;
  preserveHead?: number;
  preserveTail?: number;
}

const TIME_BASED_MC_CLEARED_MESSAGE = '[Old tool result content cleared]';

async function buildSummaryMessage(messages: KernelMessage[], provider?: KernelCompletionProvider, model?: string): Promise<KernelMessage> {
  const sampled = messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(0, 15000); // Send more to the model

  let summaryContent = `Compacted session summary:\n${sampled.slice(0, 4000)}`;

  if (provider && model) {
    try {
      const response = await provider.complete({
        session: { id: "ephemeral", title: "summary", mode: "default", messages: [], approvals: [], tasks: [], artifacts: [], background: { status: "idle" }, worktree: { enabled: false }, metadata: {}, createdAt: Date.now(), updatedAt: Date.now() },
        messages: [
          {
            id: randomUUID(),
            role: 'system',
            content: 'You are an expert context compactor. Summarize the following conversation turn history strictly focusing on: current task, tool decisions made, user constraints discovered, and unresolved errors. Keep it extremely concise.',
            createdAt: Date.now(),
          },
          { 
            id: randomUUID(),
            role: 'user', 
            content: sampled,
            createdAt: Date.now(),
          }
        ],
        tools: [],
        systemPrompt: '',
      });
      if (response.content) {
        summaryContent = `[Context Compaction Summary]\n${response.content}`;
      }
    } catch (e) {
      console.error('Compaction summary generation failed, falling back to basic summary.', e);
    }
  }

  return {
    id: randomUUID(),
    role: "system",
    content: summaryContent,
    createdAt: Date.now(),
    metadata: {
      compacted: true,
      summarizedMessages: messages.length,
    },
  };
}

export async function compactSession(
  session: KernelSession,
  options: CompactionOptions = {},
  provider?: KernelCompletionProvider
): Promise<KernelCompactionReport> {
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
      const summaryMsg = await buildSummaryMessage(toSummarize, provider, session.model);
      middle = [summaryMsg, ...retained];
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
  let overflow = head.length + middle.length + tail.length - maxMessages;
  if (overflow <= 0) return middle;

  let didMicroCompact = false;
  middle = middle.map((msg) => {
    if (msg.role === 'tool' && msg.content.length > 2000) {
      didMicroCompact = true;
      return { ...msg, content: TIME_BASED_MC_CLEARED_MESSAGE };
    }
    return msg;
  });

  if (didMicroCompact) report.appliedStrategies.push("microcompact");

  overflow = head.length + middle.length + tail.length - maxMessages;
  if (overflow <= 0) return middle;

  const removableIndexes = middle
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === "tool")
    .sort((a, b) => {
      const aCleared = a.message.content === TIME_BASED_MC_CLEARED_MESSAGE ? 1 : 0;
      const bCleared = b.message.content === TIME_BASED_MC_CLEARED_MESSAGE ? 1 : 0;
      return bCleared - aCleared;
    })
    .map(({ index }) => index);

  if (removableIndexes.length === 0) return middle;

  if (!didMicroCompact) report.appliedStrategies.push("microcompact");
  
  const removableSet = new Set(removableIndexes.slice(0, overflow));
  report.removedMessages += removableSet.size;
  return middle.filter((_, index) => !removableSet.has(index));
}
