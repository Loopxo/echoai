import { Agent, AgentCapability, AgentContext, AgentResult } from '../types.js';

export class AutoDocumentationAgent implements Agent {
  name = 'AutoDocumentationAgent';
  description = 'Generates comprehensive, developer-friendly documentation for APIs, codebases, and SaaS workflows';
  version = '1.0.0';
  capabilities: AgentCapability[] = [
    {
      name: 'api-documentation',
      description: 'Generates complete API documentation with examples and use cases',
      category: 'documentation',
      supportedProviders: ['*'],
      requiredParameters: [],
    },
    {
      name: 'codebase-documentation',
      description: 'Creates comprehensive documentation for entire codebases',
      category: 'documentation',
      supportedProviders: ['claude', 'gpt-4'],
    },
    {
      name: 'workflow-documentation',
      description: 'Documents SaaS workflows, processes, and user journeys',
      category: 'documentation',
      supportedProviders: ['claude', 'gemini'],
    },
    {
      name: 'sdk-documentation',
      description: 'Generates SDK documentation with integration guides',
      category: 'documentation',
      supportedProviders: ['*'],
    },
  ];

  canHandle(context: AgentContext): boolean {
    const input = context.input.toLowerCase();
    
    // Documentation-related keywords
    const docKeywords = [
      'document', 'docs', 'documentation', 'api docs', 'readme', 'guide', 
      'manual', 'reference', 'specification', 'spec', 'wiki', 'help',
      'how to', 'tutorial', 'walkthrough', 'examples', 'usage'
    ];
    
    // API/SaaS specific keywords
    const apiKeywords = [
      'api', 'endpoint', 'rest', 'graphql', 'webhook', 'sdk', 'library',
      'integration', 'saas', 'workflow', 'process', 'onboarding',
      'authentication', 'authorization', 'rate limit', 'response'
    ];
    
    // Auto-generation keywords
    const autoGenKeywords = [
      'generate', 'create', 'auto', 'automatic', 'maintain', 'update',
      'sync', 'keep updated', 'live docs', 'dynamic'
    ];
    
    const hasDocKeywords = docKeywords.some(keyword => input.includes(keyword));
    const hasApiKeywords = apiKeywords.some(keyword => input.includes(keyword));
    const hasAutoGenKeywords = autoGenKeywords.some(keyword => input.includes(keyword));
    
    // Strong match if it has doc + (api or auto-gen) keywords
    if (hasDocKeywords && (hasApiKeywords || hasAutoGenKeywords)) {
      return true;
    }
    
    // Patterns that indicate documentation requests
    const docPatterns = [
      /create.*docs?/,
      /generate.*documentation/,
      /api.*reference/,
      /how.*to.*use/,
      /integration.*guide/,
      /developer.*docs/,
      /auto.*docs?/
    ];
    
    return docPatterns.some(pattern => pattern.test(input));
  }

  async optimize(context: AgentContext): Promise<AgentResult> {
    const input = context.input;
    let optimizedPrompt = input;
    const optimizations: string[] = [];

    // Detect documentation type
    const docType = this.detectDocumentationType(input);
    
    // Add structured documentation framework
    if (this.shouldAddDocStructure(input)) {
      optimizedPrompt = this.addDocumentationStructure(input, docType);
      optimizations.push('structured-documentation-prompt');
    }

    // Add comprehensive documentation guidelines
    optimizedPrompt += this.getDocumentationGuidelines(docType);
    optimizations.push('comprehensive-documentation-guidelines');

    // Add developer experience focus
    optimizedPrompt += this.getDeveloperExperiencePrompt();
    optimizations.push('developer-experience-optimization');

    // Add auto-maintenance considerations
    if (this.needsMaintenanceGuidance(input)) {
      optimizedPrompt += this.getMaintenanceGuidelines();
      optimizations.push('maintenance-guidelines');
    }

    // Suggest best provider for documentation tasks
    const suggestedProvider = this.suggestProviderForDocumentation(context, input, docType);
    const suggestedModel = this.suggestModelForDocumentation(suggestedProvider);

    return {
      optimizedPrompt,
      expectedOutputType: 'documentation',
      confidence: this.calculateConfidence(input, optimizations, docType),
      suggestedProvider,
      suggestedModel,
      postProcessingRules: [
        'markdown-formatting',
        'add-table-of-contents',
        'ensure-examples',
        'validate-links',
      ],
      metadata: {
        agentUsed: this.name,
        optimizationApplied: optimizations,
        documentationType: docType,
        estimatedTokens: Math.ceil(optimizedPrompt.length / 4),
        expectedSections: this.getExpectedSections(docType),
      },
    };
  }

  async postProcess(result: string, context: AgentContext): Promise<string> {
    let processed = result;

    // Ensure proper markdown structure
    processed = this.formatMarkdownStructure(processed);
    
    // Add table of contents if missing
    if (!processed.includes('## Table of Contents') && processed.split('##').length > 3) {
      processed = this.addTableOfContents(processed);
    }

    // Ensure code examples are properly formatted
    processed = this.formatCodeExamples(processed);

    // Add navigation elements for large docs
    if (processed.length > 10000) {
      processed = this.addNavigationElements(processed);
    }

    // Add last updated timestamp
    processed = this.addLastUpdatedSection(processed);

    return processed;
  }

  private detectDocumentationType(input: string): string {
    const input_lower = input.toLowerCase();
    
    if (input_lower.includes('api') || input_lower.includes('endpoint') || input_lower.includes('rest')) {
      return 'api';
    }
    if (input_lower.includes('sdk') || input_lower.includes('library') || input_lower.includes('integration')) {
      return 'sdk';
    }
    if (input_lower.includes('workflow') || input_lower.includes('process') || input_lower.includes('saas')) {
      return 'workflow';
    }
    if (input_lower.includes('codebase') || input_lower.includes('repository') || input_lower.includes('project')) {
      return 'codebase';
    }
    
    return 'general';
  }

  private shouldAddDocStructure(input: string): boolean {
    const hasStructureKeywords = /\b(create|generate|write|build|document)\b/.test(input.toLowerCase());
    const lacksStructure = !input.includes('##') && !input.includes('structure');
    return hasStructureKeywords && lacksStructure;
  }

  private addDocumentationStructure(input: string, docType: string): string {
    const structures = {
      api: `${input}

Create comprehensive API documentation with the following structure:
1. **Overview & Introduction** - What the API does and key benefits
2. **Getting Started** - Quick setup and first API call
3. **Authentication** - How to authenticate and get API keys
4. **Core Endpoints** - Main API endpoints with examples
5. **Request/Response Examples** - Real working examples
6. **Error Handling** - Complete error codes and troubleshooting
7. **Rate Limits & Best Practices** - Usage guidelines
8. **SDKs & Libraries** - Available tools and integrations
9. **Changelog** - Version history and updates`,

      sdk: `${input}

Create comprehensive SDK documentation with:
1. **Installation & Setup** - How to install and configure
2. **Quick Start Guide** - Get up and running in 5 minutes
3. **Core Methods** - Main SDK functions with examples
4. **Configuration Options** - All available settings
5. **Integration Examples** - Real-world use cases
6. **Error Handling** - Exception handling and debugging
7. **Advanced Features** - Power user functionality
8. **Migration Guides** - Upgrading between versions
9. **Community & Support** - Where to get help`,

      workflow: `${input}

Create comprehensive workflow documentation with:
1. **Process Overview** - What the workflow accomplishes
2. **Prerequisites** - What users need before starting
3. **Step-by-Step Guide** - Clear, numbered instructions
4. **User Interface Guide** - Screenshots and UI walkthroughs
5. **Common Use Cases** - Different scenarios and approaches
6. **Troubleshooting** - Common issues and solutions
7. **Tips & Best Practices** - Pro tips for efficiency
8. **FAQs** - Frequently asked questions
9. **Next Steps** - What to do after completion`,

      codebase: `${input}

Create comprehensive codebase documentation with:
1. **Project Overview** - What the project does and architecture
2. **Getting Started** - Setup, installation, and first run
3. **Project Structure** - Directory layout and organization
4. **Core Components** - Main modules and their purposes
5. **API Reference** - Functions, classes, and interfaces
6. **Configuration** - Environment setup and options
7. **Development Guide** - How to contribute and develop
8. **Deployment** - How to build and deploy
9. **Testing** - How to run tests and add new ones`,

      general: `${input}

Create comprehensive documentation with:
1. **Introduction** - Overview and purpose
2. **Getting Started** - Quick setup and basic usage
3. **Main Features** - Core functionality and capabilities
4. **Examples & Use Cases** - Practical examples
5. **Advanced Topics** - Complex features and configurations
6. **Troubleshooting** - Common issues and solutions
7. **FAQs** - Frequently asked questions
8. **Resources** - Additional tools and references`
    };

    return structures[docType as keyof typeof structures] || structures.general;
  }

  private getDocumentationGuidelines(docType: string): string {
    return `

DOCUMENTATION EXCELLENCE GUIDELINES:
📚 **Content Requirements:**
- Write for developers who are new to this tool/API
- Include working code examples for every feature
- Provide copy-paste ready snippets
- Explain the "why" behind each feature, not just the "how"
- Use real-world scenarios and use cases

🎯 **Developer Experience Focus:**
- Start with the most common use case
- Provide a "Quick Start" that works in under 5 minutes
- Include troubleshooting for common errors
- Add tips for optimization and best practices
- Make navigation intuitive with clear headings

⚡ **Maintainability Features:**
- Use consistent formatting and style
- Include version information where relevant
- Add timestamps for when sections were last updated
- Create modular sections that can be updated independently
- Include placeholders for auto-generated content

💡 **Smart Auto-Documentation Features:**
- Structure content for easy programmatic updates
- Include metadata that can be automatically maintained
- Design sections that can pull from code comments
- Create templates for consistent documentation patterns`;
  }

  private getDeveloperExperiencePrompt(): string {
    return `

🔥 **DEVELOPER-FIRST APPROACH:**
- Lead with practical examples, not theory
- Assume developers want to solve problems quickly
- Include common error scenarios and solutions
- Provide multiple implementation approaches when relevant
- Add performance considerations and limitations
- Include links to additional resources and community

🚀 **ONBOARDING OPTIMIZATION:**
- Create a "5-minute getting started" section
- Provide ready-to-run example projects
- Include environment setup instructions
- Add validation steps to confirm everything works
- Guide users to their first successful implementation`;
  }

  private needsMaintenanceGuidance(input: string): boolean {
    const maintenanceKeywords = ['maintain', 'update', 'sync', 'auto', 'dynamic', 'live'];
    return maintenanceKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }

  private getMaintenanceGuidelines(): string {
    return `

🔄 **AUTO-MAINTENANCE STRATEGY:**
- Design documentation structure for programmatic updates
- Include sections that can be auto-generated from code
- Create clear separation between static and dynamic content
- Add hooks for automated testing of code examples
- Include version tracking and change detection
- Design for CI/CD integration and automated publishing

📊 **KEEPING DOCS FRESH:**
- Add "Last Updated" timestamps to each major section
- Include automated link checking and validation
- Create review schedules for different content types
- Set up monitoring for outdated examples or deprecated features
- Implement feedback collection from developers using the docs`;
  }

  private suggestProviderForDocumentation(context: AgentContext, input: string, docType: string): string {
    // Claude is excellent for comprehensive, well-structured documentation
    if (docType === 'api' || docType === 'sdk' || input.toLowerCase().includes('comprehensive')) {
      return 'claude';
    }
    
    // GPT-4 is great for creative and engaging documentation
    if (docType === 'workflow' || input.toLowerCase().includes('user-friendly')) {
      return 'openai';
    }

    // Gemini is good for technical accuracy and detailed explanations
    if (docType === 'codebase' || input.toLowerCase().includes('technical')) {
      return 'gemini';
    }

    return context.provider; // Keep existing provider if no specific preference
  }

  private suggestModelForDocumentation(provider: string): string {
    const modelMap: Record<string, string> = {
      'claude': 'claude-3-5-sonnet-20241022',
      'openai': 'gpt-4o',
      'gemini': 'gemini-1.5-pro',
      'groq': 'llama3-70b-8192',
    };

    return modelMap[provider] || '';
  }

  private calculateConfidence(input: string, optimizations: string[], docType: string): number {
    let confidence = 0.7; // Base confidence for documentation
    
    // Higher confidence for specific documentation keywords
    const docSpecificTerms = ['documentation', 'api docs', 'guide', 'reference', 'manual'];
    const matches = docSpecificTerms.filter(term => input.toLowerCase().includes(term));
    confidence += matches.length * 0.05;
    
    // Higher confidence for recognized documentation types
    if (docType !== 'general') {
      confidence += 0.1;
    }
    
    // More optimizations = higher confidence
    confidence += optimizations.length * 0.03;
    
    return Math.min(confidence, 0.95);
  }

  private getExpectedSections(docType: string): string[] {
    const sections = {
      api: ['Overview', 'Getting Started', 'Authentication', 'Endpoints', 'Examples', 'Error Handling'],
      sdk: ['Installation', 'Quick Start', 'Methods', 'Configuration', 'Examples', 'Error Handling'],
      workflow: ['Overview', 'Prerequisites', 'Steps', 'UI Guide', 'Use Cases', 'Troubleshooting'],
      codebase: ['Overview', 'Setup', 'Structure', 'Components', 'API Reference', 'Development'],
      general: ['Introduction', 'Getting Started', 'Features', 'Examples', 'Advanced Topics', 'FAQ']
    };

    return sections[docType as keyof typeof sections] || sections.general;
  }

  private formatMarkdownStructure(result: string): string {
    // Ensure proper heading hierarchy
    let formatted = result;
    
    // Add proper spacing around headings
    formatted = formatted.replace(/\n(#{1,6})/g, '\n\n$1');
    formatted = formatted.replace(/(#{1,6}.*)\n([^#\n])/g, '$1\n\n$2');
    
    return formatted;
  }

  private addTableOfContents(result: string): string {
    const headings = result.match(/^#{1,6}\s+(.+)$/gm) || [];
    if (headings.length < 2) return result;

    let toc = '\n## Table of Contents\n\n';
    headings.forEach(heading => {
      const level = heading.match(/^#+/)?.[0].length || 1;
      const text = heading.replace(/^#+\s+/, '');
      const indent = '  '.repeat(Math.max(0, level - 2));
      const link = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      toc += `${indent}- [${text}](#${link})\n`;
    });

    // Insert TOC after first heading
    const firstHeadingIndex = result.search(/^#{1,6}/m);
    if (firstHeadingIndex !== -1) {
      const nextLineIndex = result.indexOf('\n', firstHeadingIndex);
      return result.slice(0, nextLineIndex) + toc + result.slice(nextLineIndex);
    }

    return toc + result;
  }

  private formatCodeExamples(result: string): string {
    // Ensure code blocks have language tags
    return result.replace(/```\n(?!([a-z]+\n))/g, '```bash\n');
  }

  private addNavigationElements(result: string): string {
    // Add "Back to top" links for long documents
    return result.replace(/(^#{1,6}.*$)/gm, '$1\n\n[⬆️ Back to top](#table-of-contents)');
  }

  private addLastUpdatedSection(result: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return result + `\n\n---\n\n*Last updated: ${timestamp}*\n*This documentation is auto-maintained by Echo AI*`;
  }
}