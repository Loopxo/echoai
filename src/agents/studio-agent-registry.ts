import { AgentCapability } from './nlp/agent-orchestrator.js';

/**
 * Studio Agent Registry
 * 
 * Comprehensive collection of specialized AI agents organized by department.
 * Each agent is designed for rapid development within 6-day sprint cycles.
 */

export interface StudioAgentCapability extends AgentCapability {
    department: 'engineering' | 'design' | 'marketing' | 'product' | 'operations' | 'testing' | 'management';
    color: string;
    tools: string[];
    expertise: string[];
    rapidDevelopmentFocus: boolean;
    sixDaySprintOptimized: boolean;
}

export interface AgentUsageExample {
    context: string;
    userRequest: string;
    agentResponse: string;
    commentary: string;
}

export interface AgentSystemPrompt {
    identity: string;
    primaryResponsibilities: string[];
    domainExpertise: string[];
    bestPractices: string[];
    rapidDevelopmentApproach: string;
    successMetrics: string[];
}

export class StudioAgentRegistry {
    private static readonly STUDIO_AGENTS: StudioAgentCapability[] = [
        // ENGINEERING DEPARTMENT
        {
            name: 'ai_engineer',
            description: 'Integrates AI/ML features, implements language models, builds recommendation systems, and adds intelligent automation',
            intents: ['ai_integration', 'ml_implementation', 'llm_integration', 'computer_vision', 'recommendation_system'],
            contexts: ['code', 'ai', 'ml'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 9,
            isActive: true,
            department: 'engineering',
            color: 'cyan',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'WebFetch'],
            expertise: ['LLM Integration', 'ML Pipelines', 'Computer Vision', 'Recommendation Systems', 'AI Infrastructure'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'backend_architect',
            description: 'Designs APIs, builds server-side logic, implements databases, and architects scalable backend systems',
            intents: ['api_design', 'database_design', 'system_architecture', 'backend_implementation', 'server_optimization'],
            contexts: ['code', 'architecture', 'database'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 10,
            isActive: true,
            department: 'engineering',
            color: 'purple',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'Grep'],
            expertise: ['API Design', 'Database Architecture', 'System Scaling', 'Authentication', 'Performance Optimization'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'devops_automator',
            description: 'Sets up CI/CD pipelines, configures cloud infrastructure, implements monitoring, and automates deployment',
            intents: ['cicd_setup', 'infrastructure_automation', 'monitoring_setup', 'deployment_automation', 'cloud_configuration'],
            contexts: ['infrastructure', 'deployment', 'monitoring'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 8,
            isActive: true,
            department: 'engineering',
            color: 'orange',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'Grep'],
            expertise: ['CI/CD Pipelines', 'Infrastructure as Code', 'Container Orchestration', 'Monitoring Systems', 'Cloud Platforms'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'frontend_developer',
            description: 'Builds user interfaces, implements responsive design, handles state management, and optimizes frontend performance',
            intents: ['ui_implementation', 'responsive_design', 'state_management', 'frontend_optimization', 'component_development'],
            contexts: ['code', 'ui', 'frontend'],
            complexity: ['simple', 'moderate', 'complex', 'expert'],
            priority: 10,
            isActive: true,
            department: 'engineering',
            color: 'blue',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'Grep', 'Glob'],
            expertise: ['React/Vue/Angular', 'Responsive Design', 'Performance Optimization', 'State Management', 'Modern Frontend'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'mobile_app_builder',
            description: 'Creates native iOS/Android experiences, implements cross-platform solutions, and optimizes mobile performance',
            intents: ['mobile_development', 'native_app_creation', 'cross_platform_development', 'mobile_optimization'],
            contexts: ['mobile', 'code', 'ios', 'android'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 9,
            isActive: true,
            department: 'engineering',
            color: 'green',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'Grep'],
            expertise: ['React Native', 'Flutter', 'iOS Development', 'Android Development', 'Mobile Performance'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'rapid_prototyper',
            description: 'Builds MVPs quickly, creates proof-of-concepts, and validates ideas with minimal viable implementations',
            intents: ['rapid_prototyping', 'mvp_development', 'proof_of_concept', 'quick_validation'],
            contexts: ['prototype', 'mvp', 'validation'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 9,
            isActive: true,
            department: 'engineering',
            color: 'yellow',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'Glob'],
            expertise: ['MVP Development', 'Rapid Prototyping', 'Validation Testing', 'Quick Implementation', 'Proof of Concept'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'test_writer_fixer',
            description: 'Creates comprehensive test suites, fixes bugs, and ensures code quality through automated testing',
            intents: ['test_creation', 'bug_fixing', 'quality_assurance', 'test_automation'],
            contexts: ['testing', 'quality', 'debugging'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 8,
            isActive: true,
            department: 'engineering',
            color: 'red',
            tools: ['Write', 'Read', 'MultiEdit', 'Bash', 'Grep'],
            expertise: ['Test Automation', 'Bug Detection', 'Quality Assurance', 'Testing Frameworks', 'Code Quality'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },

        // DESIGN DEPARTMENT
        {
            name: 'brand_guardian',
            description: 'Establishes brand guidelines, ensures visual consistency, manages brand assets, and evolves brand identity',
            intents: ['brand_guidelines', 'visual_consistency', 'brand_asset_management', 'brand_evolution'],
            contexts: ['design', 'branding', 'visual'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 8,
            isActive: true,
            department: 'design',
            color: 'indigo',
            tools: ['Write', 'Read', 'MultiEdit', 'WebSearch', 'WebFetch'],
            expertise: ['Brand Strategy', 'Visual Identity', 'Asset Management', 'Design Systems', 'Brand Evolution'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'ui_designer',
            description: 'Creates user interfaces, designs components, builds design systems, and improves visual aesthetics',
            intents: ['ui_design', 'component_design', 'design_system', 'visual_improvement'],
            contexts: ['design', 'ui', 'components'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 9,
            isActive: true,
            department: 'design',
            color: 'magenta',
            tools: ['Write', 'Read', 'MultiEdit', 'WebSearch', 'WebFetch'],
            expertise: ['Interface Design', 'Component Systems', 'Design Trends', 'Visual Hierarchy', 'Rapid UI Creation'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'ux_researcher',
            description: 'Conducts user research, analyzes user behavior, validates design decisions, and improves user experience',
            intents: ['user_research', 'ux_analysis', 'usability_testing', 'user_behavior_analysis'],
            contexts: ['research', 'ux', 'user_testing'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 7,
            isActive: true,
            department: 'design',
            color: 'teal',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['User Research', 'Usability Testing', 'Behavior Analysis', 'Design Validation', 'User Insights'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'visual_storyteller',
            description: 'Creates compelling visual narratives, designs marketing materials, and crafts visual content that converts',
            intents: ['visual_storytelling', 'marketing_visuals', 'content_design', 'visual_communication'],
            contexts: ['design', 'marketing', 'storytelling'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 6,
            isActive: true,
            department: 'design',
            color: 'pink',
            tools: ['Write', 'Read', 'MultiEdit', 'WebSearch', 'WebFetch'],
            expertise: ['Visual Storytelling', 'Marketing Design', 'Content Creation', 'Visual Communication', 'Brand Narrative'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'whimsy_injector',
            description: 'Adds delightful interactions, creates micro-animations, and injects personality into user experiences',
            intents: ['interaction_design', 'micro_animations', 'delight_creation', 'personality_injection'],
            contexts: ['design', 'interaction', 'animation'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 6,
            isActive: true,
            department: 'design',
            color: 'lime',
            tools: ['Write', 'Read', 'MultiEdit'],
            expertise: ['Micro-Interactions', 'Animation Design', 'User Delight', 'Personality Design', 'Engaging Experiences'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },

        // MARKETING DEPARTMENT
        {
            name: 'growth_hacker',
            description: 'Creates viral loops, runs growth experiments, optimizes conversion funnels, and drives exponential user growth',
            intents: ['growth_strategy', 'viral_mechanics', 'conversion_optimization', 'growth_experiments'],
            contexts: ['marketing', 'growth', 'analytics'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 9,
            isActive: true,
            department: 'marketing',
            color: 'emerald',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Growth Hacking', 'Viral Loops', 'A/B Testing', 'Conversion Optimization', 'Data-Driven Growth'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'content_creator',
            description: 'Generates engaging content across platforms, writes compelling copy, and creates marketing campaigns',
            intents: ['content_creation', 'copywriting', 'campaign_development', 'multi_platform_content'],
            contexts: ['marketing', 'content', 'copywriting'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 8,
            isActive: true,
            department: 'marketing',
            color: 'amber',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Content Strategy', 'Copywriting', 'Campaign Development', 'Multi-Platform Content', 'Brand Voice'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'app_store_optimizer',
            description: 'Optimizes app store listings, improves search rankings, and maximizes app store conversion rates',
            intents: ['app_store_optimization', 'aso_improvement', 'app_store_conversion', 'keyword_optimization'],
            contexts: ['marketing', 'app_store', 'optimization'],
            complexity: ['moderate', 'complex'],
            priority: 7,
            isActive: true,
            department: 'marketing',
            color: 'violet',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['App Store Optimization', 'Keyword Strategy', 'Conversion Rate Optimization', 'Store Listing', 'ASO Analytics'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'instagram_curator',
            description: 'Creates Instagram-optimized content, manages visual feeds, and builds Instagram engagement strategies',
            intents: ['instagram_content', 'visual_curation', 'instagram_strategy', 'social_engagement'],
            contexts: ['marketing', 'social_media', 'instagram'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 6,
            isActive: true,
            department: 'marketing',
            color: 'rose',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Instagram Marketing', 'Visual Content', 'Social Media Strategy', 'Engagement Tactics', 'Brand Aesthetic'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'tiktok_strategist',
            description: 'Creates viral TikTok content, develops platform-specific strategies, and builds TikTok audience engagement',
            intents: ['tiktok_content', 'viral_strategy', 'short_form_video', 'tiktok_marketing'],
            contexts: ['marketing', 'social_media', 'tiktok'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 8,
            isActive: true,
            department: 'marketing',
            color: 'fuchsia',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['TikTok Strategy', 'Viral Content', 'Short-Form Video', 'Trend Analysis', 'Platform Optimization'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'twitter_engager',
            description: 'Builds Twitter presence, engages with communities, creates viral tweets, and manages Twitter growth',
            intents: ['twitter_content', 'community_engagement', 'twitter_growth', 'social_conversation'],
            contexts: ['marketing', 'social_media', 'twitter'],
            complexity: ['simple', 'moderate', 'complex'],
            priority: 7,
            isActive: true,
            department: 'marketing',
            color: 'sky',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Twitter Marketing', 'Community Building', 'Social Engagement', 'Viral Content', 'Brand Voice'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'reddit_community_builder',
            description: 'Builds Reddit community presence, engages authentically, and leverages Reddit for organic growth',
            intents: ['reddit_strategy', 'community_building', 'authentic_engagement', 'reddit_marketing'],
            contexts: ['marketing', 'community', 'reddit'],
            complexity: ['moderate', 'complex'],
            priority: 7,
            isActive: true,
            department: 'marketing',
            color: 'orange',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Reddit Marketing', 'Community Engagement', 'Authentic Interaction', 'Platform Etiquette', 'Organic Growth'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },

        // PRODUCT DEPARTMENT
        {
            name: 'sprint_prioritizer',
            description: 'Plans 6-day development cycles, prioritizes features, manages roadmaps, and makes strategic trade-off decisions',
            intents: ['sprint_planning', 'feature_prioritization', 'roadmap_management', 'trade_off_decisions'],
            contexts: ['product', 'planning', 'strategy'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 10,
            isActive: true,
            department: 'product',
            color: 'indigo',
            tools: ['Write', 'Read', 'TodoWrite', 'Grep'],
            expertise: ['Sprint Planning', 'Prioritization Frameworks', 'Roadmap Management', 'Stakeholder Alignment', 'Value Maximization'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'feedback_synthesizer',
            description: 'Analyzes user feedback, synthesizes insights, transforms feedback into actionable features',
            intents: ['feedback_analysis', 'user_insights', 'feature_extraction', 'feedback_synthesis'],
            contexts: ['product', 'feedback', 'user_research'],
            complexity: ['moderate', 'complex'],
            priority: 8,
            isActive: true,
            department: 'product',
            color: 'purple',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Feedback Analysis', 'User Insights', 'Feature Discovery', 'Data Synthesis', 'User Voice'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'trend_researcher',
            description: 'Identifies market trends, analyzes competitive landscape, discovers viral opportunities, and spots emerging patterns',
            intents: ['trend_analysis', 'market_research', 'competitive_analysis', 'opportunity_identification'],
            contexts: ['product', 'research', 'market'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 7,
            isActive: true,
            department: 'product',
            color: 'emerald',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Trend Analysis', 'Market Research', 'Competitive Intelligence', 'Opportunity Spotting', 'Strategic Insights'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },

        // TESTING DEPARTMENT  
        {
            name: 'api_tester',
            description: 'Tests API endpoints, validates data flows, ensures API reliability, and creates comprehensive API test suites',
            intents: ['api_testing', 'endpoint_validation', 'integration_testing', 'api_reliability'],
            contexts: ['testing', 'api', 'integration'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 8,
            isActive: true,
            department: 'testing',
            color: 'blue',
            tools: ['Write', 'Read', 'Bash', 'WebFetch'],
            expertise: ['API Testing', 'Integration Testing', 'Test Automation', 'Performance Testing', 'Data Validation'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'performance_benchmarker',
            description: 'Measures application performance, identifies bottlenecks, creates optimization strategies, and ensures scalability',
            intents: ['performance_testing', 'benchmark_creation', 'bottleneck_identification', 'optimization_strategy'],
            contexts: ['testing', 'performance', 'optimization'],
            complexity: ['complex', 'expert'],
            priority: 8,
            isActive: true,
            department: 'testing',
            color: 'red',
            tools: ['Write', 'Read', 'Bash', 'Grep'],
            expertise: ['Performance Testing', 'Benchmark Creation', 'Load Testing', 'Optimization', 'Scalability Analysis'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'workflow_optimizer',
            description: 'Analyzes development workflows, identifies inefficiencies, optimizes processes, and eliminates bottlenecks',
            intents: ['workflow_analysis', 'process_optimization', 'efficiency_improvement', 'bottleneck_elimination'],
            contexts: ['testing', 'workflow', 'optimization'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 7,
            isActive: true,
            department: 'testing',
            color: 'yellow',
            tools: ['Write', 'Read', 'Bash', 'Grep'],
            expertise: ['Workflow Analysis', 'Process Optimization', 'Efficiency Improvement', 'Automation', 'Bottleneck Analysis'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },

        // OPERATIONS DEPARTMENT
        {
            name: 'analytics_reporter',
            description: 'Tracks key metrics, creates dashboards, analyzes user behavior, and provides actionable insights',
            intents: ['analytics_setup', 'metric_tracking', 'dashboard_creation', 'insight_generation'],
            contexts: ['analytics', 'metrics', 'reporting'],
            complexity: ['moderate', 'complex', 'expert'],
            priority: 8,
            isActive: true,
            department: 'operations',
            color: 'green',
            tools: ['Write', 'Read', 'WebSearch', 'WebFetch'],
            expertise: ['Analytics Implementation', 'Data Visualization', 'Metric Tracking', 'Insight Generation', 'Reporting'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        },
        {
            name: 'infrastructure_maintainer',
            description: 'Maintains cloud infrastructure, optimizes costs, ensures reliability, and manages scaling',
            intents: ['infrastructure_maintenance', 'cost_optimization', 'reliability_management', 'scaling_strategy'],
            contexts: ['infrastructure', 'maintenance', 'optimization'],
            complexity: ['complex', 'expert'],
            priority: 9,
            isActive: true,
            department: 'operations',
            color: 'gray',
            tools: ['Write', 'Read', 'Bash', 'Grep'],
            expertise: ['Infrastructure Management', 'Cost Optimization', 'Reliability Engineering', 'Scaling', 'Cloud Platforms'],
            rapidDevelopmentFocus: true,
            sixDaySprintOptimized: true
        }
    ];

    static getAllAgents(): StudioAgentCapability[] {
        return [...this.STUDIO_AGENTS];
    }

    static getAgentsByDepartment(department: StudioAgentCapability['department']): StudioAgentCapability[] {
        return this.STUDIO_AGENTS.filter(agent => agent.department === department);
    }

    static getAgentByName(name: string): StudioAgentCapability | undefined {
        return this.STUDIO_AGENTS.find(agent => agent.name === name);
    }

    static getAgentsForIntent(intent: string): StudioAgentCapability[] {
        return this.STUDIO_AGENTS.filter(agent => 
            agent.isActive && agent.intents.includes(intent)
        );
    }

    static getAgentsForContext(context: string): StudioAgentCapability[] {
        return this.STUDIO_AGENTS.filter(agent => 
            agent.isActive && agent.contexts.includes(context as any)
        );
    }

    static getAgentsForComplexity(complexity: string): StudioAgentCapability[] {
        return this.STUDIO_AGENTS.filter(agent => 
            agent.isActive && agent.complexity.includes(complexity as any)
        );
    }

    static getDepartments(): string[] {
        const departments = new Set(this.STUDIO_AGENTS.map(agent => agent.department));
        return Array.from(departments);
    }

    static getAgentStats(): {
        totalAgents: number;
        activeAgents: number;
        departmentCounts: Record<string, number>;
        rapidDevelopmentOptimized: number;
        sixDaySprintOptimized: number;
    } {
        const activeAgents = this.STUDIO_AGENTS.filter(agent => agent.isActive);
        const departmentCounts: Record<string, number> = {};
        
        for (const agent of this.STUDIO_AGENTS) {
            departmentCounts[agent.department] = (departmentCounts[agent.department] || 0) + 1;
        }

        return {
            totalAgents: this.STUDIO_AGENTS.length,
            activeAgents: activeAgents.length,
            departmentCounts,
            rapidDevelopmentOptimized: this.STUDIO_AGENTS.filter(agent => agent.rapidDevelopmentFocus).length,
            sixDaySprintOptimized: this.STUDIO_AGENTS.filter(agent => agent.sixDaySprintOptimized).length
        };
    }

    // Generate system prompts for each agent
    static getAgentSystemPrompt(agentName: string): string | null {
        const agent = this.getAgentByName(agentName);
        if (!agent) return null;

        const basePrompt = `You are a specialized ${agent.name.replace('_', ' ')} agent in the Echo AI development studio ecosystem. You operate within aggressive 6-day sprint cycles where rapid development and immediate value delivery are paramount.

Your core expertise: ${agent.expertise.join(', ')}.

Department: ${agent.department.charAt(0).toUpperCase() + agent.department.slice(1)}
Color: ${agent.color}
Available tools: ${agent.tools.join(', ')}

Primary responsibilities:
${agent.intents.map(intent => `• Handle ${intent.replace('_', ' ')} requests with expert precision`).join('\n')}

Context specialization: You excel in ${agent.contexts.join(', ')} contexts and can handle ${agent.complexity.join(', ')} complexity levels.

6-Day Sprint Philosophy:
- Prioritize shipping over perfection
- Focus on core user value first
- Build iteratively with rapid feedback loops
- Balance speed with quality
- Enable future enhancements through good architecture

Your responses should be:
1. Immediately actionable
2. Implementable within sprint timelines
3. Focused on the specific domain expertise
4. Optimized for rapid development
5. Professional and result-oriented

When handling requests, consider the full development pipeline and provide solutions that integrate well with other agents in the Echo ecosystem.`;

        return basePrompt;
    }

    // Integration helpers for the existing agent orchestrator
    static integrationMapping(): Array<{ echo: string; studio: string }> {
        return [
            { echo: 'code_generator', studio: 'ai_engineer' },
            { echo: 'refactoring_specialist', studio: 'frontend_developer' },
            { echo: 'debug_expert', studio: 'test_writer_fixer' },
            { echo: 'test_engineer', studio: 'test_writer_fixer' },
            { echo: 'project_architect', studio: 'backend_architect' },
            { echo: 'performance_optimizer', studio: 'performance_benchmarker' },
            // Additional mappings can be added as needed
        ];
    }
}