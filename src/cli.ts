#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';

const VERSION = readVersion();
const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-V')) {
  console.log(VERSION);
  process.exit(0);
}

const program = new Command();

program
  .name('echoai')
  .description('🔮 Echo AI - Intelligent Terminal with Autonomous Agents')
  .version(VERSION);

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
      const { default: showWelcome } = await import('./cli/welcome.js');
      await showWelcome();
      return;
    }

    const { default: handleDirectPrompt } = await import('./cli/direct.js');
    await handleDirectPrompt(prompt, options);
  });

const [
  { chatCommand },
  { configCommand },
  { editCommand },
  { providerCommand },
  { agentsCommand },
  { quickAnalyzeCommand },
  { docsCommand },
  { mcpCommand },
  { sessionsCommand },
  { securityCommand },
  { analyticsCommand },
  { exportImportCommand },
  { modelsCommand },
  { gatewayCommand },
  { memoryCommand },
  { channelsCommand },
  { skillsCommand },
  { reviewCommand },
  { securityReviewCommand },
  { tasksCommand },
] = await Promise.all([
  import('./cli/chat.js'),
  import('./cli/config.js'),
  import('./cli/edit.js'),
  import('./cli/provider.js'),
  import('./cli/agents.js'),
  import('./cli/quick-analyze.js'),
  import('./cli/docs.js'),
  import('./cli/mcp.js'),
  import('./cli/sessions.js'),
  import('./cli/security.js'),
  import('./cli/analytics.js'),
  import('./cli/export-import.js'),
  import('./cli/models.js'),
  import('./cli/gateway.js'),
  import('./cli/memory.js'),
  import('./cli/channels.js'),
  import('./cli/skills.js'),
  import('./cli/review.js'),
  import('./cli/security-review.js'),
  import('./cli/tasks.js'),
]);

program.addCommand(chatCommand);
program.addCommand(configCommand);
program.addCommand(editCommand);
program.addCommand(providerCommand);
program.addCommand(agentsCommand);

const analyzeCommand = new Command('analyze')
  .description('🧠 Quick intelligent codebase analysis')
  .option('-s, --session <session-id>', 'Attach the analysis to an existing runtime session')
  .action(async (options) => quickAnalyzeCommand({ session: options.session }));

program.addCommand(analyzeCommand);
program.addCommand(docsCommand);
program.addCommand(mcpCommand);
program.addCommand(sessionsCommand);
program.addCommand(securityCommand);
program.addCommand(reviewCommand);
program.addCommand(securityReviewCommand);
program.addCommand(tasksCommand);
program.addCommand(analyticsCommand);
program.addCommand(exportImportCommand);
program.addCommand(modelsCommand);
program.addCommand(gatewayCommand);
program.addCommand(memoryCommand);
program.addCommand(channelsCommand);
program.addCommand(skillsCommand);

await program.parseAsync();

function readVersion(): string {
  const packageUrl = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}
