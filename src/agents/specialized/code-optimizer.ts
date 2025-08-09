import { Agent, AgentCapability, AgentContext, AgentResult } from '../types.js';

export class CodeOptimizerAgent implements Agent {
  name = 'CodeOptimizer';
  version = '1.0.0';
  capabilities: AgentCapability[] = [
    {
      name: 'code-optimization',
      description: 'Optimizes prompts for code generation, refactoring, and debugging',
      category: 'optimization',
      supportedProviders: ['*'],
      requiredParameters: [],
    },
    {
      name: 'code-analysis',
      description: 'Analyzes code and suggests improvements',
      category: 'analysis',
      supportedProviders: ['claude', 'gpt-4', 'meta'],
    },
  ];

  canHandle(context: AgentContext): boolean {
    const input = context.input.toLowerCase();
    
    // Code-related keywords
    const codeKeywords = [
      'code', 'function', 'class', 'method', 'algorithm', 'debug', 'refactor', 
      'optimize', 'bug', 'error', 'syntax', 'programming', 'script', 'module',
      'api', 'database', 'query', 'import', 'export', 'variable', 'constant'
    ];
    
    // File extensions that indicate code
    const codeExtensions = [
      '.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb',
      '.swift', '.kotlin', '.scala', '.dart', '.vue', '.jsx', '.tsx'
    ];
    
    const hasCodeKeywords = codeKeywords.some(keyword => input.includes(keyword));
    const hasCodeExtensions = codeExtensions.some(ext => input.includes(ext));
    const hasCodePatterns = /\b(def |function |class |const |let |var |import |from )\b/.test(input);
    
    return hasCodeKeywords || hasCodeExtensions || hasCodePatterns;
  }

  async optimize(context: AgentContext): Promise<AgentResult> {
    const input = context.input;
    let optimizedPrompt = input;
    const optimizations: string[] = [];

    // Add structured prompt format for code
    if (this.shouldAddCodeStructure(input)) {
      optimizedPrompt = this.addCodeStructure(input);
      optimizations.push('structured-code-prompt');
    }

    // Add best practices guidance
    if (this.needsBestPractices(input)) {
      optimizedPrompt += this.getBestPracticesPrompt(context);
      optimizations.push('best-practices-guidance');
    }

    // Add language-specific optimizations
    const language = this.detectLanguage(input);
    if (language) {
      optimizedPrompt += this.getLanguageSpecificPrompt(language);
      optimizations.push(`${language}-specific-optimization`);
    }

    // Suggest best provider for code tasks
    const suggestedProvider = this.suggestProviderForCode(context, input);
    const suggestedModel = this.suggestModelForCode(suggestedProvider);

    return {
      optimizedPrompt,
      expectedOutputType: 'code',
      confidence: this.calculateConfidence(input, optimizations),
      suggestedProvider,
      suggestedModel,
      postProcessingRules: [
        'syntax-highlighting',
        'code-formatting',
        'add-comments',
      ],
      metadata: {
        agentUsed: this.name,
        optimizationApplied: optimizations,
        detectedLanguage: language,
        estimatedTokens: Math.ceil(optimizedPrompt.length / 4),
      },
    };
  }

  async postProcess(result: string, context: AgentContext): Promise<string> {
    let processed = result;

    // Ensure code blocks are properly formatted
    processed = this.formatCodeBlocks(processed);
    
    // Add helpful comments if requested
    if (context.userPreferences?.includeExamples) {
      processed = this.addExampleUsage(processed);
    }

    return processed;
  }

  private shouldAddCodeStructure(input: string): boolean {
    const hasStructureKeywords = /\b(write|create|generate|build|implement)\b/.test(input.toLowerCase());
    const lacksStructure = !input.includes('```') && !input.includes('example');
    return hasStructureKeywords && lacksStructure;
  }

  private addCodeStructure(input: string): string {
    return `${input}

Please provide:
1. Clean, well-commented code
2. Explanation of the approach
3. Usage examples
4. Error handling considerations

Format your response with proper code blocks and clear explanations.`;
  }

  private needsBestPractices(input: string): boolean {
    const practiceKeywords = ['best', 'practice', 'recommended', 'standard', 'professional'];
    return !practiceKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }

  private getBestPracticesPrompt(context: AgentContext): string {
    const level = context.userPreferences?.explanationLevel || 'intermediate';
    
    if (level === 'expert') {
      return '\n\nFocus on production-ready code with optimal performance and security considerations.';
    } else if (level === 'beginner') {
      return '\n\nPlease explain each step clearly and include comments for learning purposes.';
    } else {
      return '\n\nFollow industry best practices and include brief explanations of key concepts.';
    }
  }

  private detectLanguage(input: string): string | null {
    const languagePatterns = {
      'javascript': /\b(javascript|js|node|npm|yarn|react|vue|angular)\b/i,
      'typescript': /\b(typescript|ts|tsx)\b/i,
      'python': /\b(python|py|django|flask|pandas|numpy)\b/i,
      'java': /\b(java|spring|maven|gradle)\b/i,
      'go': /\b(golang|go)\b/i,
      'rust': /\b(rust|cargo)\b/i,
      'cpp': /\b(c\+\+|cpp|cmake)\b/i,
      'csharp': /\b(c#|csharp|\.net|dotnet)\b/i,
    };

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(input)) {
        return lang;
      }
    }

    return null;
  }

  private getLanguageSpecificPrompt(language: string): string {
    const languagePrompts = {
      'javascript': '\n\nUse modern ES6+ features and consider async/await patterns.',
      'typescript': '\n\nProvide proper TypeScript types and interfaces.',
      'python': '\n\nFollow PEP 8 style guide and use type hints where appropriate.',
      'java': '\n\nUse appropriate design patterns and follow Java naming conventions.',
      'go': '\n\nFollow Go idioms and proper error handling patterns.',
      'rust': '\n\nEnsure memory safety and follow Rust ownership principles.',
    };

    return languagePrompts[language] || '';
  }

  private suggestProviderForCode(context: AgentContext, input: string): string {
    // Claude is excellent for code analysis and explanations
    if (input.toLowerCase().includes('explain') || input.toLowerCase().includes('analyze')) {
      return 'claude';
    }
    
    // GPT-4 is great for complex code generation
    if (input.toLowerCase().includes('generate') || input.toLowerCase().includes('create')) {
      return 'openai';
    }

    // Meta/Llama models are good for code optimization
    if (input.toLowerCase().includes('optimize') || input.toLowerCase().includes('refactor')) {
      return 'meta';
    }

    return context.provider; // Keep existing provider if no specific preference
  }

  private suggestModelForCode(provider: string): string {
    const modelMap = {
      'claude': 'claude-3-sonnet-20240229',
      'openai': 'gpt-4-turbo-preview',
      'meta': 'code-llama-70b-instruct',
      'groq': 'llama3-70b-8192',
    };

    return modelMap[provider] || '';
  }

  private calculateConfidence(input: string, optimizations: string[]): number {
    let confidence = 0.6; // Base confidence
    
    // Higher confidence for more code-specific input
    const codeSpecificTerms = ['function', 'class', 'method', 'algorithm', 'debug'];
    const matches = codeSpecificTerms.filter(term => input.toLowerCase().includes(term));
    confidence += matches.length * 0.1;
    
    // More optimizations = higher confidence
    confidence += optimizations.length * 0.05;
    
    return Math.min(confidence, 0.95);
  }

  private formatCodeBlocks(result: string): string {
    // Ensure code blocks have proper language tags
    return result.replace(/```\n/g, '```\n');
  }

  private addExampleUsage(result: string): string {
    if (!result.includes('Example') && !result.includes('Usage')) {
      return result + '\n\n// Example usage and additional context would be added here';
    }
    return result;
  }
}