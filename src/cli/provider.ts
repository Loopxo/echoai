import { Command } from 'commander';
import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';

export const providerCommand = new Command('provider')
  .description('Manage AI providers');

providerCommand
  .command('list')
  .description('List available and configured providers')
  .action(async () => {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    
    const configuredProviders = await configManager.listProviders();
    const availableProviders = ['claude', 'openai', 'gemini', 'groq', 'meta']; // All supported providers
    
    console.log('🔧 Available Providers:');
    for (const provider of availableProviders) {
      const isConfigured = configuredProviders.includes(provider);
      const status = isConfigured ? '✅ Configured' : '❌ Not configured';
      console.log(`  ${provider}: ${status}`);
    }
    
    if (configuredProviders.length > 0) {
      console.log('\n💡 To test a provider: echo provider test <name>');
    } else {
      console.log('\n💡 To set up a provider: echo config setup');
    }
  });

providerCommand
  .command('test')
  .description('Test provider authentication')
  .argument('<name>', 'Provider name to test')
  .action(async (name) => {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    
    console.log(`🔍 Testing ${name} provider...`);
    
    try {
      const isWorking = await providerManager.testProvider(name);
      
      if (isWorking) {
        console.log(`✅ ${name} provider is working correctly!`);
      } else {
        console.log(`❌ ${name} provider test failed. Check your API key and configuration.`);
      }
    } catch (error) {
      console.error(`❌ Error testing ${name}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  });

providerCommand
  .command('models')
  .description('List available models for a provider')
  .argument('<name>', 'Provider name')
  .action(async (name) => {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    
    try {
      const provider = await providerManager.getProvider(name);
      
      console.log(`🤖 Available models for ${name}:`);
      provider.models.forEach((model, index) => {
        console.log(`  ${index + 1}. ${model}`);
      });
      
    } catch (error) {
      console.error(`❌ Error loading ${name}:`, error instanceof Error ? error.message : 'Unknown error');
      console.log('💡 Make sure the provider is configured: echo config setup');
    }
  });