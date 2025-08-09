import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { Message, CommandContext } from '../types/index.js';

export const chatCommand = new Command('chat')
  .description('Start interactive chat session')
  .option('-p, --provider <provider>', 'AI provider to use')
  .option('-m, --model <model>', 'Model to use')
  .option('-t, --temperature <number>', 'Temperature (0-1)', parseFloat)
  .option('--max-tokens <number>', 'Max tokens', parseInt)
  .action(async (options) => {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    
    const config = await configManager.getConfig();
    const context: CommandContext = {
      provider: options.provider || config.defaults.provider,
      model: options.model || config.defaults.model,
      temperature: options.temperature ?? config.defaults.temperature,
      maxTokens: options.maxTokens ?? config.defaults.maxTokens,
      stream: true,
    };

    console.log(`🤖 AI Chat Session - Provider: ${context.provider}, Model: ${context.model}`);
    console.log('Type "exit" to quit, "clear" to clear history\n');

    const messages: Message[] = [];
    
    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: 'You:',
        },
      ]);

      if (input.toLowerCase() === 'exit') {
        console.log('Goodbye! 👋');
        break;
      }

      if (input.toLowerCase() === 'clear') {
        messages.length = 0;
        console.clear();
        console.log('Chat history cleared.\n');
        continue;
      }

      messages.push({
        role: 'user',
        content: input,
        timestamp: new Date(),
      });

      try {
        const provider = await providerManager.getProvider(context.provider!);
        const responseStream = provider.chat(messages, {
          model: context.model,
          temperature: context.temperature,
          maxTokens: context.maxTokens,
          stream: context.stream,
        });

        process.stdout.write('AI: ');
        let fullResponse = '';
        
        for await (const chunk of responseStream) {
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
        
        console.log('\n');
        
        messages.push({
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });