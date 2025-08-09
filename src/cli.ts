#!/usr/bin/env node

import { Command } from 'commander';
import { chatCommand } from './cli/chat.js';
import { configCommand } from './cli/config.js';
import { editCommand } from './cli/edit.js';
import { providerCommand } from './cli/provider.js';

const program = new Command();

program
  .name('ai')
  .description('AI Terminal CLI - Unified interface for multiple AI providers')
  .version('0.1.0');

program
  .argument('[prompt]', 'Direct prompt to send to AI')
  .option('-p, --provider <provider>', 'AI provider to use (claude, openai, gemini)')
  .option('-m, --model <model>', 'Specific model to use')
  .option('-t, --temperature <number>', 'Temperature for generation (0-1)', parseFloat)
  .option('--max-tokens <number>', 'Maximum tokens to generate', parseInt)
  .option('-f, --file <files...>', 'Files to include as context')
  .option('-s, --stream', 'Stream response in real-time')
  .action(async (prompt, options) => {
    if (!prompt) {
      program.help();
      return;
    }

    const { default: handleDirectPrompt } = await import('./cli/direct.js');
    await handleDirectPrompt(prompt, options);
  });

program.addCommand(chatCommand);
program.addCommand(configCommand);
program.addCommand(editCommand);
program.addCommand(providerCommand);

program.parse();