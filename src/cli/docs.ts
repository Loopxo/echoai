import { Command } from 'commander';
import { generateProjectDocumentation, DocumentationConfig } from '../utils/documentation-generator.js';
import { getProjectContext } from '../utils/project-context.js';
import { loadConfig } from '../config/index.js';
import { providerFactory } from '../providers/factory.js';
import { EchoAgentManager } from '../agents/core/manager.js';
import { AutoDocumentationAgent } from '../agents/specialized/auto-documentation-agent.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const promptWithInquirer = async (questions: any[]) => (await import('inquirer')).default.prompt(questions);

function getDefaultProvider(config: any): string {
  if (!config.providers) return 'claude';
  
  const providers = Object.keys(config.providers).filter(
    key => config.providers[key]?.apiKey
  );
  
  return providers.length > 0 ? providers[0]! : 'claude';
}

export const docsCommand = new Command('docs')
  .description('📚 Generate smart auto-documentation for APIs & SaaS')
  .option('-t, --type <type>', 'Documentation type (complete|api|getting-started|architecture)', 'complete')
  .option('-o, --output <path>', 'Output directory for documentation', './docs')
  .option('--no-examples', 'Exclude code examples')
  .option('--no-api', 'Exclude API reference')
  .option('--no-architecture', 'Exclude architecture documentation')
  .option('-i, --interactive', 'Interactive mode for custom configuration')
  .action(async (options) => {
    console.log('📚 EchoAI - Smart Auto-Documentation Generator\n');
    console.log('🎯 Solving the problem of outdated, incomplete documentation');
    console.log('🔄 Generate developer-friendly docs that stay up-to-date\n');

    const projectContext = getProjectContext();
    console.log(`📁 Analyzing: ${projectContext.projectName}`);
    console.log(`📍 Location: ${projectContext.workingDirectory}\n`);

    try {
      // Load configuration
      const config = await loadConfig();
      const defaultProvider = getDefaultProvider(config);
      
      if (!defaultProvider) {
        console.log('❌ No AI providers configured. Run: echoai config setup');
        process.exit(1);
      }

      const providerConfig = config.providers?.[defaultProvider];
      if (!providerConfig || !providerConfig.apiKey) {
        console.log(`❌ Configuration missing for provider '${defaultProvider}'. Run: echoai config setup`);
        process.exit(1);
      }

      // Configure documentation generation
      let docConfig: Partial<DocumentationConfig> = {
        outputPath: options.output,
        includeCodeExamples: options.examples !== false,
        includeAPIReference: options.api !== false,
        includeArchitecture: options.architecture !== false,
        format: 'markdown' as const,
        autoUpdate: true
      };

      let docType = 'Complete Project Documentation';

      // Interactive mode or handle different documentation types
      if (options.interactive) {
        const interactiveConfig = await promptWithInquirer([
          {
            type: 'list',
            name: 'type',
            message: 'What type of documentation would you like to generate?',
            choices: [
              { name: '📖 Complete Project Documentation', value: 'complete' },
              { name: '🔌 API Reference Documentation', value: 'api' },
              { name: '🚀 Getting Started Guide', value: 'getting-started' },
              { name: '🏗️ Architecture Documentation', value: 'architecture' },
              { name: '⚙️ Custom Configuration', value: 'custom' },
            ],
            default: 'complete'
          }
        ]);

        options.type = interactiveConfig.type;

        if (interactiveConfig.type === 'custom') {
          const customConfig = await promptWithInquirer([
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
              message: 'Include practical code examples?',
              default: true,
            },
            {
              type: 'confirm',
              name: 'includeAPIReference',
              message: 'Generate detailed API reference?',
              default: true,
            },
            {
              type: 'confirm',
              name: 'includeArchitecture',
              message: 'Include architecture documentation?',
              default: true,
            },
            {
              type: 'input',
              name: 'outputPath',
              message: 'Output directory:',
              default: './docs'
            }
          ]);

          docConfig = { ...docConfig, ...customConfig };
          docType = 'Custom Documentation';
        }
      }

      // Set documentation type and configuration
      switch (options.type) {
        case 'complete':
          docType = 'Complete Project Documentation';
          docConfig.sections = ['overview', 'getting-started', 'api-reference', 'examples', 'architecture', 'contributing'];
          break;
        case 'api':
          docType = 'API Reference Documentation';
          docConfig = {
            ...docConfig,
            includeAPIReference: true,
            sections: ['api-reference', 'authentication', 'examples', 'errors']
          };
          break;
        case 'getting-started':
          docType = 'Getting Started Guide';
          docConfig.sections = ['getting-started', 'quick-start', 'examples', 'troubleshooting'];
          break;
        case 'architecture':
          docType = 'Architecture Documentation';
          docConfig = {
            ...docConfig,
            includeArchitecture: true,
            sections: ['architecture', 'components', 'data-flow', 'deployment']
          };
          break;
      }

      console.log(`📝 Generating ${docType}...`);
      console.log('🤖 Using Smart Auto-Documentation Agent for optimal results\n');

      // Generate documentation using AI
      const agentManager = new EchoAgentManager();
      agentManager.registerAgent(new AutoDocumentationAgent());
      
      const docPrompt = `Generate comprehensive ${docType.toLowerCase()} for this project.

Project Details:
- Name: ${projectContext.projectName}
- Type: ${projectContext.projectType}
- Language: ${projectContext.language || 'Mixed'}
- Framework: ${projectContext.framework || 'None detected'}

Requirements:
- Solve the problem of outdated, incomplete documentation
- Make it developer-friendly and easy to understand
- Include practical examples that developers can copy-paste
- Focus on getting developers productive quickly
- Use modern documentation best practices
- Include troubleshooting for common issues
- Design for auto-maintenance and updates

Documentation Type: ${docType}
Sections: ${docConfig.sections?.join(', ') || 'All standard sections'}
Include examples: ${docConfig.includeCodeExamples ? 'Yes' : 'No'}
Include API docs: ${docConfig.includeAPIReference ? 'Yes' : 'No'}
Include architecture: ${docConfig.includeArchitecture ? 'Yes' : 'No'}

Generate documentation so good that developers actually want to read it!`;

      // Optimize prompt with documentation agent
      const context = { input: docPrompt, provider: defaultProvider, model: 'default', userPreferences: undefined };
      const optimized = await agentManager.optimizeWithAgent(context);
      
      if (optimized.metadata.agentUsed === 'AutoDocumentationAgent') {
        console.log(`✨ Applied ${optimized.metadata.agentUsed} optimization`);
        console.log(`🎯 Documentation type: ${optimized.metadata.documentationType}`);
        console.log(`📊 Confidence: ${Math.round(optimized.confidence * 100)}%\n`);
      }

      // Generate with AI
      console.log('💭 AI is crafting your documentation...\n');
      
      const provider = providerFactory.getProvider(defaultProvider, providerConfig);
      const messages = [{ role: 'user' as const, content: optimized.optimizedPrompt }];
      
      let generatedDoc = '';
      for await (const chunk of provider.chat(messages, { stream: true })) {
        process.stdout.write(chunk);
        generatedDoc += chunk;
      }

      console.log('\n\n📄 Documentation generation complete!\n');

      // Save documentation files
      const outputDir = docConfig.outputPath || './docs';
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}`);
      }

      // Generate structured documentation files
      const documentation = await generateProjectDocumentation(projectContext.workingDirectory, docConfig);

      // Save main documentation
      const mainDocFile = options.type === 'complete' ? 'README.md' : `${options.type}-documentation.md`;
      const mainDocPath = join(outputDir, mainDocFile);
      writeFileSync(mainDocPath, generatedDoc);
      console.log(`✅ Main documentation: ${mainDocPath}`);

      // Save additional documentation files
      if (documentation.apiReference && docConfig.includeAPIReference) {
        const apiPath = join(outputDir, 'api-reference.md');
        writeFileSync(apiPath, documentation.apiReference);
        console.log(`✅ API Reference: ${apiPath}`);
      }

      if (documentation.gettingStarted) {
        const gettingStartedPath = join(outputDir, 'getting-started.md');
        writeFileSync(gettingStartedPath, documentation.gettingStarted);
        console.log(`✅ Getting Started: ${gettingStartedPath}`);
      }

      if (documentation.architecture && docConfig.includeArchitecture) {
        const archPath = join(outputDir, 'architecture.md');
        writeFileSync(archPath, documentation.architecture);
        console.log(`✅ Architecture: ${archPath}`);
      }

      // Summary
      console.log('\n🎉 Smart Auto-Documentation Complete!');
      console.log(`📊 Generated ${documentation.metadata.totalSections} documentation sections`);
      console.log(`🤖 Analysis confidence: ${Math.round(documentation.metadata.confidence * 100)}%`);
      console.log(`📅 Generated: ${documentation.metadata.generatedAt.split('T')[0]}`);
      console.log(`📁 Output directory: ${outputDir}`);
      
      console.log('\n💡 Your documentation is now:');
      console.log('  • Developer-friendly and comprehensive');
      console.log('  • Designed for easy maintenance and updates');
      console.log('  • Structured for programmatic improvements');
      console.log('  • Ready to keep your team productive!\n');

    } catch (error) {
      console.error('❌ Documentation generation failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('\n💡 Troubleshooting:');
      console.log('  • Ensure you have an AI provider configured: echoai config setup');
      console.log('  • Check your API key is valid and has sufficient credits');
      console.log('  • Verify you have write permissions to the output directory');
      process.exit(1);
    }
  });

// Additional subcommands for specialized documentation
docsCommand
  .command('api')
  .description('🔌 Generate API reference documentation')
  .option('-o, --output <path>', 'Output path', './docs/api-reference.md')
  .action(async (options) => {
    // Shortcut for API documentation
    await docsCommand.parseAsync(['docs', '--type', 'api', '--output', options.output], { from: 'user' });
  });

docsCommand
  .command('getting-started')
  .description('🚀 Generate getting started guide')
  .option('-o, --output <path>', 'Output path', './docs/getting-started.md')
  .action(async (options) => {
    // Shortcut for getting started guide
    await docsCommand.parseAsync(['docs', '--type', 'getting-started', '--output', options.output], { from: 'user' });
  });

docsCommand
  .command('architecture')
  .description('🏗️ Generate architecture documentation')
  .option('-o, --output <path>', 'Output path', './docs/architecture.md')
  .action(async (options) => {
    // Shortcut for architecture documentation
    await docsCommand.parseAsync(['docs', '--type', 'architecture', '--output', options.output], { from: 'user' });
  });
