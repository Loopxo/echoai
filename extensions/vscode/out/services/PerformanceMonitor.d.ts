export interface PerformanceMetrics {
    timestamp: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    cpuUsage: {
        user: number;
        system: number;
    };
    analysisMetrics: {
        totalAnalyses: number;
        averageTime: number;
        timeouts: number;
        cacheHitRate: number;
        concurrentAnalyses: number;
    };
    vsCodeMetrics: {
        activeEditors: number;
        openDocuments: number;
        diagnosticsCount: number;
    };
    systemMetrics: {
        totalMemory: number;
        freeMemory: number;
        cpuCount: number;
        loadAverage: number[];
    };
}
export interface PerformanceAlert {
    type: 'memory' | 'cpu' | 'analysis' | 'system';
    severity: 'info' | 'warning' | 'error';
    message: string;
    metrics: Partial<PerformanceMetrics>;
    timestamp: number;
    suggestions: string[];
}
export interface PerformanceTrend {
    metric: keyof PerformanceMetrics;
    trend: 'improving' | 'stable' | 'degrading';
    changePercent: number;
    timeframe: number;
}
export declare class PerformanceMonitor {
    private metrics;
    private alerts;
    private isMonitoring;
    private monitoringInterval;
    private statusBarItem;
    private readonly MEMORY_WARNING_THRESHOLD;
    private readonly MEMORY_ERROR_THRESHOLD;
    private readonly CPU_WARNING_THRESHOLD;
    private readonly CPU_ERROR_THRESHOLD;
    private readonly ANALYSIS_TIME_WARNING;
    private readonly ANALYSIS_TIME_ERROR;
    private readonly MAX_METRICS_HISTORY;
    private readonly MAX_ALERTS_HISTORY;
    private analysisStartTimes;
    private totalAnalyses;
    private totalAnalysisTime;
    private analysisTimeouts;
    private concurrentAnalyses;
    private cacheHits;
    private cacheMisses;
    constructor();
    startMonitoring(intervalMs?: number): void;
    stopMonitoring(): void;
    private collectMetrics;
    private getTotalDiagnosticsCount;
    private analyzeMetrics;
    private createAlert;
    private setupStatusBar;
    private updateStatusBar;
    showPerformanceReport(): void;
    private generatePerformanceReportHTML;
    private calculateTrends;
    private calculateChangePercent;
    private classifyTrend;
    private formatBytes;
    startAnalysis(id: string): void;
    endAnalysis(id: string, success?: boolean): void;
    recordCacheHit(): void;
    recordCacheMiss(): void;
    getLatestMetrics(): PerformanceMetrics | null;
    getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[];
    clearAlerts(): void;
    dispose(): void;
}
//# sourceMappingURL=PerformanceMonitor.d.ts.map