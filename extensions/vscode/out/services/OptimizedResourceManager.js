"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizedResourceManager = void 0;
class OptimizedResourceManager {
    configManager;
    static instance;
    components = new Map();
    cache = new Map();
    cleanupInterval;
    memoryMonitorInterval;
    resourceThrottling = true;
    lowMemoryMode = false;
    metrics;
    constructor(configManager) {
        this.configManager = configManager;
        this.resourceThrottling = this.configManager.get('optimization.resourceThrottling', true);
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
    static getInstance(configManager) {
        if (!OptimizedResourceManager.instance) {
            OptimizedResourceManager.instance = new OptimizedResourceManager(configManager);
        }
        return OptimizedResourceManager.instance;
    }
    registerComponent(name, factory, priority = 'medium', dependencies) {
        this.components.set(name, {
            factory,
            dependencies,
            initialized: false,
            priority,
        });
    }
    async getComponent(name) {
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
            }
            catch (error) {
                console.error(`Failed to initialize component '${name}':`, error);
                throw error;
            }
        }
        return component.instance;
    }
    isComponentLoaded(name) {
        return this.components.get(name)?.initialized ?? false;
    }
    unloadComponent(name) {
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
    setCache(key, data, ttlMs = 60000) {
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
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            this.metrics.cachedItems = this.cache.size;
            return null;
        }
        return cached.data;
    }
    clearCache(pattern) {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
        this.metrics.cachedItems = this.cache.size;
    }
    async executeWithThrottling(operation, priority = 'medium') {
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
    getMetrics() {
        return { ...this.metrics };
    }
    optimizeForSystem() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        // Auto-adjust settings based on available memory - more aggressive
        if (heapUsedMB > 200) {
            this.enableLowMemoryMode();
        }
        else if (heapUsedMB < 150 && this.lowMemoryMode) {
            this.disableLowMemoryMode();
        }
        // Unload low-priority components if memory is tight
        if (heapUsedMB > 250) {
            this.unloadLowPriorityComponents();
        }
    }
    shouldDeferLoading(component) {
        if (!this.resourceThrottling)
            return false;
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
    async waitForResources() {
        let retries = 0;
        const maxRetries = 10;
        while (retries < maxRetries) {
            const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
            if (memUsage < 400)
                break;
            await this.delay(1000 * Math.pow(2, retries)); // Exponential backoff
            retries++;
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        }
    }
    enableLowMemoryMode() {
        if (this.lowMemoryMode)
            return;
        this.lowMemoryMode = true;
        console.log('Echo AI: Enabled low memory mode');
        // Clear non-essential cache
        this.clearNonEssentialCache();
        // Reduce cache TTL
        this.reduceCacheTTL();
        // Notify components to reduce memory usage
        this.notifyLowMemoryMode();
    }
    disableLowMemoryMode() {
        if (!this.lowMemoryMode)
            return;
        this.lowMemoryMode = false;
        console.log('Echo AI: Disabled low memory mode');
    }
    clearNonEssentialCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            // Remove cache items with long TTL or older than 5 minutes
            if (cached.ttl > 300000 || (now - cached.timestamp) > 300000) {
                this.cache.delete(key);
            }
        }
        this.metrics.cachedItems = this.cache.size;
    }
    reduceCacheTTL() {
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
    notifyLowMemoryMode() {
        // Notify all loaded components about low memory mode
        for (const [name, component] of this.components.entries()) {
            if (component.initialized && component.instance?.onLowMemory) {
                try {
                    component.instance.onLowMemory();
                }
                catch (error) {
                    console.error(`Error notifying component '${name}' of low memory:`, error);
                }
            }
        }
    }
    unloadLowPriorityComponents() {
        for (const [name, component] of this.components.entries()) {
            if (component.initialized && component.priority === 'low') {
                console.log(`Unloading low priority component: ${name}`);
                this.unloadComponent(name);
            }
        }
    }
    startMonitoring() {
        this.memoryMonitorInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024;
            // Auto-optimize based on usage
            this.optimizeForSystem();
        }, 30000); // Check every 30 seconds
    }
    setupCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredCache();
            this.metrics.lastCleanup = Date.now();
        }, 60000); // Cleanup every minute
    }
    cleanupExpiredCache() {
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
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    dispose() {
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
exports.OptimizedResourceManager = OptimizedResourceManager;
//# sourceMappingURL=OptimizedResourceManager.js.map