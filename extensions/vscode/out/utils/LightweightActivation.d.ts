import * as vscode from 'vscode';
/**
 * Lightweight activation strategy to minimize startup impact
 */
export declare class LightweightActivation {
    private static instance;
    private resourceManager;
    private configManager;
    constructor(context: vscode.ExtensionContext);
    static getInstance(context: vscode.ExtensionContext): LightweightActivation;
    /**
     * Activate only essential features based on system resources
     */
    activateEssentials(): Promise<void>;
    /**
     * Activate feature based on user demand
     */
    activateFeature(featureName: string): Promise<any>;
    /**
     * Check if system has sufficient resources for a feature
     */
    canActivateFeature(featureName: string): boolean;
    /**
     * Setup automatic performance optimizations
     */
    private setupPerformanceOptimizations;
    /**
     * Get activation recommendations based on system state
     */
    getActivationRecommendations(): string[];
    dispose(): void;
}
//# sourceMappingURL=LightweightActivation.d.ts.map