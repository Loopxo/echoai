import * as vscode from 'vscode';
import { ConfigurationManager } from '../utils/ConfigurationManager';

interface LazyComponent<T> {
    instance?: T;
    factory: () => T;
    dependencies?: string[];
    initialized: boolean;
    priority: 'high' | 'medium' | 'low';
}

interface ResourceMetrics {
    memoryUsage: number;
    cpuUsage: number;
    activeComponents: number;
    cachedItems: number;
    lastCleanup: number;
}

export class OptimizedResourceManager {
    private static instance: OptimizedResourceManager;
    private components = new Map<string, LazyComponent<any>>();
    private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    private cleanupInterval: NodeJS.Timeout | undefined;
    private memoryMonitorInterval: NodeJS.Timeout | undefined;
    private resourceThrottling = true;
    private lowMemoryMode = false;
    private metrics: ResourceMetrics;

    constructor(private configManager: ConfigurationManager) {
        this.resourceThrottling = this.configManager.get<boolean>('optimization.resourceThrottling', true);
        this.metrics = {
            memoryUsage: 0,
            cpuUsage: 0,
            activeComponents: 0,
            cachedItems: 0,
            lastCleanup: Date.now()
        };
        
        this.startMonitoring();
        this.setupCleanup();
    }

    public static getInstance(configManager: ConfigurationManager): OptimizedResourceManager {
        if (!OptimizedResourceManager.instance) {
            OptimizedResourceManager.instance = new OptimizedResourceManager(configManager);
        }
        return OptimizedResourceManager.instance;
    }

    public registerComponent<T>(
        name: string,
        factory: () => T,
        priority: 'high' | 'medium' | 'low' = 'medium',
        dependencies?: string[]
    ): void {
        this.components.set(name, {
            factory,
            dependencies,
            initialized: false,
            priority,
        });
    }

    public async getComponent<T>(name: string): Promise<T> {
        const component = this.components.get(name);
        if (!component) {
            throw new Error(`Component '${name}' not registered`);
        }

        // Check if we should defer loading due to resource constraints
        if (this.shouldDeferLoading(component)) {
            await this.waitForResources();
        }

        if (!component.initialized) {
            // Load dependencies first
            if (component.dependencies) {
                for (const dep of component.dependencies) {
                    await this.getComponent(dep);
                }
            }

            try {
                component.instance = component.factory();
                component.initialized = true;
                this.metrics.activeComponents++;
            } catch (error) {
                console.error(`Failed to initialize component '${name}':`, error);
                throw error;
            }
        }

        return component.instance as T;
    }

    public isComponentLoaded(name: string): boolean {
        return this.components.get(name)?.initialized ?? false;
    }

    public unloadComponent(name: string): void {
        const component = this.components.get(name);
        if (component?.initialized) {
            // Call dispose if available
            if (component.instance?.dispose) {
                component.instance.dispose();
            }
            component.instance = undefined;
            component.initialized = false;
            this.metrics.activeComponents--;
        }
    }

    public setCache(key: string, data: any, ttlMs: number = 60000): void { // 1 min default for better memory usage
        // Skip caching in low memory mode for non-critical data
        if (this.lowMemoryMode && ttlMs > 60000) {
            return;
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        });
        this.metrics.cachedItems = this.cache.size;
    }

    public getCache<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            this.metrics.cachedItems = this.cache.size;
            return null;
        }

        return cached.data as T;
    }

    public clearCache(pattern?: string): void {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
        this.metrics.cachedItems = this.cache.size;
    }

    public async executeWithThrottling<T>(
        operation: () => Promise<T>,
        priority: 'high' | 'medium' | 'low' = 'medium'
    ): Promise<T> {
        if (!this.resourceThrottling) {
            return operation();
        }

        // Check system resources
        if (this.lowMemoryMode && priority === 'low') {
            throw new Error('Operation deferred due to low memory');
        }

        // Add delay for medium/low priority operations under load
        if (this.metrics.memoryUsage > 400 && priority !== 'high') {
            await this.delay(priority === 'medium' ? 100 : 500);
        }

        return operation();
    }

    public getMetrics(): ResourceMetrics {
        return { ...this.metrics };
    }

    public optimizeForSystem(): void {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

        // Auto-adjust settings based on available memory - more aggressive
        if (heapUsedMB > 200) {
            this.enableLowMemoryMode();
        } else if (heapUsedMB < 150 && this.lowMemoryMode) {
            this.disableLowMemoryMode();
        }

        // Unload low-priority components if memory is tight
        if (heapUsedMB > 250) {
            this.unloadLowPriorityComponents();
        }
    }

    private shouldDeferLoading(component: LazyComponent<any>): boolean {
        if (!this.resourceThrottling) return false;

        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        
        // Defer low priority components if memory usage is high
        if (component.priority === 'low' && memUsage > 300) {
            return true;
        }

        // Defer medium priority if memory is very high
        if (component.priority === 'medium' && memUsage > 500) {
            return true;
        }

        return false;
    }

    private async waitForResources(): Promise<void> {
        let retries = 0;
        const maxRetries = 10;

        while (retries < maxRetries) {
            const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
            if (memUsage < 400) break;

            await this.delay(1000 * Math.pow(2, retries)); // Exponential backoff
            retries++;
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        }
    }

    private enableLowMemoryMode(): void {
        if (this.lowMemoryMode) return;

        this.lowMemoryMode = true;
        console.log('Echo AI: Enabled low memory mode');

        // Clear non-essential cache
        this.clearNonEssentialCache();
        
        // Reduce cache TTL
        this.reduceCacheTTL();
        
        // Notify components to reduce memory usage
        this.notifyLowMemoryMode();
    }

    private disableLowMemoryMode(): void {
        if (!this.lowMemoryMode) return;

        this.lowMemoryMode = false;
        console.log('Echo AI: Disabled low memory mode');
    }

    private clearNonEssentialCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            // Remove cache items with long TTL or older than 5 minutes
            if (cached.ttl > 300000 || (now - cached.timestamp) > 300000) {
                this.cache.delete(key);
            }
        }
        this.metrics.cachedItems = this.cache.size;
    }

    private reduceCacheTTL(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (cached.ttl > 60000) {
                cached.ttl = 60000; // Reduce to 1 minute max
                // If already expired with new TTL, remove it
                if ((now - cached.timestamp) > cached.ttl) {
                    this.cache.delete(key);
                }
            }
        }
        this.metrics.cachedItems = this.cache.size;
    }

    private notifyLowMemoryMode(): void {
        // Notify all loaded components about low memory mode
        for (const [name, component] of this.components.entries()) {
            if (component.initialized && component.instance?.onLowMemory) {
                try {
                    component.instance.onLowMemory();
                } catch (error) {
                    console.error(`Error notifying component '${name}' of low memory:`, error);
                }
            }
        }
    }

    private unloadLowPriorityComponents(): void {
        for (const [name, component] of this.components.entries()) {
            if (component.initialized && component.priority === 'low') {
                console.log(`Unloading low priority component: ${name}`);
                this.unloadComponent(name);
            }
        }
    }

    private startMonitoring(): void {
        this.memoryMonitorInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024;
            
            // Auto-optimize based on usage
            this.optimizeForSystem();
            
        }, 30000); // Check every 30 seconds
    }

    private setupCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredCache();
            this.metrics.lastCleanup = Date.now();
        }, 60000); // Cleanup every minute
    }

    private cleanupExpiredCache(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        this.metrics.cachedItems = this.cache.size;
        
        if (cleaned > 0) {
            console.log(`Echo AI: Cleaned ${cleaned} expired cache entries`);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }

        // Dispose all components
        for (const [name, component] of this.components.entries()) {
            if (component.initialized) {
                this.unloadComponent(name);
            }
        }

        this.cache.clear();
        this.components.clear();
    }
}