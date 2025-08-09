import { Agent, AgentManager, AgentContext, AgentResult } from '../types.js';

export class EchoAgentManager implements AgentManager {
  private agents: Map<string, Agent> = new Map();
  private agentsByCapability: Map<string, Agent[]> = new Map();

  registerAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
    
    // Index by capabilities
    for (const capability of agent.capabilities) {
      if (!this.agentsByCapability.has(capability.category)) {
        this.agentsByCapability.set(capability.category, []);
      }
      this.agentsByCapability.get(capability.category)!.push(agent);
    }
    
    console.log(`✅ Registered agent: ${agent.name} (${agent.capabilities.length} capabilities)`);
  }

  findBestAgent(context: AgentContext): Agent | null {
    let bestAgent: Agent | null = null;
    let highestScore = 0;

    for (const agent of this.agents.values()) {
      if (agent.canHandle(context)) {
        const score = this.calculateAgentScore(agent, context);
        if (score > highestScore) {
          highestScore = score;
          bestAgent = agent;
        }
      }
    }

    return bestAgent;
  }

  async optimizeWithAgent(context: AgentContext): Promise<AgentResult> {
    const agent = this.findBestAgent(context);
    
    if (!agent) {
      // Return basic optimization if no agent found
      return {
        optimizedPrompt: context.input,
        expectedOutputType: 'explanation',
        confidence: 0.5,
        metadata: {
          agentUsed: 'none',
          optimizationApplied: [],
        },
      };
    }

    const result = await agent.optimize(context);
    console.log(`🤖 Agent ${agent.name} optimized prompt (confidence: ${result.confidence})`);
    
    return result;
  }

  listAvailableAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentByName(name: string): Agent | null {
    return this.agents.get(name) || null;
  }

  getAgentsByCapability(capability: string): Agent[] {
    return this.agentsByCapability.get(capability) || [];
  }

  private calculateAgentScore(agent: Agent, context: AgentContext): number {
    let score = 0;
    
    // Provider compatibility
    const hasProviderSupport = agent.capabilities.some(cap => 
      cap.supportedProviders.includes(context.provider) || 
      cap.supportedProviders.includes('*')
    );
    if (hasProviderSupport) score += 0.3;
    
    // Input complexity analysis
    const inputLength = context.input.length;
    if (inputLength > 500) score += 0.2; // Complex inputs benefit more from agents
    
    // Keyword matching
    const inputLower = context.input.toLowerCase();
    const hasCodeKeywords = /\b(code|function|class|debug|refactor|optimize)\b/.test(inputLower);
    const hasAnalysisKeywords = /\b(analyze|review|explain|understand)\b/.test(inputLower);
    
    if (hasCodeKeywords && agent.capabilities.some(cap => cap.category === 'optimization')) {
      score += 0.3;
    }
    if (hasAnalysisKeywords && agent.capabilities.some(cap => cap.category === 'analysis')) {
      score += 0.3;
    }
    
    // User preferences alignment
    if (context.userPreferences) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }
}