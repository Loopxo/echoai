import { OptimizedResourceManager } from '../services/OptimizedResourceManager';
interface PerformanceReport {
    timestamp: string;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    activeComponents: number;
    cacheItems: number;
    recommendations: string[];
    systemInfo: {
        platform: string;
        nodeVersion: string;
        vscodeVersion: string;
    };
}
export declare class PerformanceReporter {
    private resourceManager;
    constructor(resourceManager: OptimizedResourceManager);
    generateReport(): PerformanceReport;
    showPerformanceReport(): void;
    private generateRecommendations;
    private getReportHTML;
    private getMemoryStatusClass;
}
export {};
//# sourceMappingURL=PerformanceReporter.d.ts.map