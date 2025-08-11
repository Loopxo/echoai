import { AdvancedNLPIntentAnalyzer, Intent, IntentContext } from './intent-analyzer.js';
import { ProviderManager } from '../../core/provider-manager.js';
import type { Config } from '../../config/index.js';
import { StudioAgentRegistry, StudioAgentCapability } from '../studio-agent-registry.js';

export interface AgentCapability {
    name: string;
    description: string;
    intents: string[];
    contexts: IntentContext['domain'][];
    complexity: IntentContext['complexity'][];
    priority: number;
    isActive: boolean;
}

export interface AgentExecution {
    id: string;
    intent: Intent;
    agent: string;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    result?: any;
    error?: string;
    metrics: {
        processingTime: number;
        quality: number;
        userSatisfaction?: number;
    };
}

export interface ContextualPrompt {
    basePrompt: string;
    enhancedPrompt: string;
    context: IntentContext;
    metadata: {
        tokens: number;
        complexity: number;
        specificity: number;
    };
}

export class AdvancedAgentOrchestrator {
    private intentAnalyzer: AdvancedNLPIntentAnalyzer;
    private providerManager: ProviderManager;
    private agents: Map<string, AgentCapability> = new Map();
    private studioAgents: Map<string, StudioAgentCapability> = new Map();
    private executionHistory: AgentExecution[] = [];
    private contextualPrompts: ContextualPrompt[] = [];
    private useStudioAgents: boolean = true;

    constructor(private config: Config | any) {
        this.intentAnalyzer = new AdvancedNLPIntentAnalyzer(config);
        this.providerManager = new ProviderManager(config);
        this.initializeAgents();
        this.initializeStudioAgents();
    }

    private initializeAgents(): void {
        const defaultAgents: AgentCapability[] = [
            {
                name: 'code_generator',
                description: 'Generates high-quality code based on specifications',
                intents: ['code_generation'],
                contexts: ['code', 'project'],
                complexity: ['simple', 'moderate', 'complex', 'expert'],
                priority: 10,
                isActive: true
            },
            {
                name: 'code_explainer',
                description: 'Provides detailed explanations of code functionality',
                intents: ['code_explanation', 'learning'],
                contexts: ['code', 'general'],
                complexity: ['simple', 'moderate', 'complex'],
                priority: 8,
                isActive: true
            },
            {
                name: 'refactoring_specialist',
                description: 'Improves code structure, performance, and maintainability',
                intents: ['refactoring', 'optimization'],
                contexts: ['code', 'optimization'],
                complexity: ['moderate', 'complex', 'expert'],
                priority: 9,
                isActive: true
            },
            {
                name: 'debug_expert',
                description: 'Identifies and fixes bugs in code',
                intents: ['debugging'],
                contexts: ['debug', 'code'],
                complexity: ['simple', 'moderate', 'complex', 'expert'],
                priority: 10,
                isActive: true
            },
            {
                name: 'test_engineer',
                description: 'Creates comprehensive test suites and test cases',
                intents: ['testing'],
                contexts: ['code'],
                complexity: ['moderate', 'complex', 'expert'],
                priority: 7,
                isActive: true
            },
            {
                name: 'documentation_writer',
                description: 'Creates clear and comprehensive documentation',
                intents: ['documentation'],
                contexts: ['documentation', 'code'],
                complexity: ['simple', 'moderate', 'complex'],
                priority: 6,
                isActive: true
            },
            {
                name: 'file_manager',
                description: 'Handles file operations and project structure',
                intents: ['file_operation'],
                contexts: ['file', 'project'],
                complexity: ['simple', 'moderate'],
                priority: 5,
                isActive: true
            },
            {
                name: 'project_architect',
                description: 'Designs and sets up project structures and configurations',
                intents: ['project_setup'],
                contexts: ['project'],
                complexity: ['moderate', 'complex', 'expert'],
                priority: 8,
                isActive: true
            },
            {
                name: 'performance_optimizer',
                description: 'Optimizes code and system performance',
                intents: ['optimization'],
                contexts: ['optimization', 'code'],
                complexity: ['complex', 'expert'],
                priority: 9,
                isActive: true
            },
            {
                name: 'code_reviewer',
                description: 'Provides thorough code reviews and suggestions',
                intents: ['code_review'],
                contexts: ['code'],
                complexity: ['moderate', 'complex', 'expert'],
                priority: 7,
                isActive: true
            },
            {
                name: 'learning_assistant',
                description: 'Helps users learn programming concepts and best practices',
                intents: ['learning'],
                contexts: ['general', 'code'],
                complexity: ['simple', 'moderate', 'complex'],
                priority: 6,
                isActive: true
            },
            {
                name: 'general_helper',
                description: 'Provides general assistance and guidance',
                intents: ['help', 'general'],
                contexts: ['general'],
                complexity: ['simple', 'moderate'],
                priority: 3,
                isActive: true
            }
        ];

        defaultAgents.forEach(agent => {
            this.agents.set(agent.name, agent);
        });

        console.log(`✅ Initialized ${defaultAgents.length} default Echo agents`);
    }

    private initializeStudioAgents(): void {
        const studioAgents = StudioAgentRegistry.getAllAgents();
        
        studioAgents.forEach(agent => {
            this.studioAgents.set(agent.name, agent);
        });

        const stats = StudioAgentRegistry.getAgentStats();
        console.log(`🎭 Initialized ${stats.totalAgents} studio agents across ${Object.keys(stats.departmentCounts).length} departments`);
        console.log(`📊 Department breakdown: ${JSON.stringify(stats.departmentCounts, null, 2)}`);
    }

    async processRequest(input: string, context?: Partial<IntentContext>): Promise<AgentExecution> {
        const startTime = new Date();
        const executionId = this.generateExecutionId();

        try {
            // Analyze intent
            const intent = await this.intentAnalyzer.analyzeIntent(input, context);
            
            // Select best agent
            const selectedAgent = this.selectAgent(intent);
            
            // Create contextual prompt
            const contextualPrompt = await this.createContextualPrompt(input, intent, selectedAgent);
            
            // Execute with selected agent
            const execution: AgentExecution = {
                id: executionId,
                intent,
                agent: selectedAgent.name,
                startTime,
                status: 'running',
                metrics: {
                    processingTime: 0,
                    quality: 0
                }
            };

            this.executionHistory.push(execution);

            try {
                const result = await this.executeWithAgent(selectedAgent, contextualPrompt, intent);
                
                execution.endTime = new Date();
                execution.status = 'completed';
                execution.result = result;
                execution.metrics.processingTime = execution.endTime.getTime() - startTime.getTime();
                execution.metrics.quality = await this.assessResultQuality(result, intent);

            } catch (error) {
                execution.endTime = new Date();
                execution.status = 'failed';
                execution.error = error instanceof Error ? error.message : String(error);
                execution.metrics.processingTime = execution.endTime.getTime() - startTime.getTime();
            }

            return execution;

        } catch (error) {
            const failedExecution: AgentExecution = {
                id: executionId,
                intent: {
                    name: 'unknown',
                    confidence: 0,
                    parameters: {},
                    context: { domain: 'general', task: 'unknown', urgency: 'normal', complexity: 'moderate', scope: 'function' }
                },
                agent: 'general_helper',
                startTime,
                endTime: new Date(),
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
                metrics: {
                    processingTime: Date.now() - startTime.getTime(),
                    quality: 0
                }
            };

            this.executionHistory.push(failedExecution);
            return failedExecution;
        }
    }

    private selectAgent(intent: Intent): AgentCapability | StudioAgentCapability {
        let eligibleAgents: (AgentCapability | StudioAgentCapability)[] = [];

        // First try studio agents if enabled
        if (this.useStudioAgents) {
            const studioAgents = Array.from(this.studioAgents.values()).filter(agent => 
                agent.isActive && 
                agent.intents.includes(intent.name) &&
                agent.contexts.includes(intent.context.domain as any) &&
                agent.complexity.includes(intent.context.complexity as any)
            );
            eligibleAgents.push(...studioAgents);
        }

        // Add default agents as fallback
        const defaultAgents = Array.from(this.agents.values()).filter(agent => 
            agent.isActive && 
            agent.intents.includes(intent.name) &&
            agent.contexts.includes(intent.context.domain) &&
            agent.complexity.includes(intent.context.complexity)
        );
        eligibleAgents.push(...defaultAgents);

        if (eligibleAgents.length === 0) {
            // Fallback to general helper
            const fallbackAgent = this.agents.get('general_helper');
            if (fallbackAgent) {
                return fallbackAgent;
            }
            // If no fallback, create a minimal agent
            return {
                name: 'general_helper',
                description: 'General assistance agent',
                intents: ['help', 'general'],
                contexts: ['general'],
                complexity: ['simple', 'moderate'],
                priority: 1,
                isActive: true
            };
        }

        // Sort by priority and confidence compatibility, prefer studio agents
        eligibleAgents.sort((a, b) => {
            const aScore = a.priority + (intent.confidence * 10) + (this.isStudioAgent(a) ? 5 : 0);
            const bScore = b.priority + (intent.confidence * 10) + (this.isStudioAgent(b) ? 5 : 0);
            return bScore - aScore;
        });

        return eligibleAgents[0]!;
    }

    private isStudioAgent(agent: AgentCapability | StudioAgentCapability): boolean {
        return 'department' in agent;
    }

    private async createContextualPrompt(input: string, intent: Intent, agent: AgentCapability | StudioAgentCapability): Promise<ContextualPrompt> {
        const basePrompt = input;
        
        const contextEnhancements = [
            `Intent: ${intent.name} (confidence: ${intent.confidence.toFixed(2)})`,
            `Context: ${intent.context.domain} domain, ${intent.context.complexity} complexity`,
            `Agent: ${agent.name} - ${agent.description}`,
            `Task Scope: ${intent.context.scope}`,
            `Urgency: ${intent.context.urgency}`
        ];

        if (intent.context.language) {
            contextEnhancements.push(`Language: ${intent.context.language}`);
        }

        if (intent.context.framework) {
            contextEnhancements.push(`Framework: ${intent.context.framework}`);
        }

        if (Object.keys(intent.parameters).length > 0) {
            contextEnhancements.push(`Parameters: ${JSON.stringify(intent.parameters)}`);
        }

        // Add agent-specific context
        const agentContext = await this.getAgentSpecificContext(agent, intent);
        if (agentContext) {
            contextEnhancements.push(`Agent Context: ${agentContext}`);
        }

        const enhancedPrompt = `${basePrompt}

Context Information:
${contextEnhancements.map(c => `• ${c}`).join('\n')}

Please provide a response that:
1. Addresses the specific intent: ${intent.name}
2. Matches the complexity level: ${intent.context.complexity}
3. Focuses on the scope: ${intent.context.scope}
4. Considers the urgency: ${intent.context.urgency}
${intent.context.language ? `5. Uses ${intent.context.language} programming language` : ''}
${intent.context.framework ? `6. Incorporates ${intent.context.framework} framework patterns` : ''}`;

        const contextualPrompt: ContextualPrompt = {
            basePrompt,
            enhancedPrompt,
            context: intent.context,
            metadata: {
                tokens: this.estimateTokens(enhancedPrompt),
                complexity: this.calculatePromptComplexity(intent),
                specificity: intent.confidence
            }
        };

        this.contextualPrompts.push(contextualPrompt);
        return contextualPrompt;
    }

    private async getAgentSpecificContext(agent: AgentCapability | StudioAgentCapability, intent: Intent): Promise<string | null> {
        // For studio agents, use their comprehensive system prompt
        if (this.isStudioAgent(agent)) {
            const systemPrompt = StudioAgentRegistry.getAgentSystemPrompt(agent.name);
            if (systemPrompt) {
                return systemPrompt;
            }
        }

        // Default Echo agents context
        switch (agent.name) {
            case 'code_generator':
                return 'Focus on writing clean, efficient, and well-structured code with proper error handling and comments.';
            
            case 'refactoring_specialist':
                return 'Analyze the code for improvements in structure, performance, readability, and maintainability. Suggest specific refactoring patterns.';
            
            case 'debug_expert':
                return 'Systematically identify potential issues, analyze error patterns, and provide step-by-step debugging solutions.';
            
            case 'test_engineer':
                return 'Create comprehensive test cases covering edge cases, error conditions, and positive/negative scenarios.';
            
            case 'documentation_writer':
                return 'Write clear, comprehensive documentation with examples, use cases, and implementation details.';
            
            case 'performance_optimizer':
                return 'Focus on algorithmic efficiency, memory optimization, and scalability improvements with measurable metrics.';
            
            case 'project_architect':
                return 'Consider scalability, maintainability, security, and industry best practices in project design.';
            
            default:
                return null;
        }
    }

    private async executeWithAgent(agent: AgentCapability | StudioAgentCapability, prompt: ContextualPrompt, intent: Intent): Promise<any> {
        const provider = this.providerManager.getProvider(this.config.provider || 'claude');
        
        // Select optimal model based on agent and complexity
        const modelOptions = this.getModelOptionsForAgent(agent, intent);
        
        try {
            const response = await (await provider).complete(
                prompt.enhancedPrompt,
                {
                    temperature: modelOptions.temperature,
                    maxTokens: modelOptions.maxTokens,
                    model: modelOptions.model
                }
            );

            return {
                content: response,
                agent: agent.name,
                intent: intent.name,
                confidence: intent.confidence,
                metadata: {
                    model: modelOptions.model,
                    tokens: this.estimateTokens(response),
                    processingApproach: agent.description
                }
            };

        } catch (error) {
            throw new Error(`Agent ${agent.name} execution failed: ${error}`);
        }
    }

    private getModelOptionsForAgent(agent: AgentCapability | StudioAgentCapability, intent: Intent): {
        model?: string;
        temperature: number;
        maxTokens: number;
    } {
        const baseOptions = {
            temperature: 0.3,
            maxTokens: 2000
        };

        switch (agent.name) {
            case 'code_generator':
                return { ...baseOptions, temperature: 0.2, maxTokens: 3000 };
            
            case 'refactoring_specialist':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2500 };
            
            case 'debug_expert':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2000 };
            
            case 'documentation_writer':
                return { ...baseOptions, temperature: 0.4, maxTokens: 2500 };
            
            case 'code_explainer':
            case 'learning_assistant':
                return { ...baseOptions, temperature: 0.5, maxTokens: 2000 };
            
            case 'performance_optimizer':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2500 };
            
            case 'test_engineer':
                return { ...baseOptions, temperature: 0.2, maxTokens: 2000 };
            
            // Studio agents optimized settings
            case 'ai_engineer':
                return { ...baseOptions, temperature: 0.2, maxTokens: 3500 };
            case 'backend_architect':
                return { ...baseOptions, temperature: 0.1, maxTokens: 3000 };
            case 'devops_automator':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2500 };
            case 'frontend_developer':
                return { ...baseOptions, temperature: 0.3, maxTokens: 3000 };
            case 'mobile_app_builder':
                return { ...baseOptions, temperature: 0.2, maxTokens: 3000 };
            case 'rapid_prototyper':
                return { ...baseOptions, temperature: 0.4, maxTokens: 2500 };
            case 'test_writer_fixer':
                return { ...baseOptions, temperature: 0.2, maxTokens: 2000 };
            case 'brand_guardian':
                return { ...baseOptions, temperature: 0.4, maxTokens: 2500 };
            case 'ui_designer':
                return { ...baseOptions, temperature: 0.5, maxTokens: 2500 };
            case 'ux_researcher':
                return { ...baseOptions, temperature: 0.3, maxTokens: 2000 };
            case 'visual_storyteller':
                return { ...baseOptions, temperature: 0.6, maxTokens: 2500 };
            case 'whimsy_injector':
                return { ...baseOptions, temperature: 0.7, maxTokens: 2000 };
            case 'growth_hacker':
                return { ...baseOptions, temperature: 0.4, maxTokens: 3000 };
            case 'content_creator':
                return { ...baseOptions, temperature: 0.6, maxTokens: 2500 };
            case 'sprint_prioritizer':
                return { ...baseOptions, temperature: 0.2, maxTokens: 2500 };
            case 'feedback_synthesizer':
                return { ...baseOptions, temperature: 0.3, maxTokens: 2000 };
            case 'trend_researcher':
                return { ...baseOptions, temperature: 0.4, maxTokens: 3000 };
            case 'api_tester':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2000 };
            case 'performance_benchmarker':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2500 };
            case 'workflow_optimizer':
                return { ...baseOptions, temperature: 0.2, maxTokens: 2500 };
            case 'analytics_reporter':
                return { ...baseOptions, temperature: 0.3, maxTokens: 2500 };
            case 'infrastructure_maintainer':
                return { ...baseOptions, temperature: 0.1, maxTokens: 2500 };
            
            default:
                return baseOptions;
        }
    }

    private async assessResultQuality(result: any, intent: Intent): Promise<number> {
        // Implement quality assessment based on various criteria
        let qualityScore = 0.5; // Base score
        
        if (result.content) {
            const content = result.content;
            
            // Length appropriateness
            if (content.length > 50 && content.length < 5000) {
                qualityScore += 0.1;
            }
            
            // Code presence for code-related intents
            if (['code_generation', 'refactoring', 'debugging'].includes(intent.name)) {
                if (content.includes('```') || content.includes('function') || content.includes('class')) {
                    qualityScore += 0.2;
                }
            }
            
            // Explanation quality for explanation intents
            if (intent.name === 'code_explanation') {
                if (content.includes('because') || content.includes('this works by') || content.includes('the purpose')) {
                    qualityScore += 0.2;
                }
            }
            
            // Structure and formatting
            if (content.includes('\n') && (content.includes('##') || content.includes('1.') || content.includes('•'))) {
                qualityScore += 0.1;
            }
        }
        
        return Math.min(1.0, qualityScore);
    }

    private calculatePromptComplexity(intent: Intent): number {
        let complexity = 0.5;
        
        // Intent complexity
        const complexityMap = {
            'simple': 0.2,
            'moderate': 0.5,
            'complex': 0.8,
            'expert': 1.0
        };
        
        complexity += complexityMap[intent.context.complexity] || 0.5;
        
        // Parameters complexity
        complexity += Math.min(0.3, Object.keys(intent.parameters).length * 0.1);
        
        // Sub-intents complexity
        if (intent.subIntents && intent.subIntents.length > 0) {
            complexity += Math.min(0.2, intent.subIntents.length * 0.05);
        }
        
        return Math.min(1.0, complexity);
    }

    private estimateTokens(text: string): number {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // Management and analytics methods
    addAgent(agent: AgentCapability): void {
        this.agents.set(agent.name, agent);
    }

    removeAgent(name: string): void {
        this.agents.delete(name);
    }

    getAgent(name: string): AgentCapability | undefined {
        return this.agents.get(name);
    }

    listAgents(): AgentCapability[] {
        return Array.from(this.agents.values());
    }

    listStudioAgents(): StudioAgentCapability[] {
        return Array.from(this.studioAgents.values());
    }

    listAllAgents(): (AgentCapability | StudioAgentCapability)[] {
        return [...this.listAgents(), ...this.listStudioAgents()];
    }

    getAgentsByDepartment(department: StudioAgentCapability['department']): StudioAgentCapability[] {
        return StudioAgentRegistry.getAgentsByDepartment(department);
    }

    getStudioAgentStats() {
        return StudioAgentRegistry.getAgentStats();
    }

    toggleStudioAgents(enabled: boolean): void {
        this.useStudioAgents = enabled;
        console.log(`🎭 Studio agents ${enabled ? 'enabled' : 'disabled'}`);
    }

    getExecutionHistory(limit = 100): AgentExecution[] {
        return this.executionHistory.slice(-limit);
    }

    getAgentPerformanceStats(): Record<string, {
        executions: number;
        successRate: number;
        averageQuality: number;
        averageProcessingTime: number;
    }> {
        const stats: Record<string, any> = {};
        
        for (const execution of this.executionHistory) {
            const agentName = execution.agent;
            if (!stats[agentName]) {
                stats[agentName] = {
                    executions: 0,
                    successes: 0,
                    totalQuality: 0,
                    totalTime: 0
                };
            }
            
            stats[agentName].executions++;
            if (execution.status === 'completed') {
                stats[agentName].successes++;
                stats[agentName].totalQuality += execution.metrics.quality;
            }
            stats[agentName].totalTime += execution.metrics.processingTime;
        }
        
        // Convert to final format
        const finalStats: Record<string, any> = {};
        for (const agentName in stats) {
            const agentStats = stats[agentName];
            finalStats[agentName] = {
                executions: agentStats.executions,
                successRate: agentStats.successes / agentStats.executions,
                averageQuality: agentStats.totalQuality / agentStats.successes || 0,
                averageProcessingTime: agentStats.totalTime / agentStats.executions
            };
        }
        
        return finalStats;
    }

    updateUserFeedback(executionId: string, satisfaction: number): void {
        const execution = this.executionHistory.find(e => e.id === executionId);
        if (execution) {
            execution.metrics.userSatisfaction = satisfaction;
            
            // Update intent analyzer with feedback
            this.intentAnalyzer.updateIntentSuccess(execution.intent.name, satisfaction > 0.7);
        }
    }

    optimizeAgentSelection(): void {
        const stats = this.getAgentPerformanceStats();
        
        // Adjust agent priorities based on performance
        for (const [agentName, agentStats] of Object.entries(stats)) {
            const agent = this.agents.get(agentName);
            if (agent) {
                // Boost priority for high-performing agents
                if (agentStats.successRate > 0.9 && agentStats.averageQuality > 0.8) {
                    agent.priority = Math.min(10, agent.priority + 1);
                }
                // Reduce priority for poor-performing agents
                else if (agentStats.successRate < 0.5 || agentStats.averageQuality < 0.4) {
                    agent.priority = Math.max(1, agent.priority - 1);
                }
            }
        }
    }
}