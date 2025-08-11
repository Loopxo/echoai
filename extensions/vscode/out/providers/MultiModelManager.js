"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiModelManager = void 0;
const vscode = __importStar(require("vscode"));
const EchoAIProvider_1 = require("./EchoAIProvider");
class MultiModelManager {
    context;
    models = new Map();
    providers = new Map();
    modelStats = new Map();
    routingRules = [];
    fallbackChain = [];
    constructor(context) {
        this.context = context;
        this.initializeDefaultModels();
        this.loadModelStats();
        this.setupRoutingRules();
    }
    initializeDefaultModels() {
        const defaultModels = [
            {
                name: 'claude-3-5-sonnet',
                provider: 'claude',
                maxTokens: 4096,
                temperature: 0.1,
                specialties: ['code_generation', 'refactoring', 'debugging', 'code_explanation'],
                performance: { speed: 7, quality: 9, cost: 6 },
                contextWindow: 200000,
                capabilities: ['streaming', 'function_calling', 'reasoning']
            },
            {
                name: 'gpt-4-turbo',
                provider: 'openai',
                maxTokens: 4096,
                temperature: 0.1,
                specialties: ['general_programming', 'architecture_design', 'documentation'],
                performance: { speed: 8, quality: 9, cost: 7 },
                contextWindow: 128000,
                capabilities: ['streaming', 'function_calling', 'image_analysis']
            },
            {
                name: 'llama-3.1-70b',
                provider: 'groq',
                maxTokens: 8192,
                temperature: 0.1,
                specialties: ['code_generation', 'testing', 'performance_optimization'],
                performance: { speed: 10, quality: 8, cost: 3 },
                contextWindow: 32768,
                capabilities: ['streaming', 'real_time']
            },
            {
                name: 'gemini-1.5-pro',
                provider: 'gemini',
                maxTokens: 8192,
                temperature: 0.1,
                specialties: ['security_analysis', 'code_explanation', 'multilingual'],
                performance: { speed: 8, quality: 8, cost: 4 },
                contextWindow: 2000000,
                capabilities: ['streaming', 'function_calling', 'multilingual', 'image_analysis']
            },
            {
                name: 'codellama-34b',
                provider: 'meta',
                maxTokens: 4096,
                temperature: 0.0,
                specialties: ['code_generation', 'debugging', 'refactoring'],
                performance: { speed: 6, quality: 7, cost: 2 },
                contextWindow: 16384,
                capabilities: ['streaming', 'code_execution']
            }
        ];
        defaultModels.forEach(model => {
            this.models.set(model.name, model);
            this.modelStats.set(model.name, {
                requestCount: 0,
                successRate: 1.0,
                averageLatency: 0,
                averageQuality: 8.0,
                lastUsed: new Date(),
                errors: []
            });
        });
        this.fallbackChain = [
            'claude-3-5-sonnet',
            'gpt-4-turbo',
            'llama-3.1-70b',
            'gemini-1.5-pro',
            'codellama-34b'
        ];
    }
    setupRoutingRules() {
        this.routingRules = [
            {
                condition: (ctx) => ctx.type === 'completion' && ctx.language === 'python',
                models: ['codellama-34b', 'claude-3-5-sonnet'],
                weights: [0.6, 0.4]
            },
            {
                condition: (ctx) => ctx.type === 'completion' && ctx.language === 'javascript',
                models: ['claude-3-5-sonnet', 'gpt-4-turbo'],
                weights: [0.7, 0.3]
            },
            {
                condition: (ctx) => ctx.type === 'refactor' && ctx.complexity === 'complex',
                models: ['claude-3-5-sonnet', 'gpt-4-turbo'],
                weights: [0.8, 0.2]
            },
            {
                condition: (ctx) => ctx.type === 'explain' && ctx.codeSize === 'large',
                models: ['gemini-1.5-pro', 'claude-3-5-sonnet'],
                weights: [0.6, 0.4]
            },
            {
                condition: (ctx) => ctx.priority === 'urgent',
                models: ['llama-3.1-70b', 'groq'],
                weights: [0.7, 0.3]
            },
            {
                condition: (ctx) => ctx.type === 'optimize' || ctx.type === 'debug',
                models: ['claude-3-5-sonnet', 'llama-3.1-70b'],
                weights: [0.6, 0.4]
            },
            {
                condition: (ctx) => ctx.quality === 'enterprise',
                models: ['claude-3-5-sonnet', 'gpt-4-turbo'],
                weights: [0.5, 0.5]
            }
        ];
    }
    async routeRequest(taskContext, prompt, options) {
        try {
            const selectedModel = this.selectOptimalModel(taskContext);
            const provider = await this.getProvider(selectedModel);
            const startTime = Date.now();
            const result = await this.executeWithModel(provider, selectedModel, prompt, options, taskContext);
            const latency = Date.now() - startTime;
            // Update model statistics
            this.updateModelStats(selectedModel, true, latency, result);
            return {
                result,
                model: selectedModel,
                latency,
                provider: this.models.get(selectedModel)?.provider
            };
        }
        catch (error) {
            console.error('Error in model routing:', error);
            // Try fallback chain
            return this.executeWithFallback(taskContext, prompt, options, error);
        }
    }
    selectOptimalModel(taskContext) {
        // Find matching routing rules
        const matchingRules = this.routingRules.filter(rule => rule.condition(taskContext));
        if (matchingRules.length > 0) {
            // Use the first matching rule (rules are ordered by priority)
            const rule = matchingRules[0];
            return this.selectFromWeightedList(rule.models, rule.weights);
        }
        // No specific rule found, use performance-based selection
        return this.selectByPerformanceScore(taskContext);
    }
    selectFromWeightedList(models, weights) {
        const random = Math.random();
        let cumulativeWeight = 0;
        for (let i = 0; i < models.length; i++) {
            cumulativeWeight += weights[i];
            if (random <= cumulativeWeight) {
                return models[i];
            }
        }
        return models[0]; // Fallback to first model
    }
    selectByPerformanceScore(taskContext) {
        let bestModel = '';
        let bestScore = -1;
        for (const [modelName, config] of this.models) {
            const stats = this.modelStats.get(modelName);
            const score = this.calculatePerformanceScore(config, stats, taskContext);
            if (score > bestScore) {
                bestScore = score;
                bestModel = modelName;
            }
        }
        return bestModel || this.fallbackChain[0];
    }
    calculatePerformanceScore(config, stats, context) {
        let score = 0;
        // Base quality score
        score += config.performance.quality * 0.3;
        score += stats.averageQuality * 0.2;
        // Speed consideration (higher for urgent tasks)
        const speedWeight = context.priority === 'urgent' ? 0.4 : 0.2;
        score += config.performance.speed * speedWeight;
        // Cost consideration (inverse - lower cost is better)
        score += (10 - config.performance.cost) * 0.1;
        // Specialty bonus
        const taskSpecialtyMap = {
            completion: ['code_generation', 'general_programming'],
            chat: ['general_programming', 'code_explanation'],
            refactor: ['refactoring', 'code_generation'],
            explain: ['code_explanation', 'documentation'],
            optimize: ['performance_optimization', 'refactoring'],
            debug: ['debugging', 'code_explanation'],
            test: ['testing', 'code_generation'],
            document: ['documentation', 'code_explanation']
        };
        const relevantSpecialties = taskSpecialtyMap[context.type] || [];
        const specialtyMatch = config.specialties.some(s => relevantSpecialties.includes(s));
        if (specialtyMatch) {
            score += 2; // Bonus for specialty match
        }
        // Reliability score
        score += stats.successRate * 2;
        // Recent usage penalty (to encourage load balancing)
        const timeSinceLastUse = Date.now() - stats.lastUsed.getTime();
        const hoursSinceLastUse = timeSinceLastUse / (1000 * 60 * 60);
        if (hoursSinceLastUse < 1) {
            score -= 0.5; // Small penalty for very recent usage
        }
        return Math.max(0, score);
    }
    async executeWithFallback(taskContext, prompt, options, originalError) {
        for (const fallbackModel of this.fallbackChain) {
            try {
                const provider = await this.getProvider(fallbackModel);
                const startTime = Date.now();
                const result = await this.executeWithModel(provider, fallbackModel, prompt, options, taskContext);
                const latency = Date.now() - startTime;
                this.updateModelStats(fallbackModel, true, latency, result);
                return {
                    result,
                    model: fallbackModel,
                    latency,
                    provider: this.models.get(fallbackModel)?.provider,
                    fallback: true,
                    originalError: originalError.message
                };
            }
            catch (error) {
                console.error(`Fallback model ${fallbackModel} also failed:`, error);
                this.updateModelStats(fallbackModel, false, 0, null, error);
                continue;
            }
        }
        throw new Error(`All models failed. Original error: ${originalError.message}`);
    }
    async executeWithModel(provider, modelName, prompt, options, taskContext) {
        const config = this.models.get(modelName);
        const enhancedOptions = {
            ...options,
            temperature: options?.temperature ?? config.temperature,
            max_tokens: Math.min(options?.maxTokens || config.maxTokens, config.maxTokens),
            model: modelName
        };
        // Use different methods based on task type
        switch (taskContext.type) {
            case 'completion':
                return await provider.getCompletion(prompt, '', 'completion', enhancedOptions.max_tokens);
            case 'chat':
                return await provider.getCompletion(prompt, '', 'chat', enhancedOptions.max_tokens);
            case 'refactor':
                return await provider.refactorCode(prompt, taskContext.language || 'javascript');
            case 'explain':
                return await provider.explainCode(prompt, taskContext.language || 'javascript');
            case 'optimize':
                return await provider.optimizeCode(prompt, taskContext.language || 'javascript');
            case 'debug':
                return await provider.debugCode(prompt, taskContext.language || 'javascript');
            case 'test':
                return await provider.generateTests([{ name: 'function', code: prompt }], taskContext.language || 'javascript');
            case 'document':
                return await provider.generateDocumentation(prompt, taskContext.language || 'javascript');
            default:
                return await provider.getCompletion(prompt, '', 'general', enhancedOptions.max_tokens);
        }
    }
    async getProvider(modelName) {
        const config = this.models.get(modelName);
        if (!config) {
            throw new Error(`Model ${modelName} not found`);
        }
        const providerKey = config.provider;
        let provider = this.providers.get(providerKey);
        if (!provider) {
            // Create new provider instance
            const configManager = {
                get: (key, defaultValue) => {
                    const vscodeConfig = vscode.workspace.getConfiguration('echoAI');
                    return vscodeConfig.get(key, defaultValue);
                }
            };
            provider = new EchoAIProvider_1.EchoAIProvider(configManager);
            this.providers.set(providerKey, provider);
        }
        return provider;
    }
    updateModelStats(modelName, success, latency, result, error) {
        const stats = this.modelStats.get(modelName);
        if (!stats)
            return;
        stats.requestCount++;
        stats.lastUsed = new Date();
        if (success) {
            // Update success rate with exponential moving average
            stats.successRate = stats.successRate * 0.95 + 0.05;
            // Update average latency
            if (stats.averageLatency === 0) {
                stats.averageLatency = latency;
            }
            else {
                stats.averageLatency = stats.averageLatency * 0.8 + latency * 0.2;
            }
            // Update quality score (would need actual quality metrics)
            // For now, using a simple heuristic based on result length and structure
            if (result && typeof result === 'string') {
                const qualityScore = Math.min(10, Math.max(1, result.length / 100));
                stats.averageQuality = stats.averageQuality * 0.9 + qualityScore * 0.1;
            }
        }
        else {
            // Update failure rate
            stats.successRate = stats.successRate * 0.95;
            // Log error
            if (error) {
                stats.errors.push({
                    timestamp: new Date(),
                    error: error.message || error.toString(),
                    context: { latency }
                });
                // Keep only last 10 errors
                if (stats.errors.length > 10) {
                    stats.errors = stats.errors.slice(-10);
                }
            }
        }
        this.saveModelStats();
    }
    loadModelStats() {
        const stored = this.context.globalState.get('echoAI.modelStats', {});
        for (const [modelName, storedStats] of Object.entries(stored)) {
            if (this.models.has(modelName)) {
                this.modelStats.set(modelName, {
                    ...storedStats,
                    lastUsed: new Date(storedStats.lastUsed),
                    errors: storedStats.errors.map(e => ({
                        ...e,
                        timestamp: new Date(e.timestamp)
                    }))
                });
            }
        }
    }
    saveModelStats() {
        const statsToSave = {};
        for (const [modelName, stats] of this.modelStats) {
            statsToSave[modelName] = stats;
        }
        this.context.globalState.update('echoAI.modelStats', statsToSave);
    }
    getModelStats() {
        const result = new Map();
        for (const [modelName, stats] of this.modelStats) {
            const config = this.models.get(modelName);
            if (config) {
                result.set(modelName, { ...stats, config });
            }
        }
        return result;
    }
    addCustomModel(config) {
        this.models.set(config.name, config);
        this.modelStats.set(config.name, {
            requestCount: 0,
            successRate: 1.0,
            averageLatency: 0,
            averageQuality: 8.0,
            lastUsed: new Date(),
            errors: []
        });
    }
    removeModel(modelName) {
        this.models.delete(modelName);
        this.modelStats.delete(modelName);
        this.fallbackChain = this.fallbackChain.filter(name => name !== modelName);
    }
    addRoutingRule(rule) {
        this.routingRules.unshift(rule); // Add to beginning for priority
    }
    getAvailableModels() {
        return Array.from(this.models.values());
    }
    dispose() {
        this.saveModelStats();
        this.providers.clear();
        this.models.clear();
        this.modelStats.clear();
    }
}
exports.MultiModelManager = MultiModelManager;
//# sourceMappingURL=MultiModelManager.js.map