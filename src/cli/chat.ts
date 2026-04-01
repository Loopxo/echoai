import { Command } from 'commander';
import { runInteractiveChatSession } from '../runtime/chat-loop.js';

export const chatCommand = new Command('chat')
  .description('Start interactive chat session')
  .option('-p, --provider <provider>', 'AI provider to use')
  .option('-m, --model <model>', 'Model to use')
  .option('-t, --temperature <number>', 'Temperature (0-1)', parseFloat)
  .option('--max-tokens <number>', 'Max tokens', parseInt)
  .option('-s, --session <session-id>', 'Resume an existing session')
  .action(async (options) => {
    try {
      await runInteractiveChatSession({
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        sessionId: options.session,
      });
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
