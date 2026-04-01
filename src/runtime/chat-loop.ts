import { RuntimeEventRenderer } from '@echoai/tui';
import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { createCliKernel } from './cli-kernel.js';
import { getCliSessionRegistry } from './session-bridge.js';

const promptWithInquirer = async (questions: any[]) => (await import('inquirer')).default.prompt(questions);

export interface InteractiveChatOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  title?: string;
}

export async function runInteractiveChatSession(options: InteractiveChatOptions): Promise<void> {
  const configManager = new ConfigManager();
  const providerManager = new ProviderManager(configManager);
  const config = await configManager.getConfig();
  const sessionRegistry = getCliSessionRegistry();
  const existingSession = options.sessionId
    ? await sessionRegistry.load(options.sessionId)
    : null;

  if (options.sessionId && !existingSession) {
    throw new Error(`Session ${options.sessionId} not found.`);
  }

  const providerName = options.provider || existingSession?.provider || config.defaults.provider;
  const modelName = options.model || existingSession?.model || config.defaults.model;
  const temperature = options.temperature ?? config.defaults.temperature;
  const maxTokens = options.maxTokens ?? config.defaults.maxTokens;
  const sessionTitle = existingSession?.title || options.title || 'Interactive Chat Session';

  const provider = await providerManager.getProvider(providerName);
  const kernel = createCliKernel({
    provider,
    model: modelName,
    temperature,
    maxTokens,
    stream: true,
    stateNamespace: 'cli',
  });

  let currentSessionId = existingSession?.id;

  console.log(`🤖 AI Chat Session - Provider: ${providerName}, Model: ${modelName}`);
  if (currentSessionId) {
    console.log(`Resuming session ${currentSessionId}`);
  }
  console.log('Type "exit" to quit, "clear" to start a new session\n');

  while (true) {
    const { input } = await promptWithInquirer([
      {
        type: 'input',
        name: 'input',
        message: 'You:',
      },
    ]);

    const normalizedInput = input.trim().toLowerCase();
    if (normalizedInput === 'exit') {
      console.log('Goodbye! 👋');
      break;
    }

    if (normalizedInput === 'clear') {
      currentSessionId = undefined;
      console.log('Started a new session.\n');
      continue;
    }

    try {
      const renderer = new RuntimeEventRenderer();
      let resultSessionId = currentSessionId;
      for await (const event of kernel.runEvents({
        sessionId: currentSessionId,
        title: sessionTitle,
        input,
        provider: providerName,
        model: modelName,
        workspaceRoot: process.cwd(),
        stream: true,
      })) {
        renderer.consume(event);
        if (event.type === 'run.completed') {
          resultSessionId = event.result.session.id;
        }
      }
      renderer.finish();
      currentSessionId = resultSessionId;
      process.stdout.write('\n');
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
