"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LightweightActivation = void 0;
const OptimizedResourceManager_1 = require("../services/OptimizedResourceManager");
const ConfigurationManager_1 = require("./ConfigurationManager");
/**
 * Lightweight activation strategy to minimize startup impact
 */
class LightweightActivation {
    static instance;
    resourceManager;
    configManager;
    constructor(context) {
        this.configManager = new ConfigurationManager_1.ConfigurationManager();
        this.resourceManager = OptimizedResourceManager_1.OptimizedResourceManager.getInstance(this.configManager);
        this.setupPerformanceOptimizations();
    }
    static getInstance(context) {
        if (!LightweightActivation.instance) {
            LightweightActivation.instance = new LightweightActivation(context);
        }
        return LightweightActivation.instance;
    }
    /**
     * Activate only essential features based on system resources
     */
    async activateEssentials() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        // Only load completion and basic error detection on startup
        const essentialComponents = ['echoProvider', 'completionProvider'];
        // If memory usage is low, also load error detection
        if (heapUsedMB < 150) {
            essentialComponents.push('errorProvider');
        }
        console.log(`Echo AI: Starting with ${essentialComponents.length} essential components`);
        for (const component of essentialComponents) {
            try {
                await this.resourceManager.getComponent(component);
                console.log(`Echo AI: Loaded ${component}`);
            }
            catch (error) {
                console.error(`Echo AI: Failed to load ${component}:`, error);
            }
        }
    }
    /**
     * Activate feature based on user demand
     */
    async activateFeature(featureName) {
        const featureMap = {
            'analysis': ['realTimeAnalyzer', 'advancedDiagnosticsProvider'],
            'refactoring': ['refactoringEngine', 'smartRefactoring'],
            'security': ['vulnerabilityScanner', 'securityDashboard'],
            'performance': ['performanceMonitor', 'incrementalAnalyzer'],
            'indexing': ['codebaseIndexer']
        };
        const components = featureMap[featureName] || [featureName];
        const loadedComponents = [];
        for (const component of components) {
            try {
                const instance = await this.resourceManager.getComponent(component);
                loadedComponents.push(instance);
                console.log(`Echo AI: Activated ${component} for ${featureName}`);
            }
            catch (error) {
                console.error(`Echo AI: Failed to activate ${component}:`, error);
            }
        }
        return loadedComponents.length === 1 ? loadedComponents[0] : loadedComponents;
    }
    /**
     * Check if system has sufficient resources for a feature
     */
    canActivateFeature(featureName) {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const memoryThreshold = this.configManager.get('performance.memoryThreshold', 200);
        const featureMemoryRequirements = {
            'analysis': 50,
            'refactoring': 80,
            'security': 60,
            'performance': 30,
            'indexing': 100
        };
        const requiredMemory = featureMemoryRequirements[featureName] || 30;
        return (heapUsedMB + requiredMemory) < memoryThreshold;
    }
    /**
     * Setup automatic performance optimizations
     */
    setupPerformanceOptimizations() {
        // Monitor memory usage and auto-unload unused components
        setInterval(() => {
            this.resourceManager.optimizeForSystem();
        }, 30000); // Check every 30 seconds
        // Listen for low memory warnings
        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning' ||
                warning.message?.includes('memory')) {
                console.log('Echo AI: Received memory warning, optimizing...');
                this.resourceManager.clearCache();
            }
        });
    }
    /**
     * Get activation recommendations based on system state
     */
    getActivationRecommendations() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const recommendations = [];
        if (heapUsedMB > 300) {
            recommendations.push('Disable real-time analysis to reduce memory usage');
            recommendations.push('Increase analysis delays');
            recommendations.push('Reduce maximum file size for analysis');
        }
        if (heapUsedMB > 500) {
            recommendations.push('Consider closing other VS Code extensions');
            recommendations.push('Restart VS Code to clear memory');
        }
        if (heapUsedMB < 100) {
            recommendations.push('System has sufficient resources for all features');
        }
        return recommendations;
    }
    dispose() {
        this.resourceManager.dispose();
    }
}
exports.LightweightActivation = LightweightActivation;
//# sourceMappingURL=LightweightActivation.js.map