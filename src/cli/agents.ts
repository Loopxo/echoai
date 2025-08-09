import { Command } from 'commander';
import { EchoAgentManager } from '../agents/core/manager.js';
import { CodeOptimizerAgent } from '../agents/specialized/code-optimizer.js';
import { PromptEnhancerAgent } from '../agents/optimization/prompt-enhancer.js';
import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { AgentContext } from '../agents/types.js';

export const agentsCommand = new Command('agents')
  .description('Manage and use Echo intelligent agents');

agentsCommand
  .command('list')
  .description('List all available agents and their capabilities')
  .action(async () => {
    const agentManager = new EchoAgentManager();
    
    // Register built-in agents
    agentManager.registerAgent(new CodeOptimizerAgent());
    agentManager.registerAgent(new PromptEnhancerAgent());
    
    const agents = agentManager.listAvailableAgents();
    
    console.log('🤖 Available Echo Agents:\n');
    
    for (const agent of agents) {
      console.log(`## ${agent.name} v${agent.version}`);
      console.log(`   ${agent.capabilities.length} capabilities\n`);
      
      for (const capability of agent.capabilities) {
        const icon = capability.category === 'optimization' ? '⚡' : 
                    capability.category === 'analysis' ? '🔍' : 
                    capability.category === 'generation' ? '✨' : '🔧';
        
        console.log(`   ${icon} ${capability.name}`);
        console.log(`     ${capability.description}`);
        console.log(`     Providers: ${capability.supportedProviders.join(', ')}\n`);
      }
    }
    
    console.log('💡 Use "echo optimize <prompt>" to let agents enhance your prompts automatically');
  });

agentsCommand
  .command('optimize')
  .description('Optimize a prompt using intelligent agents')
  .argument('<prompt>', 'The prompt to optimize')
  .option('-p, --provider <provider>', 'Target provider')
  .option('-m, --model <model>', 'Target model')
  .option('--format <format>', 'Output format (concise|detailed|structured|creative)', 'structured')
  .option('--level <level>', 'Explanation level (beginner|intermediate|expert)', 'intermediate')
  .option('--examples', 'Include examples in output', false)
  .action(async (prompt, options) => {
    const configManager = new ConfigManager();
    const config = await configManager.getConfig();
    const agentManager = new EchoAgentManager();
    
    // Register agents
    agentManager.registerAgent(new CodeOptimizerAgent());
    agentManager.registerAgent(new PromptEnhancerAgent());
    
    const context: AgentContext = {
      input: prompt,
      provider: options.provider || config.defaults.provider,
      model: options.model || config.defaults.model,
      userPreferences: {
        outputFormat: options.format,
        explanationLevel: options.level,
        includeExamples: options.examples,
      },
    };
    
    console.log('🔮 Echo agents analyzing your prompt...\n');
    
    try {
      const result = await agentManager.optimizeWithAgent(context);
      
      console.log('📋 Optimization Results:\n');
      console.log(`Agent Used: ${result.metadata.agentUsed}`);
      console.log(`Confidence: ${Math.round(result.confidence * 100)}%`);
      console.log(`Expected Output: ${result.expectedOutputType}`);
      
      if (result.suggestedProvider) {
        console.log(`Suggested Provider: ${result.suggestedProvider}`);
      }
      
      if (result.suggestedModel) {
        console.log(`Suggested Model: ${result.suggestedModel}`);
      }
      
      console.log(`Optimizations Applied: ${result.metadata.optimizationApplied.join(', ')}`);
      console.log(`Estimated Tokens: ${result.metadata.estimatedTokens || 'Unknown'}\n`);
      
      console.log('✨ Optimized Prompt:');
      console.log('─'.repeat(50));
      console.log(result.optimizedPrompt);
      console.log('─'.repeat(50));
      
      console.log('\n💡 You can now use this optimized prompt with:');
      if (result.suggestedProvider) {
        console.log(`   echo "${result.optimizedPrompt}" --provider ${result.suggestedProvider}`);
      } else {
        console.log(`   echo "${result.optimizedPrompt}"`);
      }
      
    } catch (error) {
      console.error('❌ Error optimizing prompt:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

agentsCommand
  .command('run')
  .description('Run a prompt with automatic agent optimization and execution')
  .argument('<prompt>', 'The prompt to optimize and run')
  .option('-p, --provider <provider>', 'AI provider to use')
  .option('-m, --model <model>', 'Specific model to use')
  .option('--format <format>', 'Output format preference')
  .option('--level <level>', 'Explanation level')
  .option('--examples', 'Include examples')
  .option('--stream', 'Stream response in real-time')
  .action(async (prompt, options) => {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    const agentManager = new EchoAgentManager();
    
    // Register agents
    agentManager.registerAgent(new CodeOptimizerAgent());
    agentManager.registerAgent(new PromptEnhancerAgent());
    
    const config = await configManager.getConfig();
    
    const context: AgentContext = {
      input: prompt,
      provider: options.provider || config.defaults.provider,
      model: options.model || config.defaults.model,
      userPreferences: {
        outputFormat: options.format || 'structured',
        explanationLevel: options.level || 'intermediate',
        includeExamples: options.examples || true,
      },
    };
    
    try {
      console.log('🤖 Echo agents optimizing your prompt...');
      
      const optimizationResult = await agentManager.optimizeWithAgent(context);
      
      console.log(`✨ Optimized with ${optimizationResult.metadata.agentUsed} (${Math.round(optimizationResult.confidence * 100)}% confidence)\n`);
      
      // Use suggested provider/model if available
      const finalProvider = optimizationResult.suggestedProvider || context.provider;
      const finalModel = optimizationResult.suggestedModel || context.model;
      
      const provider = await providerManager.getProvider(finalProvider);
      
      console.log(`🔮 ${finalProvider.toUpperCase()} generating response...\n`);
      
      const messages = [
        {
          role: 'user' as const,
          content: optimizationResult.optimizedPrompt,
          timestamp: new Date(),
        },
      ];
      
      const chatOptions = {
        model: finalModel,
        temperature: config.defaults.temperature,
        maxTokens: config.defaults.maxTokens,
        stream: options.stream ?? true,
      };
      
      let fullResponse = '';
      
      if (options.stream) {
        for await (const chunk of provider.chat(messages, chatOptions)) {
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
        console.log('\n');
      } else {
        for await (const chunk of provider.chat(messages, { ...chatOptions, stream: false })) {
          fullResponse += chunk;
        }
        console.log(fullResponse);
      }
      
      // Apply post-processing if agent supports it
      const agent = agentManager.findBestAgent(context);
      if (agent && agent.postProcess) {
        console.log('\n🔧 Applying post-processing...');
        const processedResponse = await agent.postProcess(fullResponse, context);
        if (processedResponse !== fullResponse) {
          console.log('\n📝 Post-processed result:');
          console.log('─'.repeat(50));
          console.log(processedResponse);
        }
      }
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });