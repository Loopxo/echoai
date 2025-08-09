import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '../config/index.js';
import { providerFactory } from '../providers/factory.js';
import { EchoAgentManager } from '../agents/core/manager.js';
import { CodeOptimizerAgent } from '../agents/specialized/code-optimizer.js';
import { PromptEnhancerAgent } from '../agents/optimization/prompt-enhancer.js';

export default async function showWelcome(): Promise<void> {
  console.log('\n🔮 Welcome to Echo AI - Intelligent Terminal with Autonomous Agents');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    const config = await loadConfig();
    
    // Check if user has any configured providers
    const hasConfiguredProviders = Object.keys(config.providers || {}).some(
      key => config.providers[key as keyof typeof config.providers]?.apiKey
    );

    if (!hasConfiguredProviders) {
      console.log('🚀 Let\'s get you started! First, we need to configure an AI provider.\n');
      await setupProvider();
    } else {
      console.log('✨ Ready to go! Your configured providers are ready.\n');
    }

    // Show main menu
    await showMainMenu();

  } catch (error) {
    console.error('❌ Error loading configuration:', error);
    console.log('\n💡 Let\'s set up your first provider...\n');
    await setupProvider();
    await showMainMenu();
  }
}

async function setupProvider(): Promise<void> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider would you like to configure?',
      choices: [
        { name: '🤖 Claude (Anthropic) - Best for coding and analysis', value: 'claude' },
        { name: '🧠 GPT (OpenAI) - Great all-around performance', value: 'openai' },
        { name: '🔍 Gemini (Google) - Strong reasoning capabilities', value: 'gemini' },
        { name: '⚡ Groq - Ultra-fast inference', value: 'groq' },
        { name: '🦙 Meta AI (Llama) - Open source models', value: 'meta' },
      ],
    },
  ]);

  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider.toUpperCase()} API key:`,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'API key is required';
        }
        return true;
      },
    },
  ]);

  // Get model recommendations
  const modelChoices = getModelChoices(provider);
  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Choose a model (recommended option is pre-selected):',
      choices: modelChoices,
      default: 0, // First option is recommended
    },
  ]);

  // Save configuration
  try {
    const config = await loadConfig().catch(() => ({ providers: {} }));
    config.providers = config.providers || {};
    
(config.providers as any)[provider] = {
      apiKey,
      model,
      temperature: 0.7,
      maxTokens: 4096,
    };

    await saveConfig(config);
    console.log(`\n✅ ${provider.toUpperCase()} configured successfully!`);
    
    // Test the connection
    console.log('🔄 Testing connection...');
    const providerInstance = providerFactory.getProvider(provider, (config.providers as any)[provider]);
    const isAuthenticated = await providerInstance.authenticate(apiKey);
    
    if (isAuthenticated) {
      console.log('✅ Connection test successful!\n');
    } else {
      console.log('⚠️  Connection test failed, but configuration saved. Check your API key.\n');
    }
  } catch (error) {
    console.error('❌ Failed to save configuration:', error);
  }
}

async function showMainMenu(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '💬 Start interactive chat session', value: 'chat' },
        { name: '📝 Edit/analyze code files', value: 'edit' },
        { name: '🤖 Use intelligent agents for optimization', value: 'agents' },
        { name: '⚙️  Manage providers and configuration', value: 'config' },
        { name: '📖 View help and documentation', value: 'help' },
        { name: '🚪 Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'chat':
      await startInteractiveChat();
      break;
    case 'edit':
      await startCodeEditing();
      break;
    case 'agents':
      await showAgentsMenu();
      break;
    case 'config':
      await showConfigMenu();
      break;
    case 'help':
      showHelp();
      break;
    case 'exit':
      console.log('\n👋 Thanks for using Echo AI! Run `echoai` anytime to return.\n');
      process.exit(0);
      break;
  }
}

async function startInteractiveChat(): Promise<void> {
  console.log('\n🔄 Starting interactive chat session...\n');
  console.log('💡 Tip: Type "exit" to return to main menu, "clear" to clear history\n');

  const config = await loadConfig();
  const defaultProvider = getDefaultProvider(config);
  
  if (!defaultProvider) {
    console.log('❌ No providers configured. Please set up a provider first.');
    return showMainMenu();
  }

  const agentManager = new EchoAgentManager();
  // Register available agents
  agentManager.registerAgent(new CodeOptimizerAgent());
  agentManager.registerAgent(new PromptEnhancerAgent());
  
  while (true) {
    const { prompt } = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: '🔮 Echo:',
      },
    ]);

    if (prompt.toLowerCase() === 'exit') {
      break;
    }

    if (prompt.toLowerCase() === 'clear') {
      console.clear();
      console.log('🧹 Chat history cleared!\n');
      continue;
    }

    if (!prompt.trim()) continue;

    try {
      // Use agent optimization
      console.log('🤖 Optimizing your request...');
      const context = { input: prompt, provider: defaultProvider, model: 'default', userPreferences: undefined };
      const optimized = await agentManager.optimizeWithAgent(context);
      
      if (optimized.metadata.agentUsed !== 'none') {
        console.log(`✨ Applied ${optimized.metadata.agentUsed} optimization (confidence: ${Math.round(optimized.confidence * 100)}%)`);
      }

      // Get provider and send request
      const provider = providerFactory.getProvider(
        optimized.suggestedProvider || defaultProvider,
        (config.providers as any)[optimized.suggestedProvider || defaultProvider]
      );

      console.log('\n💭 Thinking...\n');
      
      const messages = [{ role: 'user' as const, content: optimized.optimizedPrompt }];
      
      for await (const chunk of provider.chat(messages, { stream: true })) {
        process.stdout.write(chunk);
      }
      
      console.log('\n\n' + '─'.repeat(50) + '\n');

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('');
    }
  }

  return showMainMenu();
}

async function startCodeEditing(): Promise<void> {
  const { filePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Enter file path to analyze/edit (or press Enter to list current directory):',
    },
  ]);

  if (!filePath.trim()) {
    console.log('\n📁 Current directory files:');
    try {
      const { execSync } = await import('child_process');
      const files = execSync('ls -la', { encoding: 'utf-8' });
      console.log(files);
    } catch (error) {
      console.log('❌ Could not list files');
    }
    return showMainMenu();
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with this file?',
      choices: [
        { name: '👀 Analyze and explain code', value: 'analyze' },
        { name: '🔧 Suggest improvements', value: 'improve' },
        { name: '🐛 Find potential bugs', value: 'debug' },
        { name: '📖 Generate documentation', value: 'document' },
        { name: '↩️  Back to main menu', value: 'back' },
      ],
    },
  ]);

  if (action === 'back') {
    return showMainMenu();
  }

  console.log(`\n🔄 Processing file: ${filePath}\n`);
  console.log('💡 Tip: This would integrate with the edit command for actual file operations\n');
  
  return showMainMenu();
}

async function showAgentsMenu(): Promise<void> {
  console.log('\n🤖 Available Intelligent Agents:\n');
  
  const agentManager = new EchoAgentManager();
  // Register available agents
  agentManager.registerAgent(new CodeOptimizerAgent());
  agentManager.registerAgent(new PromptEnhancerAgent());
  
  const agents = agentManager.listAvailableAgents();
  
  agents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.name} - ${agent.description}`);
  });
  
  console.log('\n💡 Agents automatically optimize your prompts for better results!\n');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🧪 Test prompt optimization', value: 'test' },
        { name: '📊 View agent capabilities', value: 'info' },
        { name: '↩️  Back to main menu', value: 'back' },
      ],
    },
  ]);

  if (action === 'test') {
    const { testPrompt } = await inquirer.prompt([
      {
        type: 'input',
        name: 'testPrompt',
        message: 'Enter a prompt to see how agents optimize it:',
      },
    ]);

    if (testPrompt.trim()) {
      console.log('\n🤖 Processing with agents...\n');
      const context = { input: testPrompt, provider: 'claude', model: 'default', userPreferences: undefined };
      const result = await agentManager.optimizeWithAgent(context);
      
      console.log('📥 Original prompt:', testPrompt);
      console.log('📤 Optimized prompt:', result.optimizedPrompt);
      console.log('🎯 Agent used:', result.metadata.agentUsed);
      console.log('📈 Confidence:', Math.round(result.confidence * 100) + '%');
      console.log('🔧 Optimizations applied:', result.metadata.optimizationApplied.join(', '));
      console.log('');
    }
  }

  if (action !== 'back') {
    return showAgentsMenu();
  } else {
    return showMainMenu();
  }
}

async function showConfigMenu(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Configuration options:',
      choices: [
        { name: '➕ Add new provider', value: 'add' },
        { name: '👀 View current config', value: 'view' },
        { name: '🧹 Reset configuration', value: 'reset' },
        { name: '↩️  Back to main menu', value: 'back' },
      ],
    },
  ]);

  switch (action) {
    case 'add':
      await setupProvider();
      break;
    case 'view':
      try {
        const config = await loadConfig();
        console.log('\n📋 Current Configuration:\n');
        console.log(JSON.stringify(config, null, 2));
        console.log('');
      } catch (error) {
        console.log('❌ No configuration found');
      }
      break;
    case 'reset':
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '⚠️  Are you sure you want to reset all configuration?',
          default: false,
        },
      ]);
      
      if (confirm) {
        console.log('🧹 Configuration reset! You\'ll need to set up providers again.');
      }
      break;
    case 'back':
      return showMainMenu();
  }

  if (action !== 'back') {
    return showConfigMenu();
  }
}

function showHelp(): void {
  console.log(`
🔮 Echo AI CLI - Help & Documentation

COMMANDS:
  echoai                     - Interactive welcome (this screen)
  echoai "your prompt"       - Direct AI interaction
  echoai chat                - Start chat session
  echoai edit <file>         - Analyze/edit files  
  echoai agents list         - List available agents
  echoai config setup        - Configure providers
  echoai provider list       - List available providers

EXAMPLES:
  echoai "explain this code"
  echoai edit main.py
  echoai chat --provider claude
  echoai agents optimize "write a function"

FEATURES:
  🤖 5 AI Providers (Claude, GPT, Gemini, Groq, Meta)
  🧠 Intelligent Agents for prompt optimization
  📝 Code analysis and editing capabilities
  💬 Interactive chat sessions
  ⚙️  Flexible configuration system

For more info: https://github.com/your-username/echo-ai-cli
`);
  
  console.log('\nPress Enter to continue...');
  process.stdin.once('data', () => {
    showMainMenu();
  });
}

function getModelChoices(provider: string): Array<{ name: string; value: string }> {
  switch (provider) {
    case 'claude':
      return [
        { name: '🏆 Claude 3.5 Sonnet (Recommended)', value: 'claude-3-5-sonnet-20241022' },
        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
      ];
    case 'openai':
      return [
        { name: '🏆 GPT-4o (Recommended)', value: 'gpt-4o' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      ];
    case 'gemini':
      return [
        { name: '🏆 Gemini 1.5 Pro (Recommended)', value: 'gemini-1.5-pro' },
        { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
        { name: 'Gemini 1.0 Pro', value: 'gemini-1.0-pro' },
      ];
    case 'groq':
      return [
        { name: '🏆 Llama 3 70B (Recommended)', value: 'llama3-70b-8192' },
        { name: 'Llama 3 8B', value: 'llama3-8b-8192' },
        { name: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
      ];
    case 'meta':
      return [
        { name: '🏆 Llama 3.1 70B (Recommended)', value: 'llama-3.1-70b-instruct' },
        { name: 'Llama 3.1 405B', value: 'llama-3.1-405b-instruct' },
        { name: 'Code Llama 70B', value: 'code-llama-70b-instruct' },
      ];
    default:
      return [{ name: 'Default Model', value: 'default' }];
  }
}

function getDefaultProvider(config: any): string {
  if (!config.providers) return 'claude';
  
  const providers = Object.keys(config.providers).filter(
    key => config.providers[key]?.apiKey
  );
  
  return providers.length > 0 ? providers[0]! : 'claude';
}