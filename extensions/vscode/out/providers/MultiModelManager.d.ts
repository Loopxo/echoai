import * as vscode from 'vscode';
export interface ModelConfig {
    name: string;
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
    specialties: ModelSpecialty[];
    performance: {
        speed: number;
        quality: number;
        cost: number;
    };
    contextWindow: number;
    capabilities: ModelCapability[];
}
export type ModelSpecialty = 'code_generation' | 'code_explanation' | 'refactoring' | 'debugging' | 'testing' | 'documentation' | 'security_analysis' | 'performance_optimization' | 'architecture_design' | 'general_programming';
export type ModelCapability = 'streaming' | 'function_calling' | 'code_execution' | 'image_analysis' | 'multilingual' | 'reasoning' | 'real_time';
export interface TaskContext {
    type: 'completion' | 'chat' | 'refactor' | 'explain' | 'optimize' | 'debug' | 'test' | 'document';
    language?: string;
    codeSize?: 'small' | 'medium' | 'large';
    complexity?: 'simple' | 'moderate' | 'complex';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    deadline?: Date;
    quality?: 'draft' | 'production' | 'enterprise';
}
export declare class MultiModelManager {
    private context;
    private models;
    private providers;
    private modelStats;
    private routingRules;
    private fallbackChain;
    constructor(context: vscode.ExtensionContext);
    private initializeDefaultModels;
    private setupRoutingRules;
    routeRequest(taskContext: TaskContext, prompt: string, options?: any): Promise<any>;
    private selectOptimalModel;
    private selectFromWeightedList;
    private selectByPerformanceScore;
    private calculatePerformanceScore;
    private executeWithFallback;
    private executeWithModel;
    private getProvider;
    private updateModelStats;
    private loadModelStats;
    private saveModelStats;
    getModelStats(): Map<string, ModelStats & {
        config: ModelConfig;
    }>;
    addCustomModel(config: ModelConfig): void;
    removeModel(modelName: string): void;
    addRoutingRule(rule: RoutingRule): void;
    getAvailableModels(): ModelConfig[];
    dispose(): void;
}
interface ModelStats {
    requestCount: number;
    successRate: number;
    averageLatency: number;
    averageQuality: number;
    lastUsed: Date;
    errors: Array<{
        timestamp: Date;
        error: string;
        context?: any;
    }>;
}
interface RoutingRule {
    condition: (context: TaskContext) => boolean;
    models: string[];
    weights: number[];
}
export {};
//# sourceMappingURL=MultiModelManager.d.ts.map