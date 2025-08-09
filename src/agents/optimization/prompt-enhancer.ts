import { Agent, AgentCapability, AgentContext, AgentResult } from '../types.js';

export class PromptEnhancerAgent implements Agent {
  name = 'PromptEnhancer';
  version = '1.0.0';
  capabilities: AgentCapability[] = [
    {
      name: 'prompt-optimization',
      description: 'Enhances prompts for better AI responses across all providers',
      category: 'optimization',
      supportedProviders: ['*'],
    },
    {
      name: 'context-enhancement',
      description: 'Adds relevant context and structure to improve output quality',
      category: 'generation',
      supportedProviders: ['*'],
    },
  ];

  canHandle(context: AgentContext): boolean {
    // This agent can handle any prompt, but prioritizes vague or short prompts
    const input = context.input;
    const isVague = input.length < 50;
    const isGeneric = /\b(help|explain|tell me|what|how)\b/.test(input.toLowerCase());
    const lacksSpecificity = !input.includes('specific') && !input.includes('example');
    
    return isVague || isGeneric || lacksSpecificity;
  }

  async optimize(context: AgentContext): Promise<AgentResult> {
    const input = context.input;
    let optimizedPrompt = input;
    const optimizations: string[] = [];

    // Add context and specificity
    if (this.needsContext(input)) {
      optimizedPrompt = this.addContextualFramework(input, context);
      optimizations.push('contextual-framework');
    }

    // Add output format specification
    if (this.needsOutputFormat(input)) {
      optimizedPrompt += this.addOutputFormatting(context);
      optimizations.push('output-formatting');
    }

    // Add role-playing for better responses
    if (this.shouldAddRole(input, context)) {
      optimizedPrompt = this.addExpertRole(optimizedPrompt, this.detectDomain(input));
      optimizations.push('expert-role');
    }

    // Add step-by-step thinking for complex queries
    if (this.needsStepByStep(input)) {
      optimizedPrompt += this.addStepByStepPrompt();
      optimizations.push('step-by-step-thinking');
    }

    // Add examples request for better understanding
    if (this.needsExamples(input, context)) {
      optimizedPrompt += this.addExamplesRequest();
      optimizations.push('examples-request');
    }

    const expectedOutput = this.determineOutputType(input);
    
    return {
      optimizedPrompt,
      expectedOutputType: expectedOutput,
      confidence: this.calculateConfidence(input, optimizations),
      suggestedProvider: this.suggestBestProvider(input, context),
      postProcessingRules: [
        'structure-response',
        'add-headings',
        'format-lists',
      ],
      metadata: {
        agentUsed: this.name,
        optimizationApplied: optimizations,
        detectedDomain: this.detectDomain(input),
        estimatedTokens: Math.ceil(optimizedPrompt.length / 4),
      },
    };
  }

  async postProcess(result: string, context: AgentContext): Promise<string> {
    let processed = result;

    // Add structure with headings
    processed = this.addStructure(processed);
    
    // Format lists and bullet points
    processed = this.formatLists(processed);
    
    // Add summary if response is long
    if (processed.length > 2000) {
      processed = this.addSummary(processed);
    }

    return processed;
  }

  private needsContext(input: string): boolean {
    return input.length < 100 && !input.includes('context') && !input.includes('background');
  }

  private addContextualFramework(input: string, context: AgentContext): string {
    const level = context.userPreferences?.explanationLevel || 'intermediate';
    const includeExamples = context.userPreferences?.includeExamples ?? true;
    
    let framework = `Context: ${input}\n\n`;
    framework += `Please provide a comprehensive ${level}-level response`;
    
    if (includeExamples) {
      framework += ' with practical examples';
    }
    
    framework += '.\n\n';
    return framework + input;
  }

  private needsOutputFormat(input: string): boolean {
    return !input.includes('format') && !input.includes('structure') && !input.includes('organize');
  }

  private addOutputFormatting(context: AgentContext): string {
    const format = context.userPreferences?.outputFormat || 'structured';
    
    switch (format) {
      case 'concise':
        return '\n\nProvide a concise, direct response with key points only.';
      case 'detailed':
        return '\n\nProvide a detailed explanation with background, examples, and implications.';
      case 'creative':
        return '\n\nUse creative examples and analogies to explain concepts clearly.';
      default:
        return '\n\nStructure your response with clear headings, bullet points, and examples.';
    }
  }

  private shouldAddRole(input: string, context: AgentContext): boolean {
    const hasRoleKeywords = /\b(expert|professional|specialist|as a)\b/.test(input.toLowerCase());
    return !hasRoleKeywords && this.detectDomain(input) !== null;
  }

  private addExpertRole(prompt: string, domain: string | null): string {
    if (!domain) return prompt;
    
    const roleMap = {
      'programming': 'You are a senior software engineer with expertise in multiple programming languages.',
      'data': 'You are a data scientist with expertise in analytics, machine learning, and statistical analysis.',
      'design': 'You are a UX/UI designer with expertise in user experience and interface design.',
      'business': 'You are a business consultant with expertise in strategy and operations.',
      'writing': 'You are a professional writer and editor with expertise in clear communication.',
      'science': 'You are a researcher with deep expertise in scientific methodology and analysis.',
      'default': 'You are an expert consultant with broad knowledge and analytical skills.'
    };
    
    const role = roleMap[domain] || roleMap['default'];
    return `${role}\n\n${prompt}`;
  }

  private needsStepByStep(input: string): boolean {
    const complexityIndicators = ['how to', 'explain', 'process', 'method', 'approach', 'solve'];
    return complexityIndicators.some(indicator => input.toLowerCase().includes(indicator)) && 
           !input.includes('step');
  }

  private addStepByStepPrompt(): string {
    return '\n\nPlease break down your response into clear, logical steps.';
  }

  private needsExamples(input: string, context: AgentContext): boolean {
    const wantsExamples = context.userPreferences?.includeExamples ?? true;
    const lacksExamples = !input.includes('example') && !input.includes('instance');
    return wantsExamples && lacksExamples;
  }

  private addExamplesRequest(): string {
    return '\n\nInclude specific examples to illustrate your points.';
  }

  private detectDomain(input: string): string | null {
    const domains = {
      'programming': /\b(code|program|software|debug|algorithm|function|class)\b/i,
      'data': /\b(data|analysis|statistics|machine learning|dataset|visualization)\b/i,
      'design': /\b(design|ui|ux|interface|user experience|layout|prototype)\b/i,
      'business': /\b(business|strategy|market|revenue|customer|sales|operations)\b/i,
      'writing': /\b(write|content|article|blog|copy|editing|grammar)\b/i,
      'science': /\b(research|study|hypothesis|experiment|theory|scientific)\b/i,
    };

    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(input)) {
        return domain;
      }
    }

    return null;
  }

  private determineOutputType(input: string): 'code' | 'explanation' | 'analysis' | 'creative' {
    if (/\b(code|program|function|script)\b/.test(input.toLowerCase())) {
      return 'code';
    }
    if (/\b(analyze|compare|evaluate|assess)\b/.test(input.toLowerCase())) {
      return 'analysis';
    }
    if (/\b(story|creative|imagine|invent)\b/.test(input.toLowerCase())) {
      return 'creative';
    }
    return 'explanation';
  }

  private suggestBestProvider(input: string, context: AgentContext): string {
    const domain = this.detectDomain(input);
    
    // Provider strengths mapping
    if (domain === 'programming') return 'claude'; // Great for code explanation
    if (domain === 'data') return 'openai'; // Excellent analytical capabilities
    if (domain === 'creative') return 'claude'; // Strong creative writing
    if (domain === 'business') return 'openai'; // Good business knowledge
    
    return context.provider; // Keep existing provider as default
  }

  private calculateConfidence(input: string, optimizations: string[]): number {
    let confidence = 0.7; // Base confidence
    
    // Lower confidence for very short prompts
    if (input.length < 20) confidence -= 0.2;
    
    // Higher confidence for more optimizations applied
    confidence += optimizations.length * 0.05;
    
    // Higher confidence if domain was detected
    if (this.detectDomain(input)) confidence += 0.1;
    
    return Math.min(confidence, 0.9);
  }

  private addStructure(result: string): string {
    // Add basic structure if missing
    if (!result.includes('#') && !result.includes('##') && result.length > 500) {
      const lines = result.split('\n');
      let structured = '';
      let inSection = false;
      
      for (const line of lines) {
        if (line.length > 0 && line.charAt(0) === line.charAt(0).toUpperCase() && line.length < 100) {
          if (!inSection) {
            structured += `## ${line}\n`;
            inSection = true;
          } else {
            structured += line + '\n';
          }
        } else {
          structured += line + '\n';
        }
      }
      
      return structured;
    }
    
    return result;
  }

  private formatLists(result: string): string {
    // Convert numbered patterns to proper lists
    return result.replace(/(\d+\.\s)/g, '• ');
  }

  private addSummary(result: string): string {
    if (!result.includes('Summary') && !result.includes('Key Points')) {
      return `## Summary\n\n*This response covers the main aspects of your question with detailed explanations and examples.*\n\n---\n\n${result}`;
    }
    return result;
  }
}