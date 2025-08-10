import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '../config/index.js';
import { providerFactory } from '../providers/factory.js';
import { EchoAgentManager } from '../agents/core/manager.js';
import { CodeOptimizerAgent } from '../agents/specialized/code-optimizer.js';
import { PromptEnhancerAgent } from '../agents/optimization/prompt-enhancer.js';
import { getProjectContext, findRelevantFiles } from '../utils/project-context.js';
import { parseFileOperationFromAI } from '../utils/file-operations.js';
import { handleClaudeStyleEdit, parseEditInstructions } from '../utils/claude-style-editor.js';
import { resetSession } from '../utils/session-state.js';
import { analyzeRepository } from '../utils/repo-analyzer.js';
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
      console.log(`✨ Ready to go! You have ${providerCount} provider${providerCount > 1 ? 's' : ''} configured.\n`);
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
      const selectedProvider = optimized.suggestedProvider || defaultProvider;
      const selectedProviderConfig = config.providers?.[selectedProvider];
      
      if (!selectedProviderConfig) {
        throw new Error(`No configuration found for provider '${selectedProvider}'. Run: echo config setup`);
      }
      
      const provider = providerFactory.getProvider(selectedProvider, selectedProviderConfig);

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
  // Reset session state when starting a new code editing session
  resetSession();
  
  // Get project context like Claude Code
  const projectContext = getProjectContext();
  
  console.log(`\n📁 Working on: ${projectContext.projectName}`);
  console.log(`📍 Location: ${projectContext.workingDirectory}`);
  console.log(`🏗️  Project: ${projectContext.projectType}${projectContext.framework ? ` (${projectContext.framework})` : ''}`);
  console.log(`📊 Files: ${projectContext.filesCount} ${projectContext.gitRepo ? '• Git Repository' : ''}\n`);

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

  console.log('💡 Tip: I can analyze code, edit files, create entire projects, fix build issues, and more!');
  console.log('💡 Commands: "exit" (return to menu) | "files" (show structure) | "analyze" (deep analysis)');
  console.log('💡 Try: "create react todo app" or "analyze this repository"\n');

  while (true) {
    const { prompt } = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: `🔮 ${projectContext.projectName}:`,
      },
    ]);

    if (prompt.toLowerCase() === 'exit') {
      break;
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
      console.log('\n🔍 Performing deep repository analysis...');
      try {
        const analysis = await analyzeRepository(projectContext.workingDirectory, true);
        
        console.log('\n📊 Repository Analysis Results:');
        console.log(`   📂 Project Type: ${analysis.projectType}`);
        console.log(`   🔤 Primary Language: ${analysis.language}`);
        console.log(`   📄 Total Files: ${analysis.totalFiles}`);
        console.log(`   📏 Total Size: ${Math.round(analysis.totalSize / 1024)}KB`);
        
        if (analysis.dependencies.production.length > 0) {
          console.log(`   📦 Dependencies: ${analysis.dependencies.production.length} production, ${analysis.dependencies.development.length} dev`);
        }
        
        if (analysis.potentialIssues.length > 0) {
          console.log('\n⚠️  Potential Issues:');
          analysis.potentialIssues.forEach(issue => console.log(`   • ${issue}`));
        }
        
        if (analysis.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          analysis.recommendations.forEach(rec => console.log(`   • ${rec}`));
        }
        
        console.log('\n📋 File Structure:');
        console.log(`   📁 Source files: ${analysis.structure.source.length}`);
        console.log(`   ⚙️  Config files: ${analysis.structure.config.length}`);
        console.log(`   🧪 Test files: ${analysis.structure.tests.length}`);
        console.log('');
      } catch (error) {
        console.log('❌ Could not perform deep analysis:', error);
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
      const provider = providerFactory.getProvider(defaultProvider, providerConfig);

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
        
        // Show providers in a user-friendly way
        const providers = Object.keys(config.providers || {});
        if (providers.length > 0) {
          console.log('🔧 Configured Providers:');
          providers.forEach(provider => {
            const providerConfig = (config.providers as any)?.[provider];
            if (providerConfig?.apiKey) {
              const maskedKey = providerConfig.apiKey.substring(0, 8) + '***' + providerConfig.apiKey.slice(-4);
              console.log(`  • ${provider.toUpperCase()}: ${providerConfig.model || 'default model'} (${maskedKey})`);
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
  
  return providers.length > 0 ? providers[0]! : 'claude';
}