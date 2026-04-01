import { SessionRegistry, type KernelMessage, type KernelSession } from '@echoai/runtime';
import type { Message } from '../types/index.js';
import type { SessionData, SessionMetadata } from '../types/session.js';

export const CLI_SESSION_NAMESPACE = 'cli';

const runtimeSessionRegistry = new SessionRegistry({ namespace: CLI_SESSION_NAMESPACE });

export function getCliSessionRegistry(): SessionRegistry {
  return runtimeSessionRegistry;
}

export function runtimeSessionToMetadata(session: KernelSession): SessionMetadata {
  const totalTokens = readNumericMetadata(session.metadata.totalTokens);
  const cost = readNumericMetadata(session.metadata.cost);

  return {
    id: session.id,
    title: session.title,
    provider: session.provider || 'unknown',
    model: session.model || 'unknown',
    messageCount: session.messages.length,
    totalTokens,
    cost: cost > 0 ? cost : undefined,
    tags: readTags(session.metadata.tags),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

export function runtimeSessionToSessionData(session: KernelSession): SessionData {
  const metadata = runtimeSessionToMetadata(session);
  const context = buildContext(session);

  return {
    metadata,
    messages: session.messages.map(toLegacyMessage),
    config: {
      provider: metadata.provider,
      model: metadata.model,
      temperature: readNumericMetadata(session.metadata.temperature),
      maxTokens: readNumericMetadata(session.metadata.maxTokens),
    },
    context,
  };
}

function toLegacyMessage(message: KernelMessage): Message {
  return {
    role: message.role === 'tool' ? 'assistant' : message.role,
    content: message.role === 'tool'
      ? formatToolMessage(message)
      : message.content,
    timestamp: new Date(message.createdAt),
  };
}

function formatToolMessage(message: KernelMessage): string {
  const toolName = message.name ? ` (${message.name})` : '';
  return `[tool${toolName}] ${message.content}`;
}

function buildContext(session: KernelSession): SessionData['context'] | undefined {
  const workingDirectory = readStringMetadata(session.metadata.workspaceRoot)
    ?? readStringMetadata(session.metadata.workingDirectory);
  const gitBranch = readStringMetadata(session.metadata.gitBranch);
  const gitCommit = readStringMetadata(session.metadata.gitCommit);
  const files = readStringArrayMetadata(session.metadata.files);

  if (!workingDirectory && !gitBranch && !gitCommit && !files) {
    return undefined;
  }

  return {
    workingDirectory,
    gitBranch,
    gitCommit,
    files,
  };
}

function readNumericMetadata(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readStringMetadata(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readStringArrayMetadata(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  return items.length > 0 ? items : undefined;
}

function readTags(value: unknown): string[] | undefined {
  return readStringArrayMetadata(value);
}
