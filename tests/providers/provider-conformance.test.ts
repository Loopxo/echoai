import { describe, expect, it } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai.js';
import { KimiProvider } from '../../src/providers/kimi.js';
import { ProviderToolDefinition } from '../../src/types/index.js';

class MockOpenAIProvider extends OpenAIProvider {
  public payloads: unknown[] = [];

  constructor(private readonly response: unknown) {
    super({ apiKey: 'sk-test', model: 'test-model' });
    this.client = {
      chat: {
        completions: {
          create: async (payload: unknown) => {
            this.payloads.push(payload);
            return this.response;
          },
        },
      },
    } as never;
  }

  public parse(raw: string | undefined) {
    return this.parseToolInput(raw);
  }
}

class MockKimiProvider extends KimiProvider {
  constructor() {
    super({ apiKey: 'sk-test' });
  }

  public format(tools: ProviderToolDefinition[]) {
    return this.formatTools(tools);
  }
}

describe('provider tool-call conformance', () => {
  it('parses multiple completeWithTools calls and preserves reasoning metadata', async () => {
    const provider = new MockOpenAIProvider({
      choices: [{
        message: {
          content: '',
          reasoning_content: 'short chain summary',
          tool_calls: [
            { id: 'call_1', function: { name: 'read_file', arguments: '{"path":"src/index.ts"}' } },
            { id: 'call_2', function: { name: 'git_diff', arguments: '{"staged":false}' } },
          ],
        },
      }],
    });

    const result = await provider.completeWithTools([{ role: 'user', content: 'inspect' }], {
      tools: [],
    });

    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'read_file', input: { path: 'src/index.ts' } },
      { id: 'call_2', name: 'git_diff', input: { staged: false } },
    ]);
    expect(result.metadata?.reasoning_content).toBe('short chain summary');
  });

  it('recovers invalid provider JSON arguments instead of throwing', () => {
    const provider = new MockOpenAIProvider({});
    expect(provider.parse('{broken')).toEqual({
      _raw: '{broken',
      _parseError: 'Invalid JSON arguments from provider',
    });
  });

  it('assembles streamed multi-tool calls from provider chunks', async () => {
    const provider = new MockOpenAIProvider(streamFrom([
      { choices: [{ delta: { content: 'ok' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'read_', arguments: '{"path":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'file', arguments: '"README.md"}' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: 'call_b', function: { name: 'git_status', arguments: '{}' } }] } }] },
    ]));
    const chunks: unknown[] = [];

    const result = await provider.streamWithTools(
      [{ role: 'user', content: 'stream' }],
      { tools: [] },
      (chunk) => chunks.push(chunk)
    );

    expect(result.content).toBe('ok');
    expect(result.toolCalls).toEqual([
      { id: 'call_a', name: 'read_file', input: { path: 'README.md' } },
      { id: 'call_b', name: 'git_status', input: {} },
    ]);
    expect(chunks).toContainEqual({ type: 'text', text: 'ok' });
  });

  it('sanitizes Kimi schemas for stricter OpenAI-compatible tool support', () => {
    const provider = new MockKimiProvider();
    const formatted = provider.format([{
      name: 'search',
      description: 'Search files',
      inputSchema: {
        type: 'object',
        patternProperties: { '^x-': { type: 'string' } },
        unevaluatedProperties: false,
        properties: {
          mode: { oneOf: [{ type: 'string', enum: ['grep'] }, { type: 'number' }] },
          tuple: { type: 'array', items: [{ type: 'string' }, { type: 'number' }] },
        },
      },
    }]) as Array<{ function: { parameters: Record<string, unknown> } }>;

    const parameters = formatted[0]?.function.parameters as Record<string, unknown>;
    const properties = parameters.properties as Record<string, Record<string, unknown>>;

    expect(parameters.patternProperties).toBeUndefined();
    expect(parameters.unevaluatedProperties).toBeUndefined();
    expect(properties.mode.type).toBe('string');
    expect(properties.tuple.items).toEqual({ type: 'string' });
  });
});

async function* streamFrom(chunks: unknown[]) {
  for (const chunk of chunks) yield chunk;
}
