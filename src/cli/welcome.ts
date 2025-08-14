import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '../config/index.js';
import { providerFactory } from '../providers/factory.js';
import { EchoAgentManager } from '../agents/core/manager.js';
import { CodeOptimizerAgent } from '../agents/specialized/code-optimizer.js';
import { PromptEnhancerAgent } from '../agents/optimization/prompt-enhancer.js';
import { AutoDocumentationAgent } from '../agents/specialized/auto-documentation-agent.js';
import { getProjectContext, findRelevantFiles } from '../utils/project-context.js';
import { parseFileOperationFromAI } from '../utils/file-operations.js';
import { handleClaudeStyleEdit, parseEditInstructions } from '../utils/claude-style-editor.js';
import { resetSession } from '../utils/session-state.js';
import { analyzeRepository } from '../utils/repo-analyzer.js';
import { intelligentCodebaseAnalysis, generateCodebaseOverview } from '../utils/intelligent-codebase-analyzer.js';
import { generateProjectDocumentation, DocumentationConfig } from '../utils/documentation-generator.js';
import { tokenTracker } from '../utils/token-tracker.js';
import { echoSound, echoWarning } from '../utils/echo-sound.js';
import { permissionManager } from '../utils/permission-prompt.js';
import { initializeProject, parseProjectCreationRequest } from '../utils/project-initializer.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export default async function showWelcome(): Promise<void> {
  // ASCII Art Logo
  console.log(`
████████╗ ██████╗██╗  ██╗ ██████╗ 
██╔══════╝██╔════╝██║  ██║██╔═══██╗
█████╗   ██║     ███████║██║   ██║
██╔══╝   ██║     ██╔══██║██║   ██║
███████╗ ╚██████╗██║  ██║╚██████╔╝
╚══════╝  ╚═════╝╚═╝  ╚═╝ ╚═════╝ 
`);
  
  console.log('Welcome to Echo AI - Intelligent Terminal with Autonomous Agents');
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
      const providerCount = Object.keys(config.providers || {}).filter(
        key => config.providers![key]?.apiKey
      ).length;
      const currentProvider = getDefaultProvider(config);
      const currentProviderConfig = config.providers?.[currentProvider];
      const currentModel = currentProviderConfig?.model || 'default';
      
      console.log(`✨ Ready to go! You have ${providerCount} provider${providerCount > 1 ? 's' : ''} configured.`);
      console.log(`🤖 Currently using: ${currentProvider?.toUpperCase()} (${currentModel})\n`);
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
  // Load existing config to check for already configured providers
  const existingConfig = await loadConfig().catch(() => ({ providers: {} }));
  const configuredProviders = Object.keys(existingConfig.providers || {}).filter(
    key => (existingConfig.providers as any)?.[key]?.apiKey
  );

  const allProviders = [
    { name: '🤖 Claude (Anthropic) - Best for coding and analysis', value: 'claude' },
    { name: '🧠 GPT (OpenAI) - Great all-around performance', value: 'openai' },
    { name: '🔍 Gemini (Google) - Strong reasoning capabilities', value: 'gemini' },
    { name: '⚡ Groq - Ultra-fast inference', value: 'groq' },
    { name: '🦙 Meta AI (Llama) - Open source models', value: 'meta' },
    { name: '🌐 OpenRouter - 100+ models via unified API', value: 'openrouter' },
  ];

  // Mark already configured providers
  const providerChoices = allProviders.map(provider => {
    const isConfigured = configuredProviders.includes(provider.value);
    return {
      ...provider,
      name: isConfigured ? `${provider.name} ✅ (Already configured)` : provider.name
    };
  });

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider would you like to configure?',
      choices: providerChoices,
    },
  ]);

  // Check if provider is already configured
  const isAlreadyConfigured = configuredProviders.includes(provider);
  if (isAlreadyConfigured) {
    const existingProvider = (existingConfig.providers as any)[provider];
    const maskedKey = existingProvider.apiKey.substring(0, 8) + '***' + existingProvider.apiKey.slice(-4);
    
    console.log(`\n✅ ${provider.toUpperCase()} is already configured with API key: ${maskedKey}`);
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔄 Use existing configuration', value: 'keep' },
          { name: '🔑 Update API key', value: 'update' },
          { name: '⚙️  Reconfigure completely', value: 'reconfigure' },
          { name: '← Back to provider selection', value: 'back' },
        ],
      },
    ]);

    if (action === 'keep') {
      console.log(`\n✅ Using existing ${provider.toUpperCase()} configuration!`);
      return;
    } else if (action === 'back') {
      return setupProvider();
    } else if (action === 'update') {
      await updateApiKey(provider, existingConfig);
      return;
    }
    // If 'reconfigure', continue with full setup below
  }

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
    const config = await loadConfig().catch(() => ({
      providers: {},
      defaults: {
        provider: 'claude',
        model: 'claude-3-sonnet-20240229',
        temperature: 0.7,
        maxTokens: 4096,
      },
      integrations: {
        vscode: { enabled: true, autoSave: true, diffPreview: true },
        git: { autoCommit: false },
      },
      features: { autoCommit: false, diffPreview: true, streaming: true },
    }));
    
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

async function updateApiKey(provider: string, config: any): Promise<void> {
  const { newApiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'newApiKey',
      message: `Enter new ${provider.toUpperCase()} API key:`,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'API key is required';
        }
        return true;
      },
    },
  ]);

  try {
    // Update the API key while keeping other settings
    (config.providers as any)[provider] = {
      ...(config.providers as any)[provider],
      apiKey: newApiKey,
    };

    await saveConfig(config);
    console.log(`\n✅ ${provider.toUpperCase()} API key updated successfully!`);
    
    // Test the new connection
    console.log('🔄 Testing new API key...');
    const providerInstance = providerFactory.getProvider(provider, (config.providers as any)[provider]);
    const isAuthenticated = await providerInstance.authenticate(newApiKey);
    
    if (isAuthenticated) {
      console.log('✅ Connection test successful!\n');
    } else {
      console.log('⚠️  Connection test failed, but configuration saved. Check your API key.\n');
    }
  } catch (error) {
    console.error('❌ Failed to update API key:', error);
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
        { name: '📚 Generate smart auto-documentation', value: 'docs' },
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
    case 'docs':
      await showDocumentationMenu();
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
  
  const config = await loadConfig();
  const defaultProvider = getDefaultProvider(config);
  
  // Show current provider
  if (defaultProvider) {
    const providerConfig = config.providers?.[defaultProvider];
    const model = providerConfig?.model || 'default';
    console.log(`🤖 Using: ${defaultProvider.toUpperCase()} (${model})`);
  }
  
  console.log('💡 Tips:');
  console.log('  • Type "exit" or press Ctrl+C to return to main menu');
  console.log('  • Type "clear" to clear chat history');
  console.log('  • Type "switch" to change AI provider\n');
  
  if (!defaultProvider) {
    console.log('❌ No providers configured. Please set up a provider first.');
    return showMainMenu();
  }

  // Debug: Check if provider config exists
  const providerConfig = config.providers?.[defaultProvider];
  if (!providerConfig || !providerConfig.apiKey) {
    console.log(`❌ Configuration missing for provider '${defaultProvider}'. Please reconfigure.`);
    return showMainMenu();
  }

  const agentManager = new EchoAgentManager();
  // Register available agents
  agentManager.registerAgent(new CodeOptimizerAgent());
  agentManager.registerAgent(new PromptEnhancerAgent());
  agentManager.registerAgent(new AutoDocumentationAgent());
  
  // Handle Ctrl+C to return to main menu
  process.on('SIGINT', () => {
    console.log('\n\n👋 Returning to main menu...\n');
    tokenTracker.endSession();
    return showMainMenu();
  });
  
  let currentProvider = defaultProvider;
  let currentConfig = config;
  
  // Start token tracking session
  const sessionId = tokenTracker.startSession(currentProvider);
  console.log(`📊 Token tracking started (Session: ${sessionId.slice(-6)})`);
  
  // Show current token limits if configured
  const limits = currentConfig.limits;
  if (limits) {
    console.log('⚖️  Active limits:');
    if (limits.daily) console.log(`   📅 Daily: ${limits.daily.toLocaleString()} tokens`);
    if (limits.session) console.log(`   🔄 Session: ${limits.session.toLocaleString()} tokens`);
    if (limits.cost?.daily) console.log(`   💰 Daily cost: $${limits.cost.daily}`);
  }
  
  while (true) {
    try {
      const { prompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: `🔮 Echo (${currentProvider?.toUpperCase()}):`,
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
      
      if (prompt.toLowerCase() === 'switch') {
        const switchResult = await switchProvider(currentConfig);
        if (switchResult) {
          currentProvider = switchResult.provider;
          currentConfig = switchResult.config;
          console.log(`✅ Switched to ${currentProvider?.toUpperCase()}\n`);
        }
        continue;
      }

    if (!prompt.trim()) continue;

    try {
      // Use agent optimization
      console.log('🤖 Optimizing your request...');
      const context = { input: prompt, provider: currentProvider, model: 'default', userPreferences: undefined };
      const optimized = await agentManager.optimizeWithAgent(context);
      
      if (optimized.metadata.agentUsed !== 'none') {
        console.log(`✨ Applied ${optimized.metadata.agentUsed} optimization (confidence: ${Math.round(optimized.confidence * 100)}%)`);
      }

      // Get provider and send request
      const selectedProvider = optimized.suggestedProvider || currentProvider;
      const selectedProviderConfig = currentConfig.providers?.[selectedProvider];
      
      if (!selectedProviderConfig) {
        throw new Error(`No configuration found for provider '${selectedProvider}'. Run: echo config setup`);
      }
      
      const provider = providerFactory.getProvider(selectedProvider, selectedProviderConfig);

      console.log('\n💭 Thinking...\n');
      
      const messages = [{ role: 'user' as const, content: optimized.optimizedPrompt }];
      
      // Estimate input tokens
      const inputTokens = tokenTracker.estimateTokens(optimized.optimizedPrompt);
      let responseText = '';
      
      for await (const chunk of provider.chat(messages, { stream: true })) {
        process.stdout.write(chunk);
        responseText += chunk;
      }
      
      // Calculate tokens and cost
      const outputTokens = tokenTracker.estimateTokens(responseText);
      const totalTokens = inputTokens + outputTokens;
      const inputCost = tokenTracker.estimateCost(inputTokens, selectedProvider, selectedProviderConfig?.model || 'default', true);
      const outputCost = tokenTracker.estimateCost(outputTokens, selectedProvider, selectedProviderConfig?.model || 'default', false);
      const totalCost = inputCost + outputCost;
      
      // Track the usage
      const usage = tokenTracker.trackUsage({
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: totalCost,
        provider: selectedProvider,
        model: selectedProviderConfig?.model || 'default'
      });
      
      // Display token usage
      console.log('\n' + tokenTracker.formatUsage(usage));
      
      // Check limits and warn if necessary
      if (currentConfig.limits) {
        const limitCheck = tokenTracker.checkLimits(usage, {
          daily: currentConfig.limits.daily,
          session: currentConfig.limits.session,
          cost: currentConfig.limits.cost?.daily
        });
        
        if (limitCheck.warnings.length > 0) {
          if (currentConfig.sound?.tokenWarnings) {
            await echoWarning();
          }
          limitCheck.warnings.forEach(warning => console.log(warning));
        }
        
        if (limitCheck.exceeded) {
          console.log('\n🚨 TOKEN LIMIT EXCEEDED! Consider taking a break or adjusting your limits.');
          if (currentConfig.sound?.tokenWarnings) {
            await echoWarning();
            await echoWarning();
          }
        }
      }
      
      console.log('\n' + '─'.repeat(50) + '\n');

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('');
    }
    } catch (error) {
      // Handle Ctrl+C or other interruptions
      console.log('\n\n👋 Returning to main menu...\n');
      break;
    }
  }

  // End token tracking session
  const session = tokenTracker.endSession();
  if (session) {
    console.log('\n📊 Session Summary:');
    console.log(tokenTracker.formatUsage(session.totalUsage));
    console.log(`⏱️  Duration: ${Math.round((new Date(session.endTime!).getTime() - new Date(session.startTime).getTime()) / 1000 / 60)} minutes`);
    console.log(`💬 Interactions: ${session.interactions.length}`);
  }
  
  // Show overall analytics
  const analytics = tokenTracker.getAnalytics();
  console.log('\n📈 Overall Usage:');
  console.log(tokenTracker.formatAnalytics(analytics));

  return showMainMenu();
}

async function switchProvider(config: any): Promise<{provider: string, config: any} | null> {
  console.log('\n🔄 Available Providers:\n');
  
  const configuredProviders = Object.keys(config.providers || {}).filter(
    key => config.providers[key]?.apiKey
  );
  
  if (configuredProviders.length === 0) {
    console.log('❌ No providers configured. Please set up a provider first.');
    return null;
  }
  
  const currentProvider = getDefaultProvider(config);
  const choices = configuredProviders.map(provider => {
    const providerConfig = config.providers[provider];
    const model = providerConfig?.model || 'default';
    const isActive = provider === currentProvider;
    return {
      name: `${provider.toUpperCase()} (${model})${isActive ? ' ✅ Currently Active' : ''}`,
      value: provider
    };
  });
  
  const { selectedProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedProvider',
      message: 'Switch to which provider?',
      choices: choices,
    },
  ]);
  
  // Update the default provider in config
  const updatedConfig = { ...config };
  updatedConfig.defaults = { ...updatedConfig.defaults, provider: selectedProvider };
  
  try {
    await saveConfig(updatedConfig);
    return { provider: selectedProvider, config: updatedConfig };
  } catch (error) {
    console.error('❌ Failed to save provider selection:', error);
    return null;
  }
}

async function startCodeEditing(): Promise<void> {
  // Reset session state when starting a new code editing session
  resetSession();
  
  // Get project context like Claude Code
  const projectContext = getProjectContext();
  
  console.log(`\n📁 Working on: ${projectContext.projectName}`);
  console.log(`📍 Location: ${projectContext.workingDirectory}`);
  console.log(`🏗️  Project: ${projectContext.projectType}${projectContext.framework ? ` (${projectContext.framework})` : ''}`);
  console.log(`📊 Files: ${projectContext.filesCount} ${projectContext.gitRepo ? '• Git Repository' : ''}`);

  const config = await loadConfig();
  const defaultProvider = getDefaultProvider(config);
  
  // Show current provider
  if (defaultProvider) {
    const providerConfig = config.providers?.[defaultProvider];
    const model = providerConfig?.model || 'default';
    console.log(`🤖 Using: ${defaultProvider.toUpperCase()} (${model})`);
  }
  
  if (!defaultProvider) {
    console.log('❌ No providers configured. Please set up a provider first.');
    return showMainMenu();
  }

  const providerConfig = config.providers?.[defaultProvider];
  if (!providerConfig || !providerConfig.apiKey) {
    console.log(`❌ Configuration missing for provider '${defaultProvider}'. Please reconfigure.`);
    return showMainMenu();
  }

  console.log('\n💡 Tips:');
  console.log('  • Type "exit" to return to main menu');
  console.log('  • Type "files" to show project structure');
  console.log('  • Type "analyze" for deep repository analysis');
  console.log('  • Type "switch" to change AI provider');
  console.log('  • Try: "create react todo app" or "analyze this repository"\n');

  let currentProvider = defaultProvider;
  let currentConfig = config;
  
  while (true) {
    const { prompt } = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: `🔮 ${projectContext.projectName} (${currentProvider?.toUpperCase()}):`,
      },
    ]);

    if (prompt.toLowerCase() === 'exit') {
      break;
    }
    
    if (prompt.toLowerCase() === 'switch') {
      const switchResult = await switchProvider(currentConfig);
      if (switchResult) {
        currentProvider = switchResult.provider;
        currentConfig = switchResult.config;
        console.log(`✅ Switched to ${currentProvider?.toUpperCase()}\n`);
      }
      continue;
    }

    if (prompt.toLowerCase() === 'files') {
      console.log('\n📁 Project Structure Preview:');
      try {
        const { execSync } = await import('child_process');
        const structure = execSync('find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.rs" -o -name "*.go" -o -name "*.java" | head -20', { encoding: 'utf-8' });
        console.log(structure || 'No common code files found in current directory.');
      } catch (error) {
        console.log('❌ Could not analyze project structure');
      }
      console.log('');
      continue;
    }

    if (prompt.toLowerCase() === 'analyze') {
      console.log('\n🧠 Performing intelligent codebase analysis...');
      try {
        const intelligentAnalysis = await intelligentCodebaseAnalysis(projectContext.workingDirectory);
        const overview = generateCodebaseOverview(intelligentAnalysis);
        
        console.log(overview);
        
        // Also show basic repository stats
        const basicAnalysis = await analyzeRepository(projectContext.workingDirectory, true);
        console.log('\n📊 Additional Repository Statistics:');
        console.log(`   📄 Total Files: ${basicAnalysis.totalFiles}`);
        console.log(`   📏 Total Size: ${Math.round(basicAnalysis.totalSize / 1024)}KB`);
        console.log(`   📦 Dependencies: ${basicAnalysis.dependencies.production.length} production, ${basicAnalysis.dependencies.development.length} dev`);
        
        if (basicAnalysis.potentialIssues.length > 0) {
          console.log('\n⚠️  Potential Issues:');
          basicAnalysis.potentialIssues.forEach(issue => console.log(`   • ${issue}`));
        }
        
        if (basicAnalysis.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          basicAnalysis.recommendations.forEach(rec => console.log(`   • ${rec}`));
        }
        
        console.log('');
      } catch (error) {
        console.log('❌ Could not perform intelligent analysis:', error);
      }
      continue;
    }

    if (!prompt.trim()) continue;

    try {
      // Check if this is a project creation request
      const projectCreationRequest = parseProjectCreationRequest(prompt);
      
      if (projectCreationRequest.shouldCreateProject) {
        console.log('\n🚀 Project creation detected!');
        console.log(`   📂 Type: ${projectCreationRequest.projectType}`);
        console.log(`   📝 Name: ${projectCreationRequest.projectName}`);
        console.log(`   📍 Location: ${projectCreationRequest.location}`);
        
        try {
          const initResult = await initializeProject(
            projectCreationRequest.projectType!,
            projectCreationRequest.projectName!,
            projectCreationRequest.location!,
            {
              installDependencies: true,
              analyzeAfterCreation: true
            }
          );
          
          if (initResult.success) {
            console.log('\n🎉 Project created successfully!');
            console.log('You can now explore the created files or ask me to make modifications.');
          } else {
            console.log('\n❌ Project creation failed:');
            initResult.errors.forEach(error => console.log(`   • ${error}`));
          }
        } catch (error) {
          console.error('❌ Project initialization error:', error);
        }
        
        console.log('\n' + '─'.repeat(50) + '\n');
        continue;
      }
      
      // Find relevant files based on the prompt
      console.log('🔍 Analyzing codebase...');
      const relevantFiles = await findRelevantFiles(prompt, projectContext.workingDirectory);
      
      let contextualInfo = '';
      if (relevantFiles.length > 0) {
        console.log(`📄 Found ${relevantFiles.length} potentially relevant file${relevantFiles.length > 1 ? 's' : ''}:`);
        relevantFiles.forEach((file, index) => {
          const relativePath = file.replace(projectContext.workingDirectory, '.');
          console.log(`   ${index + 1}. ${relativePath}`);
        });
        console.log('');

        // Read content from most relevant files (limit to prevent token overflow)
        for (const file of relevantFiles.slice(0, 3)) {
          try {
            const content = readFileSync(file, 'utf-8');
            const relativePath = file.replace(projectContext.workingDirectory, '.');
            contextualInfo += `\n\n--- File: ${relativePath} ---\n${content.slice(0, 2000)}${content.length > 2000 ? '\n...(truncated)' : ''}`;
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }

      // Get provider and send request with context
      const currentProviderConfig = currentConfig.providers?.[currentProvider];
      if (!currentProviderConfig) {
        throw new Error(`No configuration found for provider '${currentProvider}'. Run: echo config setup`);
      }
      const provider = providerFactory.getProvider(currentProvider, currentProviderConfig);

      console.log('💭 Thinking...\n');
      
      const contextualPrompt = `Project Context:
- Project: ${projectContext.projectName} (${projectContext.projectType})
- Language/Framework: ${projectContext.language || 'Mixed'}${projectContext.framework ? ` with ${projectContext.framework}` : ''}
- Working Directory: ${projectContext.workingDirectory}

User Request: ${prompt}

${contextualInfo ? `Relevant Code Context:${contextualInfo}` : 'No specific files found matching the request. Please provide general guidance for this project type.'}

ADVANCED CAPABILITIES - Professional AI Code Editor:
1. REPOSITORY ANALYSIS: I can analyze entire repositories, detect issues, and provide recommendations
2. PROJECT CREATION: I can create complete projects (React apps, Node.js backends, etc.)
3. MULTI-FILE EDITING: I can edit multiple files simultaneously with batch operations
4. BUILD RESOLUTION: I can detect and fix build issues, dependency problems, and configuration errors

FILE OPERATIONS:
1. EXISTING files: Use "edit [filename]" - I'll show diffs and ask permission
2. NEW files: Use "create [filename]" with complete code
3. PROJECT CREATION: I can create entire project structures with "create [type] app"

PROFESSIONAL WORKFLOW:
- Repository-wide analysis and understanding
- Intelligent file discovery and context building
- Batch operations with preview and approval
- Build and dependency management
- Industry best practices and recommendations

This system works like a professional AI code editor. Be specific about requirements and I'll handle complex operations professionally.`;

      const messages = [{ role: 'user' as const, content: contextualPrompt }];
      
      let aiResponse = '';
      for await (const chunk of provider.chat(messages, { stream: true })) {
        process.stdout.write(chunk);
        aiResponse += chunk;
      }
      
      // Check if AI response contains file operations and execute them Claude Code style
      const editAnalysis = parseEditInstructions(aiResponse);
      const legacyOperations = parseFileOperationFromAI(aiResponse, projectContext.workingDirectory);
      
      if (editAnalysis.hasFileOperations || legacyOperations.length > 0) {
        console.log('\n');
        
        if (editAnalysis.targetFile) {
          // Claude Code style edit - for existing files
          let targetPath = join(projectContext.workingDirectory, editAnalysis.targetFile);
          
          // If file not found in root, check if it exists in any of the relevant files found
          if (!existsSync(targetPath) && relevantFiles.length > 0) {
            const matchingFile = relevantFiles.find(file => 
              file.endsWith('/' + editAnalysis.targetFile!) || file.endsWith(editAnalysis.targetFile!)
            );
            if (matchingFile) {
              targetPath = matchingFile;
            }
          }
          
          try {
            const editResult = await handleClaudeStyleEdit(
              targetPath,
              editAnalysis.instructions,
              editAnalysis.newContent
            );
            
            if (!editResult.approved) {
              console.log('📝 Edit operation was cancelled by user');
            }
          } catch (error) {
            console.error('❌ Error during file operation:', error instanceof Error ? error.message : 'Unknown error');
          }
        } else if (legacyOperations.length > 0) {
          // Legacy file creation - for new files
          console.log('🔧 Performing file operations...\n');
          
          for (const operation of legacyOperations) {
            if (operation.success) {
              console.log(`✅ ${operation.message}`);
            } else {
              console.log(`❌ ${operation.message}`);
            }
          }
        }
      }
      
      console.log('\n' + '─'.repeat(50) + '\n');

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('');
    }
  }

  return showMainMenu();
}

async function showAgentsMenu(): Promise<void> {
  console.log('\n🤖 Available Intelligent Agents:\n');
  
  const agentManager = new EchoAgentManager();
  // Register available agents
  agentManager.registerAgent(new CodeOptimizerAgent());
  agentManager.registerAgent(new PromptEnhancerAgent());
  agentManager.registerAgent(new AutoDocumentationAgent());
  
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

async function showDocumentationMenu(): Promise<void> {
  console.log('\n📚 Smart Auto-Documentation Generator\n');
  console.log('💡 Generate comprehensive, developer-friendly documentation instantly!');
  console.log('🔄 AI-maintained documentation that stays up-to-date automatically.\n');

  const projectContext = getProjectContext();
  console.log(`📁 Project: ${projectContext.projectName}`);
  console.log(`📍 Location: ${projectContext.workingDirectory}\n`);

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What type of documentation would you like to generate?',
      choices: [
        { name: '📖 Complete Project Documentation', value: 'complete' },
        { name: '🔌 API Reference Documentation', value: 'api' },
        { name: '🚀 Getting Started Guide', value: 'getting-started' },
        { name: '🏗️ Architecture Documentation', value: 'architecture' },
        { name: '⚙️ Custom Documentation Setup', value: 'custom' },
        { name: '↩️  Back to main menu', value: 'back' },
      ],
    },
  ]);

  if (action === 'back') {
    return showMainMenu();
  }

  try {
    const config = await loadConfig();
    const defaultProvider = getDefaultProvider(config);
    
    if (!defaultProvider) {
      console.log('❌ No providers configured. Please set up a provider first.');
      return showMainMenu();
    }

    const providerConfig = config.providers?.[defaultProvider];
    if (!providerConfig || !providerConfig.apiKey) {
      console.log(`❌ Configuration missing for provider '${defaultProvider}'. Please reconfigure.`);
      return showMainMenu();
    }

    console.log('\n🤖 Analyzing codebase with Smart Auto-Documentation Agent...\n');
    
    // Generate documentation based on user choice
    let docConfig: Partial<DocumentationConfig> = {};
    let docType = 'complete';
    
    switch (action) {
      case 'complete':
        docType = 'Complete Project Documentation';
        docConfig = {
          includeCodeExamples: true,
          includeAPIReference: true,
          includeArchitecture: true,
          sections: ['overview', 'getting-started', 'api-reference', 'examples', 'architecture', 'contributing']
        };
        break;
      case 'api':
        docType = 'API Reference Documentation';
        docConfig = {
          includeAPIReference: true,
          includeCodeExamples: true,
          sections: ['api-reference', 'authentication', 'examples', 'errors']
        };
        break;
      case 'getting-started':
        docType = 'Getting Started Guide';
        docConfig = {
          includeCodeExamples: true,
          sections: ['getting-started', 'quick-start', 'examples', 'troubleshooting']
        };
        break;
      case 'architecture':
        docType = 'Architecture Documentation';
        docConfig = {
          includeArchitecture: true,
          sections: ['architecture', 'components', 'data-flow', 'deployment']
        };
        break;
      case 'custom':
        // Let user customize the documentation
        const customChoices = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'sections',
            message: 'Select sections to include:',
            choices: [
              { name: 'Project Overview', value: 'overview', checked: true },
              { name: 'Getting Started Guide', value: 'getting-started', checked: true },
              { name: 'API Reference', value: 'api-reference' },
              { name: 'Code Examples', value: 'examples', checked: true },
              { name: 'Architecture Documentation', value: 'architecture' },
              { name: 'Contributing Guidelines', value: 'contributing' },
              { name: 'Troubleshooting', value: 'troubleshooting' },
            ],
          },
          {
            type: 'confirm',
            name: 'includeCodeExamples',
            message: 'Include code examples throughout?',
            default: true,
          },
          {
            type: 'confirm',
            name: 'includeAPIReference',
            message: 'Generate detailed API reference?',
            default: true,
          }
        ]);
        
        docConfig = customChoices;
        docType = 'Custom Documentation';
        break;
    }

    console.log(`📝 Generating ${docType}...`);
    console.log('⏳ This may take a moment for comprehensive analysis...\n');

    // Generate the documentation using AI
    const agentManager = new EchoAgentManager();
    agentManager.registerAgent(new AutoDocumentationAgent());
    
    const docPrompt = `Generate comprehensive ${docType.toLowerCase()} for this project.

Project Details:
- Name: ${projectContext.projectName}
- Type: ${projectContext.projectType}
- Language: ${projectContext.language || 'Mixed'}
- Framework: ${projectContext.framework || 'None detected'}

Requirements:
- Developer-friendly and easy to understand
- Include practical examples and use cases
- Focus on getting developers productive quickly
- Use modern documentation best practices
- Include troubleshooting and common issues
- Make it comprehensive but not overwhelming

Documentation Type: ${docType}
Sections to include: ${docConfig.sections?.join(', ') || 'All standard sections'}
Include code examples: ${docConfig.includeCodeExamples ? 'Yes' : 'No'}
Include API reference: ${docConfig.includeAPIReference ? 'Yes' : 'No'}
Include architecture docs: ${docConfig.includeArchitecture ? 'Yes' : 'No'}

Please generate professional documentation that solves the problem of outdated, incomplete documentation. Make it so good that developers actually want to read it!`;

    // Use the documentation agent to optimize the prompt
    const context = { input: docPrompt, provider: defaultProvider, model: 'default', userPreferences: undefined };
    const optimized = await agentManager.optimizeWithAgent(context);
    
    if (optimized.metadata.agentUsed === 'AutoDocumentationAgent') {
      console.log(`✨ Applied ${optimized.metadata.agentUsed} optimization (confidence: ${Math.round(optimized.confidence * 100)}%)`);
      console.log(`🎯 Documentation type detected: ${optimized.metadata.documentationType}`);
    }

    // Generate the documentation using AI
    const provider = providerFactory.getProvider(defaultProvider, providerConfig);
    const messages = [{ role: 'user' as const, content: optimized.optimizedPrompt }];
    
    console.log('💭 AI is crafting your documentation...\n');
    
    let generatedDoc = '';
    for await (const chunk of provider.chat(messages, { stream: true })) {
      process.stdout.write(chunk);
      generatedDoc += chunk;
    }
    
    console.log('\n\n📄 Documentation generated successfully!\n');
    
    // Ask if user wants to save the documentation
    const { saveDoc } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveDoc',
        message: 'Would you like to save this documentation to files?',
        default: true,
      },
    ]);

    if (saveDoc) {
      try {
        // Generate and save documentation files
        const documentation = await generateProjectDocumentation(projectContext.workingDirectory, docConfig);
        
        // Save the main documentation
        const fs = await import('fs');
        const path = await import('path');
        
        // Create docs directory if it doesn't exist
        const docsDir = path.join(projectContext.workingDirectory, 'docs');
        if (!fs.existsSync(docsDir)) {
          fs.mkdirSync(docsDir, { recursive: true });
        }
        
        // Save different documentation files
        const docFileName = action === 'complete' ? 'README.md' : `${action}-documentation.md`;
        const docPath = path.join(docsDir, docFileName);
        
        fs.writeFileSync(docPath, generatedDoc);
        console.log(`✅ Documentation saved to: ${docPath}`);
        
        // Save additional files if generated
        if (documentation.apiReference && docConfig.includeAPIReference) {
          fs.writeFileSync(path.join(docsDir, 'api-reference.md'), documentation.apiReference);
          console.log(`✅ API Reference saved to: ${path.join(docsDir, 'api-reference.md')}`);
        }
        
        if (documentation.gettingStarted) {
          fs.writeFileSync(path.join(docsDir, 'getting-started.md'), documentation.gettingStarted);
          console.log(`✅ Getting Started guide saved to: ${path.join(docsDir, 'getting-started.md')}`);
        }
        
        if (documentation.architecture && docConfig.includeArchitecture) {
          fs.writeFileSync(path.join(docsDir, 'architecture.md'), documentation.architecture);
          console.log(`✅ Architecture docs saved to: ${path.join(docsDir, 'architecture.md')}`);
        }
        
        console.log('\n🎉 Smart Auto-Documentation complete!');
        console.log('💡 Your documentation is now ready and can be auto-maintained as your code evolves.');
        
      } catch (error) {
        console.error('❌ Error saving documentation:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    console.log('\n' + '─'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error generating documentation:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Ask if user wants to generate more documentation or return to main menu
  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: '📚 Generate more documentation', value: 'more' },
        { name: '↩️  Return to main menu', value: 'main' },
      ],
    },
  ]);

  if (nextAction === 'more') {
    return showDocumentationMenu();
  } else {
    return showMainMenu();
  }
}

async function showConfigMenu(): Promise<void> {
  // Show current provider at the top
  const config = await loadConfig().catch(() => null);
  const currentProvider = config ? getDefaultProvider(config) : null;
  
  if (currentProvider && config) {
    const providerConfig = config.providers?.[currentProvider];
    const model = providerConfig?.model || 'default';
    console.log(`\n🤖 Currently Active: ${currentProvider.toUpperCase()} (${model})\n`);
  }
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Configuration options:',
      choices: [
        { name: '🔄 Switch active provider', value: 'switch' },
        { name: '➕ Add new provider', value: 'add' },
        { name: '👀 View all configured providers', value: 'view' },
        { name: '📊 Configure token limits', value: 'limits' },
        { name: '🔊 Configure sound settings', value: 'sound' },
        { name: '📈 View token analytics', value: 'analytics' },
        { name: '🧹 Reset configuration', value: 'reset' },
        { name: '↩️  Back to main menu', value: 'back' },
      ],
    },
  ]);

  switch (action) {
    case 'switch':
      if (!config) {
        console.log('❌ No configuration found. Please set up a provider first.');
        break;
      }
      const switchResult = await switchProvider(config);
      if (switchResult) {
        console.log(`\n✅ Active provider switched to ${switchResult.provider.toUpperCase()}\n`);
      }
      break;
    case 'add':
      await setupProvider();
      break;
    case 'view':
      try {
        const viewConfig = await loadConfig();
        console.log('\n📋 All Configured Providers:\n');
        
        // Show providers in a user-friendly way
        const providers = Object.keys(viewConfig.providers || {});
        const activeProvider = getDefaultProvider(viewConfig);
        
        if (providers.length > 0) {
          console.log('🔧 Available Providers:');
          providers.forEach(provider => {
            const providerConfig = (viewConfig.providers as any)?.[provider];
            if (providerConfig?.apiKey) {
              const maskedKey = providerConfig.apiKey.substring(0, 8) + '***' + providerConfig.apiKey.slice(-4);
              const isActive = provider === activeProvider;
              const status = isActive ? ' ✅ Currently Active' : '';
              console.log(`  • ${provider.toUpperCase()}: ${providerConfig.model || 'default model'} (${maskedKey})${status}`);
            }
          });
          console.log('');
        } else {
          console.log('No providers configured yet.\n');
        }
      } catch (error) {
        console.log('❌ No configuration found');
      }
      break;
    case 'limits':
      await configureTokenLimits();
      break;
    case 'sound':
      await configureSoundSettings();
      break;
    case 'analytics':
      await showTokenAnalytics();
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
    case 'openrouter':
      return [
        { name: '🏆 Claude 3.5 Sonnet (Recommended)', value: 'anthropic/claude-3.5-sonnet' },
        { name: '🤖 GPT-4 Turbo', value: 'openai/gpt-4-turbo' },
        { name: '🦙 Llama 3.1 405B', value: 'meta-llama/llama-3.1-405b-instruct' },
        { name: '🔍 Gemini Pro 1.5', value: 'google/gemini-pro-1.5' },
        { name: '⚡ Mixtral 8x7B', value: 'mistralai/mixtral-8x7b-instruct' },
        { name: '💻 Code Llama 70B', value: 'meta-llama/codellama-70b-instruct' },
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
  
  // Use saved default provider if available and configured
  if (config.defaults?.provider && providers.includes(config.defaults.provider)) {
    return config.defaults.provider;
  }
  
  // Otherwise use first configured provider
  return providers.length > 0 ? providers[0]! : 'claude';
}

async function configureTokenLimits(): Promise<void> {
  console.log('\n📊 Token Limits Configuration\n');
  console.log('💡 Set limits to prevent unexpected costs and usage');
  console.log('⚠️  Leave blank to disable a limit\n');

  const currentConfig = await loadConfig().catch(() => ({} as any));
  const currentLimits = (currentConfig as any).limits || {};

  const limitsConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'daily',
      message: 'Daily token limit:',
      default: currentLimits.daily?.toString() || '',
      validate: (input: string) => {
        if (!input.trim()) return true;
        const num = parseInt(input);
        return !isNaN(num) && num > 0 ? true : 'Please enter a positive number';
      }
    },
    {
      type: 'input',
      name: 'session',
      message: 'Session token limit:',
      default: currentLimits.session?.toString() || '',
      validate: (input: string) => {
        if (!input.trim()) return true;
        const num = parseInt(input);
        return !isNaN(num) && num > 0 ? true : 'Please enter a positive number';
      }
    },
    {
      type: 'input',
      name: 'dailyCost',
      message: 'Daily cost limit ($):',
      default: currentLimits.cost?.daily?.toString() || '',
      validate: (input: string) => {
        if (!input.trim()) return true;
        const num = parseFloat(input);
        return !isNaN(num) && num > 0 ? true : 'Please enter a positive number';
      }
    },
    {
      type: 'input',
      name: 'monthlyCost',
      message: 'Monthly cost limit ($):',
      default: currentLimits.cost?.monthly?.toString() || '',
      validate: (input: string) => {
        if (!input.trim()) return true;
        const num = parseFloat(input);
        return !isNaN(num) && num > 0 ? true : 'Please enter a positive number';
      }
    }
  ]);

  // Build limits object
  const limits: any = {};
  
  if (limitsConfig.daily.trim()) {
    limits.daily = parseInt(limitsConfig.daily);
  }
  
  if (limitsConfig.session.trim()) {
    limits.session = parseInt(limitsConfig.session);
  }
  
  if (limitsConfig.dailyCost.trim() || limitsConfig.monthlyCost.trim()) {
    limits.cost = {};
    if (limitsConfig.dailyCost.trim()) {
      limits.cost.daily = parseFloat(limitsConfig.dailyCost);
    }
    if (limitsConfig.monthlyCost.trim()) {
      limits.cost.monthly = parseFloat(limitsConfig.monthlyCost);
    }
  }

  try {
    const updatedConfig = { ...currentConfig, limits };
    await saveConfig(updatedConfig);
    
    console.log('\n✅ Token limits updated successfully!');
    if (limits.daily) console.log(`📅 Daily limit: ${limits.daily.toLocaleString()} tokens`);
    if (limits.session) console.log(`🔄 Session limit: ${limits.session.toLocaleString()} tokens`);
    if (limits.cost?.daily) console.log(`💰 Daily cost limit: $${limits.cost.daily}`);
    if (limits.cost?.monthly) console.log(`💰 Monthly cost limit: $${limits.cost.monthly}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to save limits configuration:', error);
  }
}

async function configureSoundSettings(): Promise<void> {
  console.log('\n🔊 Sound Settings Configuration\n');
  console.log('🎵 Configure Echo sound notifications and alerts');
  console.log('💡 Echo will beep when asking for permission (true to the name!)\n');

  const currentConfig = await loadConfig().catch(() => ({} as any));
  const currentSound = (currentConfig as any).sound || {
    enabled: true,
    volume: 50,
    permissionPrompts: true,
    tokenWarnings: true,
    completionNotifications: false
  };

  const soundConfig = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable sound notifications?',
      default: currentSound.enabled
    },
    {
      type: 'input',
      name: 'volume',
      message: 'Volume level (0-100):',
      default: currentSound.volume.toString(),
      when: (answers: any) => answers.enabled,
      validate: (input: string) => {
        const num = parseInt(input);
        return !isNaN(num) && num >= 0 && num <= 100 ? true : 'Please enter a number between 0-100';
      }
    },
    {
      type: 'confirm',
      name: 'permissionPrompts',
      message: 'Play sound when Echo asks for permission?',
      default: currentSound.permissionPrompts,
      when: (answers: any) => answers.enabled
    },
    {
      type: 'confirm',
      name: 'tokenWarnings',
      message: 'Play sound for token limit warnings?',
      default: currentSound.tokenWarnings,
      when: (answers: any) => answers.enabled
    },
    {
      type: 'confirm',
      name: 'completionNotifications',
      message: 'Play sound when operations complete?',
      default: currentSound.completionNotifications,
      when: (answers: any) => answers.enabled
    }
  ]);

  // Test sound if enabled
  if (soundConfig.enabled) {
    const { testSound } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'testSound',
        message: 'Test sound settings now?',
        default: true
      }
    ]);

    if (testSound) {
      echoSound.updateConfig({
        enabled: soundConfig.enabled,
        volume: parseInt(soundConfig.volume || '50'),
        pattern: 'permission'
      });
      await echoSound.testSound();
    }
  }

  // Build sound config
  const sound = {
    enabled: soundConfig.enabled,
    volume: soundConfig.enabled ? parseInt(soundConfig.volume || '50') : 0,
    permissionPrompts: soundConfig.permissionPrompts || false,
    tokenWarnings: soundConfig.tokenWarnings || false,
    completionNotifications: soundConfig.completionNotifications || false
  };

  try {
    const updatedConfig = { ...currentConfig, sound };
    await saveConfig(updatedConfig);
    
    console.log('\n✅ Sound settings updated successfully!');
    console.log(`🔊 Sounds ${sound.enabled ? 'enabled' : 'disabled'}`);
    if (sound.enabled) {
      console.log(`🔉 Volume: ${sound.volume}%`);
      console.log(`🔔 Permission prompts: ${sound.permissionPrompts ? 'Yes' : 'No'}`);
      console.log(`⚠️ Token warnings: ${sound.tokenWarnings ? 'Yes' : 'No'}`);
      console.log(`✅ Completion sounds: ${sound.completionNotifications ? 'Yes' : 'No'}`);
    }
    console.log('');
    
    // Update global sound manager
    echoSound.updateConfig(sound);
    permissionManager.setSoundEnabled(sound.enabled && sound.permissionPrompts);
    
  } catch (error) {
    console.error('❌ Failed to save sound configuration:', error);
  }
}

async function showTokenAnalytics(): Promise<void> {
  console.log('\n📈 Token Usage Analytics\n');
  
  const analytics = tokenTracker.getAnalytics();
  
  console.log('📊 Overall Statistics:');
  console.log(`   Total tokens used: ${analytics.totalTokensUsed.toLocaleString()}`);
  console.log(`   Estimated total cost: ~$${analytics.totalCost.toFixed(2)}`);
  console.log(`   Sessions completed: ${analytics.sessionsCount}`);
  console.log(`   Last reset: ${new Date(analytics.lastReset).toLocaleDateString()}`);
  
  console.log('\n📅 Daily Usage (Last 7 days):');
  const sortedDays = Object.entries(analytics.dailyUsage)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7);
  
  if (sortedDays.length > 0) {
    sortedDays.forEach(([date, tokens]) => {
      const isToday = date === new Date().toISOString().split('T')[0];
      console.log(`   ${date}${isToday ? ' (today)' : ''}: ${tokens.toLocaleString()} tokens`);
    });
  } else {
    console.log('   No usage data available');
  }
  
  console.log('\n🤖 Provider Usage:');
  if (Object.keys(analytics.providerUsage).length > 0) {
    Object.entries(analytics.providerUsage)
      .sort(([,a], [,b]) => b - a)
      .forEach(([provider, tokens]) => {
        const percentage = ((tokens / analytics.totalTokensUsed) * 100).toFixed(1);
        console.log(`   ${provider.toUpperCase()}: ${tokens.toLocaleString()} tokens (${percentage}%)`);
      });
  } else {
    console.log('   No provider data available');
  }

  console.log('\n💡 Options:');
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔄 Refresh analytics', value: 'refresh' },
        { name: '🧹 Reset all analytics', value: 'reset' },
        { name: '↩️  Back to config menu', value: 'back' },
      ],
    },
  ]);

  if (action === 'refresh') {
    return showTokenAnalytics();
  } else if (action === 'reset') {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '⚠️  Are you sure you want to reset all token analytics?',
        default: false,
      },
    ]);
    
    if (confirm) {
      tokenTracker.resetAnalytics();
      console.log('✅ Token analytics reset successfully!\n');
    }
  }
}