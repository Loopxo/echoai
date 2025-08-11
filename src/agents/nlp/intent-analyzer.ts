import { ProviderManager } from '../../core/provider-manager.js';
import type { Config } from '../../config/index.js';
import { ConfigManager } from '../../config/manager.js';

export interface Intent {
    name: string;
    confidence: number;
    parameters: Record<string, any>;
    context: IntentContext;
    subIntents?: Intent[];
}

export interface IntentContext {
    domain: 'code' | 'file' | 'project' | 'debug' | 'optimization' | 'documentation' | 'general' | 
           'ai' | 'ml' | 'architecture' | 'database' | 'infrastructure' | 'deployment' | 'monitoring' |
           'ui' | 'frontend' | 'mobile' | 'ios' | 'android' | 'prototype' | 'mvp' | 'validation' |
           'testing' | 'quality' | 'debugging' | 'design' | 'branding' | 'visual' | 'research' |
           'ux' | 'interaction' | 'animation' | 'marketing' | 'growth' | 'analytics' | 'content' |
           'copywriting' | 'app_store' | 'social_media' | 'instagram' | 'tiktok' | 'twitter' |
           'community' | 'reddit' | 'planning' | 'strategy' | 'feedback' | 'market' | 'performance' |
           'workflow' | 'metrics' | 'reporting' | 'maintenance' | 'components' | 'user_testing' |
           'storytelling' | 'product' | 'user_research' | 'api' | 'integration';
    task: string;
    language?: string;
    framework?: string;
    urgency: 'low' | 'normal' | 'high' | 'critical';
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    scope: 'line' | 'function' | 'file' | 'module' | 'project';
}

export interface NLPPattern {
    id: string;
    pattern: RegExp;
    intent: string;
    confidence: number;
    contextHints: string[];
    parameterExtractors: Array<{
        name: string;
        regex: RegExp;
        type: 'string' | 'number' | 'boolean' | 'array';
        required: boolean;
    }>;
}

export class AdvancedNLPIntentAnalyzer {
    private patterns: NLPPattern[] = [];
    private providerManager: ProviderManager;
    private intentHistory: Array<{ intent: Intent; timestamp: Date; success: boolean }> = [];

    constructor(private configManager: ConfigManager) {
        this.providerManager = new ProviderManager(configManager);
        this.initializePatterns();
    }

    private initializePatterns(): void {
        this.patterns = [
            // Code Generation Intents
            {
                id: 'generate_function',
                pattern: /(?:create|generate|write|make)\s+(?:a\s+)?(?:function|method|procedure)\s+(?:that|to|for)?\s*(.+)/i,
                intent: 'code_generation',
                confidence: 0.9,
                contextHints: ['function', 'method', 'procedure'],
                parameterExtractors: [
                    { name: 'description', regex: /(?:that|to|for)\s+(.+)$/i, type: 'string', required: true },
                    { name: 'language', regex: /(?:in|using)\s+(javascript|python|typescript|java|c\+\+|c#|go|rust|php)/i, type: 'string', required: false }
                ]
            },
            {
                id: 'generate_class',
                pattern: /(?:create|generate|write|make)\s+(?:a\s+)?(?:class|object|model)\s+(?:called|named)?\s*(\w+)?\s*(?:that|to|for)?\s*(.+)?/i,
                intent: 'code_generation',
                confidence: 0.85,
                contextHints: ['class', 'object', 'model'],
                parameterExtractors: [
                    { name: 'className', regex: /(?:called|named)\s+(\w+)/i, type: 'string', required: false },
                    { name: 'description', regex: /(?:that|to|for)\s+(.+)$/i, type: 'string', required: false }
                ]
            },
            {
                id: 'generate_component',
                pattern: /(?:create|generate|write|make)\s+(?:a\s+)?(?:react|vue|angular|svelte)?\s*component\s+(?:called|named)?\s*(\w+)?\s*(?:that|to|for)?\s*(.+)?/i,
                intent: 'code_generation',
                confidence: 0.9,
                contextHints: ['component', 'react', 'vue', 'angular'],
                parameterExtractors: [
                    { name: 'framework', regex: /(react|vue|angular|svelte)/i, type: 'string', required: false },
                    { name: 'componentName', regex: /component\s+(?:called|named)?\s*(\w+)/i, type: 'string', required: false },
                    { name: 'description', regex: /(?:that|to|for)\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // Code Explanation Intents
            {
                id: 'explain_code',
                pattern: /(?:explain|describe|tell me about|what does)\s+(?:this\s+)?(?:code|function|method|class|algorithm)?\s*(?:do|mean)?/i,
                intent: 'code_explanation',
                confidence: 0.95,
                contextHints: ['explain', 'describe', 'what'],
                parameterExtractors: [
                    { name: 'target', regex: /(code|function|method|class|algorithm|line)/i, type: 'string', required: false }
                ]
            },
            {
                id: 'how_it_works',
                pattern: /how\s+(?:does\s+)?(?:this\s+)?(work|function|operate|run)/i,
                intent: 'code_explanation',
                confidence: 0.9,
                contextHints: ['how', 'work', 'function'],
                parameterExtractors: []
            },

            // Refactoring Intents
            {
                id: 'refactor_code',
                pattern: /(?:refactor|improve|optimize|clean up|restructure)\s+(?:this\s+)?(?:code|function|method|class)?\s*(?:to|for)?\s*(.+)?/i,
                intent: 'refactoring',
                confidence: 0.9,
                contextHints: ['refactor', 'improve', 'optimize', 'clean'],
                parameterExtractors: [
                    { name: 'goal', regex: /(?:to|for)\s+(.+)$/i, type: 'string', required: false }
                ]
            },
            {
                id: 'make_it_better',
                pattern: /make\s+(?:this|it)\s+(?:better|cleaner|more efficient|faster|readable)/i,
                intent: 'refactoring',
                confidence: 0.85,
                contextHints: ['make', 'better', 'cleaner', 'efficient'],
                parameterExtractors: [
                    { name: 'improvement', regex: /(better|cleaner|more efficient|faster|readable)/i, type: 'string', required: false }
                ]
            },

            // Debugging Intents
            {
                id: 'debug_error',
                pattern: /(?:debug|fix|solve|resolve)\s+(?:this\s+)?(?:error|bug|issue|problem)\s*(.+)?/i,
                intent: 'debugging',
                confidence: 0.95,
                contextHints: ['debug', 'fix', 'error', 'bug'],
                parameterExtractors: [
                    { name: 'errorDescription', regex: /(?:error|bug|issue|problem)\s+(.+)$/i, type: 'string', required: false }
                ]
            },
            {
                id: 'whats_wrong',
                pattern: /(?:what's wrong|what's the problem|why doesn't this work|why is this failing)/i,
                intent: 'debugging',
                confidence: 0.9,
                contextHints: ['wrong', 'problem', 'failing'],
                parameterExtractors: []
            },

            // Testing Intents
            {
                id: 'generate_tests',
                pattern: /(?:create|generate|write|make)\s+(?:unit\s+)?(?:tests|test cases|test suite)\s+(?:for|of)?\s*(.+)?/i,
                intent: 'testing',
                confidence: 0.9,
                contextHints: ['test', 'unit', 'suite'],
                parameterExtractors: [
                    { name: 'target', regex: /(?:for|of)\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // Documentation Intents
            {
                id: 'add_comments',
                pattern: /(?:add|write|create|generate)\s+(?:comments|documentation|docstring|jsdoc)\s+(?:to|for)?\s*(.+)?/i,
                intent: 'documentation',
                confidence: 0.85,
                contextHints: ['comments', 'documentation', 'docstring'],
                parameterExtractors: [
                    { name: 'target', regex: /(?:to|for)\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // File Operations
            {
                id: 'create_file',
                pattern: /(?:create|make|generate)\s+(?:a\s+)?(?:new\s+)?file\s+(?:called|named)?\s*([^\s]+)?\s*(?:with|containing)?\s*(.+)?/i,
                intent: 'file_operation',
                confidence: 0.9,
                contextHints: ['create', 'file'],
                parameterExtractors: [
                    { name: 'filename', regex: /file\s+(?:called|named)?\s*([^\s]+)/i, type: 'string', required: false },
                    { name: 'content', regex: /(?:with|containing)\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // Project Setup
            {
                id: 'setup_project',
                pattern: /(?:create|setup|initialize|start)\s+(?:a\s+)?(?:new\s+)?(project|app|application)\s+(?:using|with)?\s*(react|vue|angular|node|express|fastapi)?\s*(.+)?/i,
                intent: 'project_setup',
                confidence: 0.9,
                contextHints: ['project', 'setup', 'initialize'],
                parameterExtractors: [
                    { name: 'projectType', regex: /(project|app|application)/i, type: 'string', required: false },
                    { name: 'framework', regex: /(react|vue|angular|node|express|fastapi)/i, type: 'string', required: false },
                    { name: 'description', regex: /(?:using|with)\s+\w+\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // Performance Optimization
            {
                id: 'optimize_performance',
                pattern: /(?:optimize|improve performance|make faster|speed up)\s+(?:this\s+)?(?:code|function|algorithm|query)?\s*(.+)?/i,
                intent: 'optimization',
                confidence: 0.85,
                contextHints: ['optimize', 'performance', 'faster', 'speed'],
                parameterExtractors: [
                    { name: 'target', regex: /(code|function|algorithm|query)/i, type: 'string', required: false },
                    { name: 'context', regex: /(?:code|function|algorithm|query)\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // Code Review
            {
                id: 'review_code',
                pattern: /(?:review|check|analyze|evaluate)\s+(?:this\s+)?(?:code|implementation|solution)\s*(?:for)?\s*(.+)?/i,
                intent: 'code_review',
                confidence: 0.8,
                contextHints: ['review', 'check', 'analyze'],
                parameterExtractors: [
                    { name: 'focus', regex: /(?:for)\s+(.+)$/i, type: 'string', required: false }
                ]
            },

            // Learning/Tutorial
            {
                id: 'learn_concept',
                pattern: /(?:teach me|show me|explain how to|learn about|understand)\s+(.+)/i,
                intent: 'learning',
                confidence: 0.8,
                contextHints: ['teach', 'show', 'learn', 'understand'],
                parameterExtractors: [
                    { name: 'topic', regex: /(?:teach me|show me|explain how to|learn about|understand)\s+(.+)$/i, type: 'string', required: true }
                ]
            },

            // General Help
            {
                id: 'general_help',
                pattern: /(?:help|assistance|support)\s+(?:with|me)?\s*(.+)?/i,
                intent: 'help',
                confidence: 0.6,
                contextHints: ['help', 'assistance', 'support'],
                parameterExtractors: [
                    { name: 'topic', regex: /(?:with|me)\s+(.+)$/i, type: 'string', required: false }
                ]
            }
        ];
    }

    async analyzeIntent(input: string, context?: Partial<IntentContext>): Promise<Intent> {
        // First, try pattern matching
        const patternResult = this.analyzeWithPatterns(input);
        
        // Then, enhance with AI-powered analysis
        const aiResult = await this.analyzeWithAI(input, context);
        
        // Combine and refine the results
        const finalIntent = this.combineResults(patternResult, aiResult, context);
        
        // Learn from the analysis
        this.recordIntentAnalysis(finalIntent);
        
        return finalIntent;
    }

    private analyzeWithPatterns(input: string): Intent | null {
        const normalizedInput = input.toLowerCase().trim();
        let bestMatch: { pattern: NLPPattern; confidence: number } | null = null;
        
        for (const pattern of this.patterns) {
            const match = pattern.pattern.exec(input);
            if (match) {
                const confidence = this.calculatePatternConfidence(pattern, match, input);
                if (!bestMatch || confidence > bestMatch.confidence) {
                    bestMatch = { pattern, confidence };
                }
            }
        }
        
        if (!bestMatch) return null;
        
        const parameters = this.extractParameters(bestMatch.pattern, input);
        
        return {
            name: bestMatch.pattern.intent,
            confidence: bestMatch.confidence,
            parameters,
            context: this.inferContext(bestMatch.pattern, parameters, input)
        };
    }

    private calculatePatternConfidence(pattern: NLPPattern, match: RegExpExecArray, input: string): number {
        let confidence = pattern.confidence;
        
        // Boost confidence for context hints
        for (const hint of pattern.contextHints) {
            if (input.toLowerCase().includes(hint)) {
                confidence += 0.05;
            }
        }
        
        // Boost confidence for parameter matches
        for (const extractor of pattern.parameterExtractors) {
            if (extractor.regex.test(input)) {
                confidence += 0.03;
            }
        }
        
        // Cap at 1.0
        return Math.min(1.0, confidence);
    }

    private extractParameters(pattern: NLPPattern, input: string): Record<string, any> {
        const parameters: Record<string, any> = {};
        
        for (const extractor of pattern.parameterExtractors) {
            const match = extractor.regex.exec(input);
            if (match && match[1]) {
                let value: any = match[1].trim();
                
                // Type conversion
                switch (extractor.type) {
                    case 'number':
                        value = parseFloat(value) || 0;
                        break;
                    case 'boolean':
                        value = ['true', 'yes', '1', 'on'].includes(value.toLowerCase());
                        break;
                    case 'array':
                        value = value.split(/[,\s]+/).filter((v: string) => v);
                        break;
                }
                
                parameters[extractor.name] = value;
            }
        }
        
        return parameters;
    }

    private inferContext(pattern: NLPPattern, parameters: Record<string, any>, input: string): IntentContext {
        const context: IntentContext = {
            domain: this.inferDomain(pattern, parameters, input),
            task: pattern.intent,
            urgency: this.inferUrgency(input),
            complexity: this.inferComplexity(input),
            scope: this.inferScope(input)
        };
        
        // Infer language from context
        const languageMatch = input.match(/(?:in|using|with)\s+(javascript|typescript|python|java|c\+\+|c#|go|rust|php|swift|kotlin)/i);
        if (languageMatch) {
            context.language = languageMatch[1]?.toLowerCase();
        }
        
        // Infer framework
        const frameworkMatch = input.match(/(react|vue|angular|svelte|express|fastapi|spring|django|flask)/i);
        if (frameworkMatch) {
            context.framework = frameworkMatch[1]?.toLowerCase();
        }
        
        return context;
    }

    private inferDomain(pattern: NLPPattern, parameters: Record<string, any>, input: string): IntentContext['domain'] {
        if (pattern.contextHints.some(hint => ['file', 'create', 'delete'].includes(hint))) {
            return 'file';
        }
        if (pattern.contextHints.some(hint => ['project', 'setup', 'initialize'].includes(hint))) {
            return 'project';
        }
        if (pattern.contextHints.some(hint => ['debug', 'error', 'bug'].includes(hint))) {
            return 'debug';
        }
        if (pattern.contextHints.some(hint => ['optimize', 'performance', 'faster'].includes(hint))) {
            return 'optimization';
        }
        if (pattern.contextHints.some(hint => ['comments', 'documentation', 'docstring'].includes(hint))) {
            return 'documentation';
        }
        
        return 'code';
    }

    private inferUrgency(input: string): IntentContext['urgency'] {
        const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'quick'];
        const highKeywords = ['important', 'priority', 'soon', 'fast'];
        
        const lowerInput = input.toLowerCase();
        
        if (urgentKeywords.some(keyword => lowerInput.includes(keyword))) {
            return 'critical';
        }
        if (highKeywords.some(keyword => lowerInput.includes(keyword))) {
            return 'high';
        }
        
        return 'normal';
    }

    private inferComplexity(input: string): IntentContext['complexity'] {
        const simpleKeywords = ['simple', 'basic', 'easy', 'quick', 'minimal'];
        const complexKeywords = ['complex', 'advanced', 'sophisticated', 'enterprise', 'scalable'];
        const expertKeywords = ['expert', 'professional', 'production', 'optimal'];
        
        const lowerInput = input.toLowerCase();
        
        if (expertKeywords.some(keyword => lowerInput.includes(keyword))) {
            return 'expert';
        }
        if (complexKeywords.some(keyword => lowerInput.includes(keyword))) {
            return 'complex';
        }
        if (simpleKeywords.some(keyword => lowerInput.includes(keyword))) {
            return 'simple';
        }
        
        return 'moderate';
    }

    private inferScope(input: string): IntentContext['scope'] {
        if (input.includes('line') || input.includes('this line')) {
            return 'line';
        }
        if (input.includes('function') || input.includes('method')) {
            return 'function';
        }
        if (input.includes('file') || input.includes('this file')) {
            return 'file';
        }
        if (input.includes('module') || input.includes('package')) {
            return 'module';
        }
        if (input.includes('project') || input.includes('entire') || input.includes('whole')) {
            return 'project';
        }
        
        return 'function'; // Default scope
    }

    private async analyzeWithAI(input: string, context?: Partial<IntentContext>): Promise<Intent | null> {
        try {
            const config = await this.configManager.getConfig();
            const provider = this.providerManager.getProvider(Object.keys(config.providers || {})[0] || 'claude');
            
            const analysisPrompt = `
Analyze this user request and extract the intent, parameters, and context:

User Input: "${input}"

${context ? `Additional Context: ${JSON.stringify(context)}` : ''}

Respond with a JSON object containing:
{
  "intent": "primary intent (code_generation, explanation, refactoring, debugging, etc.)",
  "confidence": 0.0-1.0,
  "parameters": {
    "key": "extracted values"
  },
  "context": {
    "domain": "code|file|project|debug|optimization|documentation|general",
    "task": "specific task description",
    "language": "programming language if mentioned",
    "framework": "framework if mentioned",
    "urgency": "low|normal|high|critical",
    "complexity": "simple|moderate|complex|expert",
    "scope": "line|function|file|module|project"
  },
  "subIntents": [
    "any secondary intents if present"
  ]
}

Be precise and only extract information that's clearly present in the input.`;

            const response = await (await provider).complete(analysisPrompt, {
                maxTokens: 1000,
                temperature: 0.3
            });
            
            try {
                const analyzed = JSON.parse(response);
                return {
                    name: analyzed.intent,
                    confidence: analyzed.confidence || 0.7,
                    parameters: analyzed.parameters || {},
                    context: {
                        domain: analyzed.context?.domain || 'code',
                        task: analyzed.context?.task || analyzed.intent,
                        language: analyzed.context?.language,
                        framework: analyzed.context?.framework,
                        urgency: analyzed.context?.urgency || 'normal',
                        complexity: analyzed.context?.complexity || 'moderate',
                        scope: analyzed.context?.scope || 'function'
                    },
                    subIntents: analyzed.subIntents?.map((si: string) => ({
                        name: si,
                        confidence: 0.5,
                        parameters: {},
                        context: analyzed.context
                    }))
                };
            } catch (parseError) {
                console.warn('Failed to parse AI intent analysis:', parseError);
                return null;
            }
        } catch (error) {
            console.warn('AI intent analysis failed:', error);
            return null;
        }
    }

    private combineResults(patternResult: Intent | null, aiResult: Intent | null, context?: Partial<IntentContext>): Intent {
        // If we have both results, combine them intelligently
        if (patternResult && aiResult) {
            const combinedConfidence = (patternResult.confidence + aiResult.confidence) / 2;
            
            return {
                name: patternResult.confidence > aiResult.confidence ? patternResult.name : aiResult.name,
                confidence: combinedConfidence,
                parameters: { ...patternResult.parameters, ...aiResult.parameters },
                context: {
                    ...patternResult.context,
                    ...aiResult.context,
                    ...context
                },
                subIntents: aiResult.subIntents
            };
        }
        
        // Use whichever result we have
        const result = patternResult || aiResult;
        
        if (result) {
            return {
                ...result,
                context: { ...result.context, ...context }
            };
        }
        
        // Fallback - general help intent
        return {
            name: 'general',
            confidence: 0.3,
            parameters: { query: context },
            context: {
                domain: 'general',
                task: 'general_help',
                urgency: 'normal',
                complexity: 'moderate',
                scope: 'function',
                ...context
            }
        };
    }

    private recordIntentAnalysis(intent: Intent): void {
        this.intentHistory.push({
            intent,
            timestamp: new Date(),
            success: true // Will be updated based on user feedback
        });
        
        // Keep only recent history
        if (this.intentHistory.length > 1000) {
            this.intentHistory = this.intentHistory.slice(-1000);
        }
    }

    // Learning and adaptation methods
    updateIntentSuccess(intentId: string, success: boolean): void {
        const entry = this.intentHistory.find(h => h.intent.name === intentId);
        if (entry) {
            entry.success = success;
        }
    }

    getIntentStats(): Record<string, { count: number; successRate: number }> {
        const stats: Record<string, { count: number; successRate: number }> = {};
        
        for (const entry of this.intentHistory) {
            const intentName = entry.intent.name;
            if (!stats[intentName]) {
                stats[intentName] = { count: 0, successRate: 0 };
            }
            
            stats[intentName].count++;
            if (entry.success) {
                stats[intentName].successRate++;
            }
        }
        
        // Convert to percentages
        for (const intentName in stats) {
            stats[intentName]!.successRate = stats[intentName]!.successRate / stats[intentName]!.count;
        }
        
        return stats;
    }

    addCustomPattern(pattern: NLPPattern): void {
        this.patterns.push(pattern);
    }

    removePattern(id: string): void {
        this.patterns = this.patterns.filter(p => p.id !== id);
    }

    getPatterns(): NLPPattern[] {
        return [...this.patterns];
    }
}