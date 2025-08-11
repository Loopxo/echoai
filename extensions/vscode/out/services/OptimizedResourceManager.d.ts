import { ConfigurationManager } from '../utils/ConfigurationManager';
interface ResourceMetrics {
    memoryUsage: number;
    cpuUsage: number;
    activeComponents: number;
    cachedItems: number;
    lastCleanup: number;
}
export declare class OptimizedResourceManager {
    private configManager;
    private static instance;
    private components;
    private cache;
    private cleanupInterval;
    private memoryMonitorInterval;
    private resourceThrottling;
    private lowMemoryMode;
    private metrics;
    constructor(configManager: ConfigurationManager);
    static getInstance(configManager: ConfigurationManager): OptimizedResourceManager;
    registerComponent<T>(name: string, factory: () => T, priority?: 'high' | 'medium' | 'low', dependencies?: string[]): void;
    getComponent<T>(name: string): Promise<T>;
    isComponentLoaded(name: string): boolean;
    unloadComponent(name: string): void;
    setCache(key: string, data: any, ttlMs?: number): void;
    getCache<T>(key: string): T | null;
    clearCache(pattern?: string): void;
    executeWithThrottling<T>(operation: () => Promise<T>, priority?: 'high' | 'medium' | 'low'): Promise<T>;
    getMetrics(): ResourceMetrics;
    optimizeForSystem(): void;
    private shouldDeferLoading;
    private waitForResources;
    private enableLowMemoryMode;
    private disableLowMemoryMode;
    private clearNonEssentialCache;
    private reduceCacheTTL;
    private notifyLowMemoryMode;
    private unloadLowPriorityComponents;
    private startMonitoring;
    private setupCleanup;
    private cleanupExpiredCache;
    private delay;
    dispose(): void;
}
export {};
//# sourceMappingURL=OptimizedResourceManager.d.ts.map