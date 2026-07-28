import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Provider } from '@echoai/providers';
import type { KernelCompletionRequest, KernelSession } from '@echoai/runtime';
import { DesktopProviderCatalog } from './desktop-completion-provider';

function createSession(provider: string, model: string): KernelSession {
  return {
    id: 'session-1',
    title: 'Desktop test',
    mode: 'default',
    provider,
    model,
    messages: [],
    approvals: [],
    tasks: [],
    artifacts: [],
    background: { status: 'idle' },
    worktree: { enabled: false },
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

function createRequest(provider: string, model: string): KernelCompletionRequest {
  return {
    session: createSession(provider, model),
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'Inspect this workspace',
        createdAt: 1,
      },
    ],
    tools: [
      {
        name: 'read_file',
        description: 'Read a workspace file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        async execute() {
          return { success: true };
        },
      },
    ],
  };
}

describe('DesktopProviderCatalog', () => {
  it('discovers configured providers without exposing their API keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echoai-desktop-provider-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      providers: {
        deepseek: {
          apiKey: 'secret-key',
          model: 'deepseek-reasoner',
        },
      },
      defaults: {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
      },
    }));

    const catalog = new DesktopProviderCatalog({
      configPath,
      env: {},
      providerFactory: vi.fn(),
    });

    expect(catalog.getDefault()).toEqual({
      provider: 'deepseek',
      model: 'deepseek-reasoner',
    });
    expect(catalog.list()).toEqual([
      {
        id: 'deepseek',
        label: 'DeepSeek',
        defaultModel: 'deepseek-reasoner',
        source: 'configured',
      },
      {
        id: 'ollama',
        label: 'Ollama (local)',
        defaultModel: 'llama3.2',
        source: 'local',
      },
    ]);
    expect(JSON.stringify(catalog.list())).not.toContain('secret-key');
  });

  it('routes kernel completions and tool schemas through the selected provider', async () => {
    const complete = vi.fn(async () => ({
      id: 'provider-message-1',
      content: 'I inspected it.',
      model: 'deepseek-chat',
      toolCalls: [
        {
          id: 'tool-1',
          type: 'function' as const,
          function: { name: 'read_file', arguments: '{"path":"README.md"}' },
        },
      ],
    }));
    const provider: Provider = {
      type: 'deepseek',
      complete,
      async stream() {
        throw new Error('not used');
      },
      async listModels() {
        return [];
      },
    };
    const catalog = new DesktopProviderCatalog({
      configPath: join(tmpdir(), 'does-not-exist.json'),
      env: { DEEPSEEK_API_KEY: 'env-secret' },
      providerFactory: () => provider,
    });

    const result = await catalog.completionProvider.complete(
      createRequest('deepseek', 'deepseek-chat')
    );

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek-chat',
      messages: [expect.objectContaining({ content: 'Inspect this workspace' })],
      tools: [expect.objectContaining({ name: 'read_file' })],
    }));
    expect(result).toMatchObject({
      content: 'I inspected it.',
      toolCalls: [
        {
          id: 'tool-1',
          name: 'read_file',
          input: { path: 'README.md' },
        },
      ],
    });
  });
});
