#!/usr/bin/env node

import { Command } from 'commander';
import { chatCommand } from './cli/chat.js';
import { configCommand } from './cli/config.js';
import { editCommand } from './cli/edit.js';
import { providerCommand } from './cli/provider.js';
import { agentsCommand } from './cli/agents.js';
import { quickAnalyzeCommand } from './cli/quick-analyze.js';
import { docsCommand } from './cli/docs.js';
import { mcpCommand } from './cli/mcp.js';
import { sessionsCommand } from './cli/sessions.js';
import { securityCommand } from './cli/security.js';
import { analyticsCommand } from './cli/analytics.js';
import { exportImportCommand } from './cli/export-import.js';
import { modelsCommand } from './cli/models.js';
import { gatewayCommand } from './cli/gateway.js';
import { memoryCommand } from './cli/memory.js';
import { channelsCommand } from './cli/channels.js';
import { skillsCommand } from './cli/skills.js';

const program = new Command();

program
  .name('echoai')
  .description('🔮 Echo AI - Intelligent Terminal with Autonomous Agents')
  .version('1.0.2');

program
  .argument('[prompt]', 'Direct prompt to send to AI')
  .option('-p, --provider <provider>', 'AI provider to use (claude, openai, gemini, groq, meta)')
  .option('-m, --model <model>', 'Specific model to use')
  .option('-t, --temperature <number>', 'Temperature for generation (0-1)', parseFloat)
  .option('--max-tokens <number>', 'Maximum tokens to generate', parseInt)
  .option('-f, --file <files...>', 'Files to include as context')
  .option('-s, --stream', 'Stream response in real-time')
  .action(async (prompt, options) => {
    if (!prompt) {
      // Show interactive welcome experience
      const { default: showWelcome } = await import('./cli/welcome.js');
      await showWelcome();
      return;
    }

    const { default: handleDirectPrompt } = await import('./cli/direct.js');
    await handleDirectPrompt(prompt, options);
  });

program.addCommand(chatCommand);
program.addCommand(configCommand);
program.addCommand(editCommand);
program.addCommand(providerCommand);
program.addCommand(agentsCommand);

// Add quick analyze command
const analyzeCommand = new Command('analyze')
  .description('🧠 Quick intelligent codebase analysis')
  .action(quickAnalyzeCommand);

program.addCommand(analyzeCommand);
program.addCommand(docsCommand);
program.addCommand(mcpCommand);
program.addCommand(sessionsCommand);
program.addCommand(securityCommand);
program.addCommand(analyticsCommand);
program.addCommand(exportImportCommand);
program.addCommand(modelsCommand);

// New EchoAI Pro commands
program.addCommand(gatewayCommand);
program.addCommand(memoryCommand);
program.addCommand(channelsCommand);
program.addCommand(skillsCommand);

program.parse();