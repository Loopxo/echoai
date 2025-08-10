/**
 * Echo Studio Agents Integration Demo
 * 
 * Demonstrates the new comprehensive agent ecosystem with 35+ specialized agents
 * across 7 departments integrated into Echo's existing system.
 */

import { AdvancedAgentOrchestrator } from '../agents/nlp/agent-orchestrator.js';
import { StudioAgentRegistry } from '../agents/studio-agent-registry.js';
import { Config } from '../config/index.js';

export class IntegratedAgentsDemo {
    private orchestrator: AdvancedAgentOrchestrator;

    constructor() {
        const config = new Config({
            provider: 'claude',
            apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key'
        });
        
        this.orchestrator = new AdvancedAgentOrchestrator(config);
    }

    async runComprehensiveDemo(): Promise<void> {
        console.log('\n🎭 ECHO STUDIO AGENTS INTEGRATION DEMO');
        console.log('=====================================\n');

        // Show agent ecosystem overview
        await this.showAgentEcosystem();

        // Test different departments
        await this.testEngineeringAgents();
        await this.testDesignAgents();
        await this.testMarketingAgents();
        await this.testProductAgents();
        await this.testOperationsAgents();

        // Show performance stats
        await this.showPerformanceStats();
    }

    private async showAgentEcosystem(): Promise<void> {
        console.log('📊 ECHO AGENT ECOSYSTEM OVERVIEW');
        console.log('---------------------------------');
        
        const stats = this.orchestrator.getStudioAgentStats();
        console.log(`Total Agents: ${stats.totalAgents}`);
        console.log(`Active Agents: ${stats.activeAgents}`);
        console.log(`Rapid Development Optimized: ${stats.rapidDevelopmentOptimized}`);
        console.log(`6-Day Sprint Optimized: ${stats.sixDaySprintOptimized}\n`);

        console.log('🏢 DEPARTMENT BREAKDOWN:');
        Object.entries(stats.departmentCounts).forEach(([dept, count]) => {
            console.log(`  ${dept.charAt(0).toUpperCase() + dept.slice(1)}: ${count} agents`);
        });
        
        console.log('\n🌟 AVAILABLE DEPARTMENTS:');
        const departments = ['engineering', 'design', 'marketing', 'product', 'operations', 'testing'];
        departments.forEach(dept => {
            const agents = this.orchestrator.getAgentsByDepartment(dept as any);
            console.log(`  ${dept.charAt(0).toUpperCase() + dept.slice(1)} (${agents.length}): ${agents.map(a => a.name).join(', ')}`);
        });
        console.log('');
    }

    private async testEngineeringAgents(): Promise<void> {
        console.log('⚙️ TESTING ENGINEERING AGENTS');
        console.log('------------------------------');

        const testCases = [
            {
                input: "I need to integrate OpenAI's GPT-4 API into my React app for chat functionality",
                expectedAgent: 'ai_engineer',
                context: { domain: 'ai', complexity: 'complex' }
            },
            {
                input: "Design a scalable REST API for a social media platform with user authentication",
                expectedAgent: 'backend_architect', 
                context: { domain: 'architecture', complexity: 'expert' }
            },
            {
                input: "Set up automated deployment pipeline with GitHub Actions and Docker",
                expectedAgent: 'devops_automator',
                context: { domain: 'infrastructure', complexity: 'moderate' }
            },
            {
                input: "Build a responsive dashboard component with React and TypeScript",
                expectedAgent: 'frontend_developer',
                context: { domain: 'ui', complexity: 'moderate' }
            }
        ];

        for (const testCase of testCases) {
            console.log(`🧪 Test: "${testCase.input}"`);
            try {
                const execution = await this.orchestrator.processRequest(testCase.input, testCase.context);
                console.log(`✅ Selected Agent: ${execution.agent}`);
                console.log(`📈 Confidence: ${execution.intent.confidence.toFixed(2)}`);
                console.log(`⏱️ Processing Time: ${execution.metrics.processingTime}ms\n`);
            } catch (error) {
                console.log(`❌ Error: ${error}\n`);
            }
        }
    }

    private async testDesignAgents(): Promise<void> {
        console.log('🎨 TESTING DESIGN AGENTS');
        console.log('-------------------------');

        const testCases = [
            {
                input: "Create a cohesive design system for our fitness app with consistent colors and typography",
                expectedAgent: 'brand_guardian',
                context: { domain: 'branding', complexity: 'complex' }
            },
            {
                input: "Design a modern onboarding flow UI that converts well on mobile",
                expectedAgent: 'ui_designer',
                context: { domain: 'ui', complexity: 'moderate' }
            },
            {
                input: "Research user pain points in our checkout process and recommend improvements",
                expectedAgent: 'ux_researcher',
                context: { domain: 'research', complexity: 'moderate' }
            }
        ];

        for (const testCase of testCases) {
            console.log(`🧪 Test: "${testCase.input}"`);
            try {
                const execution = await this.orchestrator.processRequest(testCase.input, testCase.context);
                console.log(`✅ Selected Agent: ${execution.agent}`);
                console.log(`📈 Confidence: ${execution.intent.confidence.toFixed(2)}`);
                console.log(`⏱️ Processing Time: ${execution.metrics.processingTime}ms\n`);
            } catch (error) {
                console.log(`❌ Error: ${error}\n`);
            }
        }
    }

    private async testMarketingAgents(): Promise<void> {
        console.log('📢 TESTING MARKETING AGENTS');
        console.log('----------------------------');

        const testCases = [
            {
                input: "Create a viral loop mechanism to increase our app's user acquisition by 300%",
                expectedAgent: 'growth_hacker',
                context: { domain: 'growth', complexity: 'expert' }
            },
            {
                input: "Write engaging TikTok video concepts that showcase our AI tool's capabilities",
                expectedAgent: 'tiktok_strategist',
                context: { domain: 'social_media', complexity: 'moderate' }
            },
            {
                input: "Optimize our app store listing to rank higher for 'productivity app' searches",
                expectedAgent: 'app_store_optimizer',
                context: { domain: 'app_store', complexity: 'moderate' }
            }
        ];

        for (const testCase of testCases) {
            console.log(`🧪 Test: "${testCase.input}"`);
            try {
                const execution = await this.orchestrator.processRequest(testCase.input, testCase.context);
                console.log(`✅ Selected Agent: ${execution.agent}`);
                console.log(`📈 Confidence: ${execution.intent.confidence.toFixed(2)}`);
                console.log(`⏱️ Processing Time: ${execution.metrics.processingTime}ms\n`);
            } catch (error) {
                console.log(`❌ Error: ${error}\n`);
            }
        }
    }

    private async testProductAgents(): Promise<void> {
        console.log('🚀 TESTING PRODUCT AGENTS');
        console.log('--------------------------');

        const testCases = [
            {
                input: "Help prioritize features for our 6-day sprint: AI chat, dark mode, or push notifications?",
                expectedAgent: 'sprint_prioritizer',
                context: { domain: 'planning', complexity: 'moderate' }
            },
            {
                input: "Analyze 500+ user feedback messages and extract the top feature requests",
                expectedAgent: 'feedback_synthesizer',
                context: { domain: 'feedback', complexity: 'complex' }
            },
            {
                input: "Research emerging trends in productivity apps that we could adopt",
                expectedAgent: 'trend_researcher',
                context: { domain: 'research', complexity: 'moderate' }
            }
        ];

        for (const testCase of testCases) {
            console.log(`🧪 Test: "${testCase.input}"`);
            try {
                const execution = await this.orchestrator.processRequest(testCase.input, testCase.context);
                console.log(`✅ Selected Agent: ${execution.agent}`);
                console.log(`📈 Confidence: ${execution.intent.confidence.toFixed(2)}`);
                console.log(`⏱️ Processing Time: ${execution.metrics.processingTime}ms\n`);
            } catch (error) {
                console.log(`❌ Error: ${error}\n`);
            }
        }
    }

    private async testOperationsAgents(): Promise<void> {
        console.log('⚡ TESTING OPERATIONS & TESTING AGENTS');
        console.log('--------------------------------------');

        const testCases = [
            {
                input: "Set up comprehensive analytics tracking for our user onboarding funnel",
                expectedAgent: 'analytics_reporter',
                context: { domain: 'analytics', complexity: 'moderate' }
            },
            {
                input: "Create automated API tests for our authentication endpoints",
                expectedAgent: 'api_tester',
                context: { domain: 'testing', complexity: 'moderate' }
            },
            {
                input: "Benchmark our app's performance and identify bottlenecks",
                expectedAgent: 'performance_benchmarker',
                context: { domain: 'performance', complexity: 'complex' }
            }
        ];

        for (const testCase of testCases) {
            console.log(`🧪 Test: "${testCase.input}"`);
            try {
                const execution = await this.orchestrator.processRequest(testCase.input, testCase.context);
                console.log(`✅ Selected Agent: ${execution.agent}`);
                console.log(`📈 Confidence: ${execution.intent.confidence.toFixed(2)}`);
                console.log(`⏱️ Processing Time: ${execution.metrics.processingTime}ms\n`);
            } catch (error) {
                console.log(`❌ Error: ${error}\n`);
            }
        }
    }

    private async showPerformanceStats(): Promise<void> {
        console.log('📊 PERFORMANCE STATISTICS');
        console.log('--------------------------');
        
        const stats = this.orchestrator.getAgentPerformanceStats();
        const executions = this.orchestrator.getExecutionHistory();
        
        console.log(`Total Executions: ${executions.length}`);
        console.log(`Successful Executions: ${executions.filter(e => e.status === 'completed').length}`);
        console.log(`Average Processing Time: ${executions.reduce((sum, e) => sum + e.metrics.processingTime, 0) / executions.length || 0}ms`);
        
        console.log('\n🏆 TOP PERFORMING AGENTS:');
        Object.entries(stats)
            .sort(([,a], [,b]) => (b.successRate * b.averageQuality) - (a.successRate * a.averageQuality))
            .slice(0, 5)
            .forEach(([agent, data]) => {
                console.log(`  ${agent}: ${(data.successRate * 100).toFixed(1)}% success, ${data.averageQuality.toFixed(2)} quality`);
            });

        console.log('\n🎯 AGENT SELECTION EFFICIENCY:');
        const studioAgentExecutions = executions.filter(e => 
            this.orchestrator.listStudioAgents().some(sa => sa.name === e.agent)
        );
        console.log(`Studio Agents Used: ${studioAgentExecutions.length}/${executions.length} (${(studioAgentExecutions.length / executions.length * 100).toFixed(1)}%)`);
    }

    async demonstrateAgentSpecialization(): Promise<void> {
        console.log('\n🎯 AGENT SPECIALIZATION DEMONSTRATION');
        console.log('=====================================\n');

        const specializedTasks = [
            {
                task: "Build a viral TikTok marketing campaign",
                departments: ['marketing'],
                expectedSpecialists: ['tiktok_strategist', 'content_creator', 'growth_hacker']
            },
            {
                task: "Create a full-stack e-commerce application",
                departments: ['engineering', 'design'],
                expectedSpecialists: ['backend_architect', 'frontend_developer', 'ui_designer', 'devops_automator']
            },
            {
                task: "Launch a productivity app in 6 days",
                departments: ['product', 'engineering', 'marketing', 'design'],
                expectedSpecialists: ['sprint_prioritizer', 'rapid_prototyper', 'ui_designer', 'app_store_optimizer']
            }
        ];

        for (const scenario of specializedTasks) {
            console.log(`🎬 SCENARIO: ${scenario.task}`);
            console.log(`Expected departments: ${scenario.departments.join(', ')}`);
            console.log(`Expected specialists: ${scenario.expectedSpecialists.join(', ')}`);
            
            const relevantAgents = scenario.departments.flatMap(dept => 
                this.orchestrator.getAgentsByDepartment(dept as any)
            );
            
            console.log(`Available agents for this scenario: ${relevantAgents.length}`);
            console.log(`Agents: ${relevantAgents.map(a => a.name).join(', ')}\n`);
        }
    }
}

// Demo execution
export async function runIntegratedAgentsDemo(): Promise<void> {
    const demo = new IntegratedAgentsDemo();
    
    try {
        await demo.runComprehensiveDemo();
        await demo.demonstrateAgentSpecialization();
        
        console.log('\n🎉 INTEGRATION DEMO COMPLETE!');
        console.log('Echo now has a comprehensive 35+ agent ecosystem ready for any development challenge.');
        
    } catch (error) {
        console.error('Demo failed:', error);
    }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runIntegratedAgentsDemo();
}