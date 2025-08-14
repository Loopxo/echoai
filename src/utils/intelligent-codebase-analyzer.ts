import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { analyzeRepository, RepoAnalysis } from './repo-analyzer.js';

export interface IntelligentAnalysis {
  summary: string;
  keyFeatures: string[];
  architecture: string;
  techStack: string[];
  mainPurpose: string;
  confidence: number;
  detailedBreakdown: {
    coreComponents: string[];
    dependencies: string[];
    buildSystem: string;
    testingApproach: string;
  };
}

export async function intelligentCodebaseAnalysis(rootPath: string): Promise<IntelligentAnalysis> {
  console.log('🧠 Performing intelligent codebase analysis...');
  
  // Get basic repository analysis first
  const repoAnalysis = await analyzeRepository(rootPath, true);
  
  // Perform deep semantic analysis
  const semanticAnalysis = await performSemanticAnalysis(rootPath, repoAnalysis);
  
  // Generate intelligent summary
  const intelligentSummary = generateIntelligentSummary(repoAnalysis, semanticAnalysis);
  
  return intelligentSummary;
}

async function performSemanticAnalysis(rootPath: string, repoAnalysis: RepoAnalysis) {
  const semanticData = {
    hasAgentSystem: false,
    hasMultiProvider: false,
    hasCLI: false,
    hasVSCodeExtension: false,
    hasAdvancedFileOps: false,
    hasConfigSystem: false,
    aiProviders: [] as string[],
    coreModules: [] as string[],
    architecturePatterns: [] as string[]
  };

  // Analyze source files for semantic meaning
  for (const sourceFile of repoAnalysis.structure.source) {
    const content = await readFileContent(sourceFile.path);
    if (!content) continue;

    // Detect agent system
    if (content.includes('Agent') && content.includes('manager')) {
      semanticData.hasAgentSystem = true;
    }

    // Detect AI providers
    const providerMatches = content.match(/(claude|openai|gemini|groq|meta|anthropic)/gi);
    if (providerMatches) {
      semanticData.hasMultiProvider = true;
      semanticData.aiProviders.push(...providerMatches.map(p => p.toLowerCase()));
    }

    // Detect CLI patterns
    if (content.includes('commander') || content.includes('inquirer') || content.includes('process.argv')) {
      semanticData.hasCLI = true;
    }

    // Detect VS Code extension
    if (content.includes('vscode') || sourceFile.path.includes('extension')) {
      semanticData.hasVSCodeExtension = true;
    }

    // Detect advanced file operations
    if (content.includes('readFile') && content.includes('writeFile') && content.includes('diff')) {
      semanticData.hasAdvancedFileOps = true;
    }

    // Detect configuration system
    if (content.includes('config') && (content.includes('load') || content.includes('save'))) {
      semanticData.hasConfigSystem = true;
    }

    // Identify core modules
    if (sourceFile.relativePath.includes('core/') || sourceFile.relativePath.includes('manager')) {
      semanticData.coreModules.push(sourceFile.relativePath);
    }
  }

  // Detect architecture patterns
  if (semanticData.hasAgentSystem) {
    semanticData.architecturePatterns.push('Agent-based Architecture');
  }
  if (semanticData.hasMultiProvider) {
    semanticData.architecturePatterns.push('Provider Pattern');
  }
  if (semanticData.hasCLI) {
    semanticData.architecturePatterns.push('Command-line Interface');
  }
  if (semanticData.hasConfigSystem) {
    semanticData.architecturePatterns.push('Configuration Management');
  }

  return semanticData;
}

function generateIntelligentSummary(repoAnalysis: RepoAnalysis, semanticData: any): IntelligentAnalysis {
  let confidence = 0.7; // Base confidence
  let mainPurpose = 'Software Development Tool';
  let summary = '';
  let keyFeatures: string[] = [];
  let architecture = 'Modular Architecture';
  let techStack: string[] = [];

  // Determine main purpose and confidence based on analysis
  if (repoAnalysis.projectType === 'AI CLI Tool') {
    confidence = 0.95;
    mainPurpose = 'AI-Powered Development CLI Tool';
    
    if (semanticData.hasAgentSystem && semanticData.hasMultiProvider) {
      summary = `This is Echo AI, a sophisticated AI-powered command-line interface and development studio. It features ${semanticData.aiProviders.length || 'multiple'} AI provider integrations, an intelligent agent system for task optimization, and advanced code analysis capabilities. The tool serves as a comprehensive AI assistant for developers, offering multi-provider AI access, intelligent agents, and professional-grade file operations.`;
      
      keyFeatures = [
        `Multi-provider AI integration (${[...new Set(semanticData.aiProviders)].join(', ')})`,
        'Intelligent agent system for task optimization',
        'Advanced codebase analysis and editing',
        'Interactive CLI with professional workflows',
        'VS Code extension integration',
        'Configuration management system'
      ];
      
      architecture = 'Agent-based AI CLI Architecture with Provider Abstraction';
    }
  } else if (repoAnalysis.projectType.includes('React')) {
    mainPurpose = 'React Web Application';
    summary = `A React-based web application built with modern JavaScript/TypeScript. The project uses ${repoAnalysis.framework || 'React'} and includes ${repoAnalysis.totalFiles} files with a total size of ${Math.round(repoAnalysis.totalSize / 1024)}KB.`;
  } else if (repoAnalysis.projectType.includes('Node.js')) {
    mainPurpose = 'Node.js Backend Service';
    summary = `A Node.js backend application with ${repoAnalysis.totalFiles} files. The project appears to be focused on server-side development with ${repoAnalysis.language} as the primary language.`;
  }

  // Build tech stack
  techStack = [repoAnalysis.language];
  if (repoAnalysis.framework) techStack.push(repoAnalysis.framework);
  if (repoAnalysis.dependencies.production.length > 0) {
    const majorDeps = repoAnalysis.dependencies.production.filter(dep => 
      ['react', 'vue', 'angular', 'express', 'fastify', 'commander', 'inquirer'].includes(dep)
    );
    techStack.push(...majorDeps);
  }

  // Detailed breakdown
  const detailedBreakdown = {
    coreComponents: semanticData.coreModules.length > 0 ? semanticData.coreModules : ['Main application logic', 'Configuration system'],
    dependencies: repoAnalysis.dependencies.production.slice(0, 10), // Top 10 dependencies
    buildSystem: repoAnalysis.buildCommands.length > 0 ? repoAnalysis.buildCommands[0] : 'Standard build process',
    testingApproach: repoAnalysis.testCommands.length > 0 ? 'Automated testing configured' : 'No testing framework detected'
  };

  return {
    summary,
    keyFeatures,
    architecture,
    techStack: [...new Set(techStack)], // Remove duplicates
    mainPurpose,
    confidence,
    detailedBreakdown
  };
}

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    if (extname(filePath).match(/\.(ts|js|json|md|py|rs|go)$/)) {
      return readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function generateCodebaseOverview(analysis: IntelligentAnalysis): string {
  return `
🔮 **${analysis.mainPurpose}**
${analysis.summary}

**🏗️ Architecture:** ${analysis.architecture}

**✨ Key Features:**
${analysis.keyFeatures.map(feature => `  • ${feature}`).join('\n')}

**🛠️ Tech Stack:** ${analysis.techStack.join(', ')}

**📊 Analysis Confidence:** ${Math.round(analysis.confidence * 100)}%

**🔧 Core Components:**
${analysis.detailedBreakdown.coreComponents.map(comp => `  • ${comp}`).join('\n')}

**📦 Build System:** ${analysis.detailedBreakdown.buildSystem}
**🧪 Testing:** ${analysis.detailedBreakdown.testingApproach}
`;
}