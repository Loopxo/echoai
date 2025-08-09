import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../config/manager.js';
import { ProviderConfig } from '../types/index.js';

export const configCommand = new Command('config')
  .description('Manage AI CLI configuration');

configCommand
  .command('list')
  .description('List current configuration')
  .action(async () => {
    const configManager = new ConfigManager();
    const config = await configManager.getConfig();
    
    console.log('📋 Current Configuration:\n');
    console.log(`Default Provider: ${config.defaults.provider}`);
    console.log(`Default Model: ${config.defaults.model}`);
    console.log(`Temperature: ${config.defaults.temperature}`);
    console.log(`Max Tokens: ${config.defaults.maxTokens}\n`);
    
    console.log('🔑 Configured Providers:');
    const providers = await configManager.listProviders();
    if (providers.length === 0) {
      console.log('  No providers configured');
    } else {
      providers.forEach(provider => {
        console.log(`  - ${provider} ✅`);
      });
    }
    
    console.log('\n⚙️  Features:');
    console.log(`  VS Code Integration: ${config.integrations.vscode.enabled ? '✅' : '❌'}`);
    console.log(`  Auto Commit: ${config.features.autoCommit ? '✅' : '❌'}`);
    console.log(`  Diff Preview: ${config.features.diffPreview ? '✅' : '❌'}`);
    console.log(`  Streaming: ${config.features.streaming ? '✅' : '❌'}`);
  });

configCommand
  .command('set')
  .description('Set configuration values')
  .argument('<key>', 'Configuration key (e.g., claude.key, defaults.provider)')
  .argument('<value>', 'Configuration value')
  .action(async (key, value) => {
    const configManager = new ConfigManager();
    const [provider, setting] = key.split('.');
    
    if (setting === 'key' || setting === 'apiKey') {
      const providerConfig: ProviderConfig = {
        apiKey: value,
      };
      await configManager.setProvider(provider, providerConfig);
      console.log(`✅ Set API key for ${provider}`);
    } else if (key.startsWith('defaults.')) {
      const config = await configManager.getConfig();
      const defaultKey = key.replace('defaults.', '') as keyof typeof config.defaults;
      
      if (defaultKey in config.defaults) {
        const parsedValue = defaultKey === 'temperature' || defaultKey === 'maxTokens' 
          ? parseFloat(value) 
          : value;
        
        await configManager.setGlobalConfig({
          defaults: {
            ...config.defaults,
            [defaultKey]: parsedValue,
          },
        });
        console.log(`✅ Set ${defaultKey} to ${parsedValue}`);
      } else {
        console.error(`❌ Unknown default setting: ${defaultKey}`);
      }
    } else {
      console.error(`❌ Unknown configuration key: ${key}`);
    }
  });

configCommand
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    const configManager = new ConfigManager();
    
    console.log('🚀 AI CLI Setup Wizard\n');
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Choose your primary AI provider:',
        choices: [
          { name: 'Claude (Anthropic)', value: 'claude' },
          { name: 'OpenAI (GPT)', value: 'openai' },
          { name: 'Google Gemini', value: 'gemini' },
          { name: 'Groq (Fast Inference)', value: 'groq' },
          { name: 'Meta AI (Llama)', value: 'meta' },
        ],
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your API key:',
        mask: '*',
      },
      {
        type: 'list',
        name: 'model',
        message: 'Choose default model:',
        choices: (answers: any) => {
          switch (answers.provider) {
            case 'claude':
              return [
                'claude-3-sonnet-20240229',
                'claude-3-opus-20240229',
                'claude-3-haiku-20240307',
              ];
            case 'openai':
              return [
                'gpt-4-turbo-preview',
                'gpt-4',
                'gpt-3.5-turbo',
              ];
            case 'gemini':
              return [
                'gemini-pro',
                'gemini-pro-vision',
              ];
            case 'groq':
              return [
                'llama3-70b-8192',
                'llama3-8b-8192',
                'mixtral-8x7b-32768',
                'gemma2-9b-it',
              ];
            case 'meta':
              return [
                'llama-3.1-70b-instruct',
                'llama-3.1-8b-instruct',
                'code-llama-70b-instruct',
                'code-llama-34b-instruct',
              ];
            default:
              return ['default'];
          }
        },
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Default temperature (0-1):',
        default: 0.7,
        validate: (value) => value >= 0 && value <= 1,
      },
      {
        type: 'confirm',
        name: 'streaming',
        message: 'Enable streaming responses?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'vscodeIntegration',
        message: 'Enable VS Code integration?',
        default: true,
      },
    ]);

    const providerConfig: ProviderConfig = {
      apiKey: answers.apiKey,
      model: answers.model,
      temperature: answers.temperature,
    };

    await configManager.setProvider(answers.provider, providerConfig);
    
    await configManager.setGlobalConfig({
      defaults: {
        provider: answers.provider,
        model: answers.model,
        temperature: answers.temperature,
        maxTokens: 4096,
      },
      features: {
        autoCommit: false,
        diffPreview: true,
        streaming: answers.streaming,
      },
      integrations: {
        vscode: {
          enabled: answers.vscodeIntegration,
          autoSave: true,
          diffPreview: true,
        },
        git: {
          autoCommit: false,
        },
      },
    });

    console.log('\n✅ Configuration saved successfully!');
    console.log('🔮 You can now use: echo "Hello, world!"');
    console.log('💡 Try: echo agents list - to see available intelligent agents');
  });