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

function createStubProvider(): Provider {
  return {
    type: 'openai',
    async complete() {
      return { id: 'stub-1', content: 'ok' };
    },
    async stream() {
      return { id: 'stub-1', content: 'ok' };
    },
    async listModels() {
      return [];
    },
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
        models: ['deepseek-chat', 'deepseek-reasoner'],
        region: 'cn',
        family: 'DeepSeek',
      },
      {
        id: 'ollama',
        label: 'Ollama (local)',
        defaultModel: 'llama3.2',
        source: 'local',
        models: ['llama3.2', 'llama3.1', 'qwen2.5-coder', 'deepseek-r1', 'mistral', 'phi4'],
        region: 'local',
        family: 'Ollama',
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

  it.each([
    ['DASHSCOPE_API_KEY', 'qwen', 'qwen-plus', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
    ['QWEN_API_KEY', 'qwen', 'qwen-plus', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
    ['ZHIPU_API_KEY', 'glm', 'glm-4-plus', 'https://open.bigmodel.cn/api/paas/v4'],
    ['GLM_API_KEY', 'glm', 'glm-4-plus', 'https://open.bigmodel.cn/api/paas/v4'],
    ['MINIMAX_API_KEY', 'minimax', 'MiniMax-M2', 'https://api.minimax.io/v1'],
    ['MOONSHOT_API_KEY', 'kimi', 'moonshot-v1-32k', 'https://api.moonshot.cn/v1'],
  ])('exposes %s as the %s provider on its own endpoint', async (
    envKey,
    id,
    defaultModel,
    baseUrl
  ) => {
    const providerFactory = vi.fn(() => createStubProvider());
    const catalog = new DesktopProviderCatalog({
      configPath: join(tmpdir(), 'does-not-exist.json'),
      env: { [envKey]: 'env-secret' },
      providerFactory,
    });

    expect(catalog.list().map((descriptor) => descriptor.id)).toContain(id);
    expect(catalog.getDefault()).toEqual({ provider: id, model: defaultModel });

    // The OpenAI-compatible client in @echoai/providers defaults to api.openai.com,
    // so the vendor endpoint has to be handed to the factory explicitly.
    await catalog.completionProvider.complete(createRequest(id, defaultModel));
    expect(providerFactory).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'env-secret',
      baseUrl,
      model: defaultModel,
    }));
  });

  it('offers a non-empty model list plus region and family for every provider', () => {
    const catalog = new DesktopProviderCatalog({
      configPath: join(tmpdir(), 'does-not-exist.json'),
      env: {
        DEEPSEEK_API_KEY: 'k',
        KIMI_API_KEY: 'k',
        DASHSCOPE_API_KEY: 'k',
        ZHIPU_API_KEY: 'k',
        MINIMAX_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        ANTHROPIC_API_KEY: 'k',
        NVIDIA_API_KEY: 'k',
      },
      providerFactory: vi.fn(),
    });

    const descriptors = catalog.list();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
      'deepseek',
      'kimi',
      'qwen',
      'glm',
      'minimax',
      'openai',
      'claude',
      'nim',
      'ollama',
    ]);

    for (const descriptor of descriptors) {
      expect(descriptor.models.length).toBeGreaterThan(0);
      expect(descriptor.models).toContain(descriptor.defaultModel);
      expect(descriptor.family.length).toBeGreaterThan(0);
      expect(['us', 'cn', 'local']).toContain(descriptor.region);
    }

    expect(descriptors.filter((descriptor) => descriptor.region === 'cn').map((d) => d.id))
      .toEqual(['deepseek', 'kimi', 'qwen', 'glm', 'minimax']);
    expect(descriptors.find((descriptor) => descriptor.id === 'ollama')?.region).toBe('local');
  });

  it('keeps a configured model in the picker even when it is not a catalog id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echoai-desktop-provider-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      providers: { qwen: { apiKey: 'k', model: 'qwen-private-ft' } },
    }));

    const catalog = new DesktopProviderCatalog({
      configPath,
      env: {},
      providerFactory: vi.fn(),
    });

    const qwen = catalog.list().find((descriptor) => descriptor.id === 'qwen');
    expect(qwen?.defaultModel).toBe('qwen-private-ft');
    expect(qwen?.models[0]).toBe('qwen-private-ft');
    expect(qwen?.models).toContain('qwen-max');
  });

  it('falls back to the default provider and lets unlisted models through', () => {
    const catalog = new DesktopProviderCatalog({
      configPath: join(tmpdir(), 'does-not-exist.json'),
      env: { ZHIPU_API_KEY: 'k' },
      providerFactory: vi.fn(),
    });

    expect(catalog.resolve('does-not-exist')).toEqual({ provider: 'glm', model: 'glm-4-plus' });
    expect(catalog.resolve(undefined, 'glm-4.6')).toEqual({ provider: 'glm', model: 'glm-4.6' });
    expect(catalog.resolve('glm', 'glm-4-private-tenant')).toEqual({
      provider: 'glm',
      model: 'glm-4-private-tenant',
    });
    expect(catalog.resolve('openai', 'gpt-4o')).toEqual({ provider: 'glm', model: 'gpt-4o' });
  });
});
