export interface AgentCapability {
  name: string;
  description: string;
  category: 'optimization' | 'analysis' | 'generation' | 'transformation';
  supportedProviders: string[];
  requiredParameters?: string[];
}

export interface AgentContext {
  input: string;
  provider: string;
  model: string;
  metadata?: Record<string, any>;
  userPreferences?: AgentPreferences;
}

export interface AgentPreferences {
  outputFormat: 'concise' | 'detailed' | 'structured' | 'creative';
  codeStyle?: 'functional' | 'object-oriented' | 'minimal';
  explanationLevel: 'beginner' | 'intermediate' | 'expert';
  includeExamples: boolean;
  preferredLanguage?: string;
}

export interface AgentResult {
  optimizedPrompt: string;
  expectedOutputType: 'code' | 'explanation' | 'analysis' | 'creative';
  confidence: number;
  suggestedProvider?: string;
  suggestedModel?: string;
  postProcessingRules?: string[];
  metadata: {
    agentUsed: string;
    optimizationApplied: string[];
    estimatedTokens?: number;
    detectedLanguage?: string;
    detectedDomain?: string;
    [key: string]: any;
  };
}

export interface Agent {
  name: string;
  version: string;
  capabilities: AgentCapability[];
  
  canHandle(context: AgentContext): boolean;
  optimize(context: AgentContext): Promise<AgentResult>;
  postProcess?(result: string, context: AgentContext): Promise<string>;
}

export interface AgentManager {
  registerAgent(agent: Agent): void;
  findBestAgent(context: AgentContext): Agent | null;
  optimizeWithAgent(context: AgentContext): Promise<AgentResult>;
  listAvailableAgents(): Agent[];
  getAgentByName(name: string): Agent | null;
}