import { describe, expect, it } from 'vitest';
import type { KernelSession } from '@echoai/runtime';
import { runtimeSessionToMetadata, runtimeSessionToSessionData } from '../../src/runtime/session-bridge.js';

describe('session bridge', () => {
  it('maps runtime sessions into CLI metadata', () => {
    const session = createSession({
      metadata: {
        totalTokens: 128,
        cost: 0.42,
        tags: ['alpha', 'kernel'],
      },
    });

    const metadata = runtimeSessionToMetadata(session);

    expect(metadata.id).toBe(session.id);
    expect(metadata.provider).toBe('openai');
    expect(metadata.model).toBe('gpt-test');
    expect(metadata.messageCount).toBe(2);
    expect(metadata.totalTokens).toBe(128);
    expect(metadata.cost).toBe(0.42);
    expect(metadata.tags).toEqual(['alpha', 'kernel']);
  });

  it('converts tool messages into assistant-compatible session history', () => {
    const session = createSession({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'Read the config',
          createdAt: 1,
        },
        {
          id: 'tool-1',
          role: 'tool',
          name: 'read_file',
          content: 'package.json contents',
          createdAt: 2,
        },
      ],
      metadata: {
        workspaceRoot: '/tmp/echoai',
        gitBranch: 'main',
        files: ['package.json'],
      },
    });

    const data = runtimeSessionToSessionData(session);

    expect(data.messages).toEqual([
      {
        role: 'user',
        content: 'Read the config',
        timestamp: new Date(1),
      },
      {
        role: 'assistant',
        content: '[tool (read_file)] package.json contents',
        timestamp: new Date(2),
      },
    ]);
    expect(data.context).toEqual({
      workingDirectory: '/tmp/echoai',
      gitBranch: 'main',
      gitCommit: undefined,
      files: ['package.json'],
    });
  });
});

function createSession(overrides: Partial<KernelSession> = {}): KernelSession {
  return {
    id: 'session-1',
    title: 'Kernel Session',
    provider: 'openai',
    model: 'gpt-test',
    mode: 'default',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'hello',
        createdAt: 1,
      },
      {
        id: 'message-2',
        role: 'assistant',
        content: 'world',
        createdAt: 2,
      },
    ],
    approvals: [],
    tasks: [],
    artifacts: [],
    background: { status: 'idle' },
    worktree: { enabled: false },
    metadata: {},
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}
