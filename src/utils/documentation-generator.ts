import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { analyzeRepository } from './repo-analyzer.js';
import { intelligentCodebaseAnalysis } from './intelligent-codebase-analyzer.js';

export interface DocumentationConfig {
  outputPath: string;
  includeCodeExamples: boolean;
  includeAPIReference: boolean;
  includeArchitecture: boolean;
  format: 'markdown' | 'html' | 'json';
  sections: string[];
  autoUpdate: boolean;
}

export interface GeneratedDocumentation {
  mainDoc: string;
  apiReference?: string;
  gettingStarted?: string;
  architecture?: string;
  changelog?: string;
  metadata: {
    generatedAt: string;
    version: string;
    confidence: number;
    totalSections: number;
  };
}

export async function generateProjectDocumentation(
  projectPath: string, 
  config: Partial<DocumentationConfig> = {}
): Promise<GeneratedDocumentation> {
  console.log('📚 Generating smart auto-documentation...');

  const fullConfig: DocumentationConfig = {
    outputPath: join(projectPath, 'docs'),
    includeCodeExamples: true,
    includeAPIReference: true,
    includeArchitecture: true,
    format: 'markdown',
    sections: ['overview', 'getting-started', 'api-reference', 'examples', 'architecture'],
    autoUpdate: true,
    ...config
  };

  // Analyze the project first
  const repoAnalysis = await analyzeRepository(projectPath, true);
  const intelligentAnalysis = await intelligentCodebaseAnalysis(projectPath);

  // Generate different documentation sections
  const documentation: GeneratedDocumentation = {
    mainDoc: await generateMainDocumentation(repoAnalysis, intelligentAnalysis, fullConfig),
    metadata: {
      generatedAt: new Date().toISOString(),
      version: getProjectVersion(projectPath),
      confidence: intelligentAnalysis.confidence,
      totalSections: fullConfig.sections.length
    }
  };

  if (fullConfig.includeAPIReference) {
    documentation.apiReference = await generateAPIReference(projectPath, repoAnalysis);
  }

  if (fullConfig.includeArchitecture) {
    documentation.architecture = await generateArchitectureDoc(repoAnalysis, intelligentAnalysis);
  }

  documentation.gettingStarted = await generateGettingStartedGuide(repoAnalysis, intelligentAnalysis);

  return documentation;
}

async function generateMainDocumentation(
  repoAnalysis: any, 
  intelligentAnalysis: any, 
  config: DocumentationConfig
): Promise<string> {
  const projectName = repoAnalysis.projectRoot.split('/').pop() || 'Project';
  
  let doc = `# ${projectName}

${intelligentAnalysis.summary}

## 🚀 Quick Start

Get up and running with ${projectName} in under 5 minutes:

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd ${projectName.toLowerCase()}

# Install dependencies
${getInstallCommand(repoAnalysis)}

# Run the project
${getRunCommand(repoAnalysis)}
\`\`\`

## ✨ Key Features

${intelligentAnalysis.keyFeatures.map((feature: string) => `- ${feature}`).join('\n')}

## 🏗️ Architecture

**Architecture Pattern:** ${intelligentAnalysis.architecture}

**Tech Stack:** ${intelligentAnalysis.techStack.join(', ')}

**Core Components:**
${intelligentAnalysis.detailedBreakdown.coreComponents.map((comp: string) => `- ${comp}`).join('\n')}

## 📦 Installation

### Prerequisites
- Node.js ${getNodeRequirement(repoAnalysis)}
- ${getAdditionalRequirements(repoAnalysis).join('\n- ')}

### Setup Steps

1. **Clone and Install**
   \`\`\`bash
   git clone <repository-url>
   cd ${projectName.toLowerCase()}
   ${getInstallCommand(repoAnalysis)}
   \`\`\`

2. **Configuration**
   ${getConfigurationSteps(repoAnalysis)}

3. **Verify Installation**
   \`\`\`bash
   ${getTestCommand(repoAnalysis)}
   \`\`\`

## 🎯 Usage Examples

### Basic Usage
\`\`\`${getMainLanguage(repoAnalysis)}
${generateBasicUsageExample(repoAnalysis, intelligentAnalysis)}
\`\`\`

### Advanced Features
${generateAdvancedExamples(repoAnalysis, intelligentAnalysis)}

## 🔧 Configuration

${generateConfigurationDocs(repoAnalysis)}

## 🧪 Testing

${intelligentAnalysis.detailedBreakdown.testingApproach}

Run tests with:
\`\`\`bash
${getTestCommand(repoAnalysis)}
\`\`\`

## 🏗️ Development

### Project Structure
\`\`\`
${generateProjectStructure(repoAnalysis)}
\`\`\`

### Build Process
\`\`\`bash
${getBuildCommand(repoAnalysis)}
\`\`\`

## 📝 API Reference

${config.includeAPIReference ? '[See detailed API reference](./api-reference.md)' : 'API reference available in code comments.'}

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature/amazing-feature\`
3. Make your changes and add tests
4. Run the test suite: \`${getTestCommand(repoAnalysis)}\`
5. Commit your changes: \`git commit -m 'Add amazing feature'\`
6. Push to the branch: \`git push origin feature/amazing-feature\`
7. Open a Pull Request

## 📄 License

${getLicenseInfo(repoAnalysis)}

## 🆘 Support & Community

- 📖 [Documentation](./docs/)
- 🐛 [Report Issues](./issues)
- 💬 [Discussions](./discussions)
- 📧 [Contact](mailto:support@example.com)

---

*This documentation was auto-generated by Echo AI Smart Documentation Agent*  
*Last updated: ${new Date().toISOString().split('T')[0]}*  
*Confidence: ${Math.round(intelligentAnalysis.confidence * 100)}%*
`;

  return doc;
}

async function generateAPIReference(projectPath: string, repoAnalysis: any): Promise<string> {
  const apiFiles = repoAnalysis.structure.source.filter((file: any) => 
    file.relativePath.includes('api') || 
    file.relativePath.includes('routes') ||
    file.relativePath.includes('endpoints')
  );

  let apiDoc = `# API Reference

## Overview
This document provides a comprehensive reference for all available API endpoints.

## Authentication
\`\`\`http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
\`\`\`

## Base URL
\`\`\`
https://api.example.com/v1
\`\`\`

## Endpoints

`;

  // Scan for API patterns in code
  for (const file of apiFiles.slice(0, 5)) { // Limit to prevent overwhelming
    try {
      const content = readFileSync(file.path, 'utf-8');
      const endpoints = extractAPIEndpoints(content);
      
      if (endpoints.length > 0) {
        apiDoc += `### ${file.relativePath}\n\n`;
        endpoints.forEach(endpoint => {
          apiDoc += `#### ${endpoint.method} ${endpoint.path}\n`;
          apiDoc += `${endpoint.description}\n\n`;
          apiDoc += `**Request:**\n\`\`\`http\n${endpoint.method} ${endpoint.path}\n\`\`\`\n\n`;
          if (endpoint.example) {
            apiDoc += `**Example:**\n\`\`\`json\n${endpoint.example}\n\`\`\`\n\n`;
          }
        });
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  apiDoc += `## Error Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 500  | Internal Server Error |

## Rate Limiting
- 1000 requests per hour per API key
- Rate limit headers included in all responses

## SDKs and Libraries
- JavaScript/TypeScript: \`npm install ${repoAnalysis.projectRoot.split('/').pop()}-sdk\`
- Python: \`pip install ${repoAnalysis.projectRoot.split('/').pop()}-python\`
- Go: \`go get github.com/example/${repoAnalysis.projectRoot.split('/').pop()}-go\`
`;

  return apiDoc;
}

async function generateArchitectureDoc(repoAnalysis: any, intelligentAnalysis: any): Promise<string> {
  return `# Architecture Documentation

## Overview
${intelligentAnalysis.summary}

## System Architecture
**Pattern:** ${intelligentAnalysis.architecture}

## Technology Stack
${intelligentAnalysis.techStack.map((tech: string) => `- **${tech}**`).join('\n')}

## Core Components

### Component Overview
${intelligentAnalysis.detailedBreakdown.coreComponents.map((comp: string) => `- **${comp}**`).join('\n')}

### Data Flow
\`\`\`
User Request → API Gateway → Business Logic → Data Layer → Response
\`\`\`

## Dependencies
### Production Dependencies
${repoAnalysis.dependencies.production.slice(0, 10).map((dep: string) => `- ${dep}`).join('\n')}

### Development Dependencies  
${repoAnalysis.dependencies.development.slice(0, 5).map((dep: string) => `- ${dep}`).join('\n')}

## Security Considerations
- Authentication and authorization mechanisms
- Input validation and sanitization
- Error handling and logging
- Rate limiting and abuse prevention

## Performance
- Caching strategies
- Database optimization
- API response times
- Scalability considerations

## Deployment
**Build System:** ${intelligentAnalysis.detailedBreakdown.buildSystem}

### Environment Requirements
- Production: High availability, auto-scaling
- Staging: Mirror production configuration
- Development: Local development setup

## Monitoring & Observability
- Application logs
- Performance metrics
- Error tracking
- Health checks
`;
}

async function generateGettingStartedGuide(repoAnalysis: any, intelligentAnalysis: any): Promise<string> {
  const projectName = repoAnalysis.projectRoot.split('/').pop() || 'Project';
  
  return `# Getting Started with ${projectName}

## Welcome! 👋
This guide will get you up and running with ${projectName} in just a few minutes.

## What You'll Learn
- How to install and set up ${projectName}
- Your first successful interaction
- Common use cases and examples
- Where to go for help

## Prerequisites
Before you begin, make sure you have:
- Node.js ${getNodeRequirement(repoAnalysis)} or higher
- ${getAdditionalRequirements(repoAnalysis).join('\n- ')}

## Step 1: Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd ${projectName.toLowerCase()}

# Install dependencies
${getInstallCommand(repoAnalysis)}
\`\`\`

## Step 2: Quick Start

${generateQuickStartSteps(repoAnalysis, intelligentAnalysis)}

## Step 3: Verify Everything Works

Run this command to verify your installation:
\`\`\`bash
${getTestCommand(repoAnalysis)}
\`\`\`

You should see: ✅ All tests passed!

## Your First ${intelligentAnalysis.mainPurpose}

${generateFirstExampleSteps(repoAnalysis, intelligentAnalysis)}

## Common Use Cases

### Use Case 1: ${getCommonUseCase1(intelligentAnalysis)}
\`\`\`${getMainLanguage(repoAnalysis)}
${generateUseCaseExample(repoAnalysis, intelligentAnalysis, 1)}
\`\`\`

### Use Case 2: ${getCommonUseCase2(intelligentAnalysis)}
\`\`\`${getMainLanguage(repoAnalysis)}
${generateUseCaseExample(repoAnalysis, intelligentAnalysis, 2)}
\`\`\`

## What's Next?

Now that you're set up, explore these areas:

1. **📖 [Full Documentation](./README.md)** - Complete feature reference
2. **🔧 [API Reference](./api-reference.md)** - Detailed API documentation  
3. **🏗️ [Architecture](./architecture.md)** - Understanding the system design
4. **🤝 [Contributing](./CONTRIBUTING.md)** - How to contribute to the project

## Need Help?

- 🐛 Found a bug? [Report it here](./issues)
- ❓ Have a question? [Check our FAQ](./FAQ.md)
- 💬 Want to chat? [Join our community](./discussions)

## Troubleshooting

### Common Issues

**Installation fails:**
\`\`\`bash
# Try clearing npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
\`\`\`

**Permission errors:**
\`\`\`bash
# On macOS/Linux, you might need:
sudo npm install -g ${projectName.toLowerCase()}
\`\`\`

Happy coding! 🚀
`;
}

// Helper functions for generating content
function getProjectVersion(projectPath: string): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function getInstallCommand(repoAnalysis: any): string {
  if (repoAnalysis.dependencies.production.length > 0) {
    return 'npm install';
  }
  return 'npm install';
}

function getRunCommand(repoAnalysis: any): string {
  if (repoAnalysis.buildCommands.length > 0) {
    return repoAnalysis.buildCommands[0].replace('npm run ', 'npm start') || 'npm start';
  }
  return 'npm start';
}

function getTestCommand(repoAnalysis: any): string {
  return repoAnalysis.testCommands[0] || 'npm test';
}

function getBuildCommand(repoAnalysis: any): string {
  return repoAnalysis.buildCommands[0] || 'npm run build';
}

function getNodeRequirement(repoAnalysis: any): string {
  return '18.0.0'; // Default modern requirement
}

function getAdditionalRequirements(repoAnalysis: any): string[] {
  const requirements = ['Git for version control'];
  
  if (repoAnalysis.projectType.includes('React')) {
    requirements.push('A modern web browser');
  }
  
  return requirements;
}

function getMainLanguage(repoAnalysis: any): string {
  return repoAnalysis.language.toLowerCase().includes('typescript') ? 'typescript' : 'javascript';
}

function getLicenseInfo(repoAnalysis: any): string {
  return 'This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.';
}

function generateProjectStructure(repoAnalysis: any): string {
  return `
${repoAnalysis.projectRoot.split('/').pop()}/
├── src/                 # Source code
├── docs/               # Documentation
├── tests/              # Test files
├── package.json        # Dependencies
└── README.md          # Project overview
`;
}

function generateConfigurationSteps(repoAnalysis: any): string {
  return `Copy the example configuration:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Edit the configuration file with your settings.`;
}

function generateConfigurationDocs(repoAnalysis: any): string {
  return `Configuration is handled through environment variables or configuration files.

### Environment Variables
- \`API_KEY\` - Your API key for external services
- \`DATABASE_URL\` - Database connection string
- \`PORT\` - Server port (default: 3000)

### Configuration Files
- \`.env\` - Environment-specific settings
- \`config/\` - Application configuration`;
}

function generateBasicUsageExample(repoAnalysis: any, intelligentAnalysis: any): string {
  if (intelligentAnalysis.mainPurpose.includes('CLI')) {
    return `// Basic CLI usage
import { ${repoAnalysis.projectRoot.split('/').pop()} } from '.';

const result = await ${repoAnalysis.projectRoot.split('/').pop().toLowerCase()}('your command');
console.log(result);`;
  }
  
  return `// Basic usage example
import { main } from '.';

const result = await main();
console.log(result);`;
}

function generateAdvancedExamples(repoAnalysis: any, intelligentAnalysis: any): string {
  return `
### Advanced Configuration
\`\`\`${getMainLanguage(repoAnalysis)}
// Advanced usage with custom options
const options = {
  verbose: true,
  outputFormat: 'json'
};

const result = await processWithOptions(data, options);
\`\`\`

### Batch Operations
\`\`\`${getMainLanguage(repoAnalysis)}
// Processing multiple items
const results = await Promise.all(
  items.map(item => process(item))
);
\`\`\``;
}

function generateQuickStartSteps(repoAnalysis: any, intelligentAnalysis: any): string {
  if (intelligentAnalysis.mainPurpose.includes('CLI')) {
    return `\`\`\`bash
# Run the CLI tool
${repoAnalysis.projectRoot.split('/').pop().toLowerCase()} --help

# Try your first command
${repoAnalysis.projectRoot.split('/').pop().toLowerCase()} "hello world"
\`\`\``;
  }
  
  return `\`\`\`bash
# Start the development server
npm run dev

# Open your browser to http://localhost:3000
\`\`\``;
}

function generateFirstExampleSteps(repoAnalysis: any, intelligentAnalysis: any): string {
  return `Let's create your first successful interaction:

1. Open your terminal
2. Run the example command
3. Verify the output
4. Explore the results

This gives you confidence that everything is working correctly.`;
}

function getCommonUseCase1(intelligentAnalysis: any): string {
  if (intelligentAnalysis.mainPurpose.includes('CLI')) {
    return 'Interactive Command Usage';
  }
  return 'Basic Integration';
}

function getCommonUseCase2(intelligentAnalysis: any): string {
  if (intelligentAnalysis.mainPurpose.includes('CLI')) {
    return 'Batch Processing';
  }
  return 'Advanced Configuration';
}

function generateUseCaseExample(repoAnalysis: any, intelligentAnalysis: any, useCase: number): string {
  const lang = getMainLanguage(repoAnalysis);
  
  if (useCase === 1) {
    return `// Use case 1 example
const result = await basicOperation(input);
console.log('Result:', result);`;
  }
  
  return `// Use case 2 example  
const config = { advanced: true };
const result = await advancedOperation(input, config);
console.log('Advanced result:', result);`;
}

function extractAPIEndpoints(content: string): any[] {
  const endpoints: any[] = [];
  
  // Simple regex patterns to extract API routes
  const patterns = [
    /app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g,
    /router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g,
    /@(Get|Post|Put|Delete|Patch)\(['"`]([^'"`]+)['"`]/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        description: `${match[1].toUpperCase()} endpoint for ${match[2]}`,
        example: null
      });
    }
  });
  
  return endpoints;
}

export { DocumentationConfig, GeneratedDocumentation };