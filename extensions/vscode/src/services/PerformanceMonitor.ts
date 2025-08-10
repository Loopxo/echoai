import * as vscode from 'vscode';
import * as os from 'os';

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
    timeframe: number; // minutes
}

export class PerformanceMonitor {
    private metrics: PerformanceMetrics[] = [];
    private alerts: PerformanceAlert[] = [];
    private isMonitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private statusBarItem: vscode.StatusBarItem | null = null;
    
    // Thresholds for alerts
    private readonly MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB
    private readonly MEMORY_ERROR_THRESHOLD = 1024 * 1024 * 1024; // 1GB
    private readonly CPU_WARNING_THRESHOLD = 70; // 70% CPU
    private readonly CPU_ERROR_THRESHOLD = 90; // 90% CPU
    private readonly ANALYSIS_TIME_WARNING = 10000; // 10 seconds
    private readonly ANALYSIS_TIME_ERROR = 30000; // 30 seconds
    private readonly MAX_METRICS_HISTORY = 100;
    private readonly MAX_ALERTS_HISTORY = 50;

    // Analysis tracking
    private analysisStartTimes: Map<string, number> = new Map();
    private totalAnalyses: number = 0;
    private totalAnalysisTime: number = 0;
    private analysisTimeouts: number = 0;
    private concurrentAnalyses: number = 0;
    private cacheHits: number = 0;
    private cacheMisses: number = 0;

    constructor() {
        this.setupStatusBar();
    }

    public startMonitoring(intervalMs: number = 10000): void {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, intervalMs);

        console.log('Performance monitoring started');
    }

    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        console.log('Performance monitoring stopped');
    }

    private async collectMetrics(): Promise<void> {
        try {
            const timestamp = Date.now();
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            const metrics: PerformanceMetrics = {
                timestamp,
                memoryUsage: {
                    heapUsed: memoryUsage.heapUsed,
                    heapTotal: memoryUsage.heapTotal,
                    external: memoryUsage.external,
                    rss: memoryUsage.rss
                },
                cpuUsage: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                analysisMetrics: {
                    totalAnalyses: this.totalAnalyses,
                    averageTime: this.totalAnalyses > 0 ? this.totalAnalysisTime / this.totalAnalyses : 0,
                    timeouts: this.analysisTimeouts,
                    cacheHitRate: (this.cacheHits + this.cacheMisses) > 0 ? 
                        this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
                    concurrentAnalyses: this.concurrentAnalyses
                },
                vsCodeMetrics: {
                    activeEditors: vscode.window.visibleTextEditors.length,
                    openDocuments: vscode.workspace.textDocuments.length,
                    diagnosticsCount: this.getTotalDiagnosticsCount()
                },
                systemMetrics: {
                    totalMemory: os.totalmem(),
                    freeMemory: os.freemem(),
                    cpuCount: os.cpus().length,
                    loadAverage: os.loadavg()
                }
            };

            this.metrics.push(metrics);
            
            // Limit history size
            if (this.metrics.length > this.MAX_METRICS_HISTORY) {
                this.metrics.shift();
            }

            // Check for performance issues
            this.analyzeMetrics(metrics);
            
            // Update status bar
            this.updateStatusBar(metrics);

        } catch (error) {
            console.error('Failed to collect performance metrics:', error);
        }
    }

    private getTotalDiagnosticsCount(): number {
        let total = 0;
        for (const document of vscode.workspace.textDocuments) {
            const diagnostics = vscode.languages.getDiagnostics(document.uri);
            total += diagnostics.length;
        }
        return total;
    }

    private analyzeMetrics(current: PerformanceMetrics): void {
        // Memory analysis
        if (current.memoryUsage.heapUsed > this.MEMORY_ERROR_THRESHOLD) {
            this.createAlert('memory', 'error', 
                `High memory usage: ${this.formatBytes(current.memoryUsage.heapUsed)}`,
                current,
                [
                    'Restart VS Code to free up memory',
                    'Close unnecessary editor tabs',
                    'Reduce analysis scope for large files',
                    'Clear analysis cache'
                ]
            );
        } else if (current.memoryUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
            this.createAlert('memory', 'warning',
                `Moderate memory usage: ${this.formatBytes(current.memoryUsage.heapUsed)}`,
                current,
                [
                    'Consider closing some editor tabs',
                    'Clear analysis cache periodically',
                    'Monitor memory usage'
                ]
            );
        }

        // Analysis performance
        if (current.analysisMetrics.averageTime > this.ANALYSIS_TIME_ERROR) {
            this.createAlert('analysis', 'error',
                `Very slow analysis performance: ${current.analysisMetrics.averageTime.toFixed(0)}ms average`,
                current,
                [
                    'Increase analysis delays',
                    'Reduce concurrent analyses',
                    'Disable some analysis types',
                    'Check system resources'
                ]
            );
        } else if (current.analysisMetrics.averageTime > this.ANALYSIS_TIME_WARNING) {
            this.createAlert('analysis', 'warning',
                `Slow analysis performance: ${current.analysisMetrics.averageTime.toFixed(0)}ms average`,
                current,
                [
                    'Monitor analysis performance',
                    'Consider optimizing file sizes'
                ]
            );
        }

        // System resource analysis
        const memoryUsagePercent = (current.systemMetrics.totalMemory - current.systemMetrics.freeMemory) / 
                                 current.systemMetrics.totalMemory * 100;
        
        if (memoryUsagePercent > 90) {
            this.createAlert('system', 'error',
                `Critical system memory usage: ${memoryUsagePercent.toFixed(1)}%`,
                current,
                [
                    'Close other applications',
                    'Restart your computer',
                    'Add more RAM if possible'
                ]
            );
        }

        // Cache performance analysis
        if (current.analysisMetrics.cacheHitRate < 0.3 && this.totalAnalyses > 10) {
            this.createAlert('analysis', 'warning',
                `Low cache hit rate: ${(current.analysisMetrics.cacheHitRate * 100).toFixed(1)}%`,
                current,
                [
                    'Increase cache duration',
                    'Review file change patterns',
                    'Consider batch analysis'
                ]
            );
        }
    }

    private createAlert(
        type: PerformanceAlert['type'],
        severity: PerformanceAlert['severity'],
        message: string,
        metrics: PerformanceMetrics,
        suggestions: string[]
    ): void {
        // Don't create duplicate alerts within 5 minutes
        const recentAlerts = this.alerts.filter(a => 
            Date.now() - a.timestamp < 300000 && 
            a.type === type && 
            a.severity === severity
        );

        if (recentAlerts.length > 0) {
            return;
        }

        const alert: PerformanceAlert = {
            type,
            severity,
            message,
            metrics,
            timestamp: Date.now(),
            suggestions
        };

        this.alerts.push(alert);
        
        // Limit alert history
        if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
            this.alerts.shift();
        }

        // Show user notification for errors
        if (severity === 'error') {
            vscode.window.showErrorMessage(
                `Echo AI Performance: ${message}`,
                'View Details',
                'Dismiss'
            ).then(selection => {
                if (selection === 'View Details') {
                    this.showPerformanceReport();
                }
            });
        } else if (severity === 'warning') {
            vscode.window.showWarningMessage(
                `Echo AI Performance: ${message}`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    this.showPerformanceReport();
                }
            });
        }

        console.log(`Performance Alert [${severity.toUpperCase()}]:`, alert);
    }

    private setupStatusBar(): void {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            90
        );
        
        this.statusBarItem.tooltip = 'Echo AI Performance Monitor';
        this.statusBarItem.command = 'echo-ai.showPerformanceReport';
    }

    private updateStatusBar(metrics: PerformanceMetrics): void {
        if (!this.statusBarItem) return;

        const memoryMB = Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024);
        const avgTime = Math.round(metrics.analysisMetrics.averageTime);
        const cacheRate = Math.round(metrics.analysisMetrics.cacheHitRate * 100);

        // Color coding based on performance
        let color = '';
        if (metrics.memoryUsage.heapUsed > this.MEMORY_ERROR_THRESHOLD || 
            metrics.analysisMetrics.averageTime > this.ANALYSIS_TIME_ERROR) {
            color = 'errorForeground';
        } else if (metrics.memoryUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD || 
                   metrics.analysisMetrics.averageTime > this.ANALYSIS_TIME_WARNING) {
            color = 'warningForeground';
        }

        this.statusBarItem.text = `$(pulse) ${memoryMB}MB ${avgTime}ms ${cacheRate}%`;
        this.statusBarItem.color = color ? new vscode.ThemeColor(color) : undefined;
        this.statusBarItem.show();
    }

    public showPerformanceReport(): void {
        const panel = vscode.window.createWebviewPanel(
            'echo-ai-performance',
            'Echo AI - Performance Report',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.generatePerformanceReportHTML();
    }

    private generatePerformanceReportHTML(): string {
        const currentMetrics = this.metrics[this.metrics.length - 1];
        const trends = this.calculateTrends();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Echo AI - Performance Report</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                    line-height: 1.6;
                }
                
                .metric-card {
                    background-color: var(--vscode-editor-selectionBackground);
                    border-radius: 8px;
                    padding: 16px;
                    margin: 16px 0;
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                }
                
                .metric-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin: 20px 0;
                }
                
                .metric-value {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: var(--vscode-textPreformat-foreground);
                }
                
                .alert {
                    padding: 12px;
                    margin: 8px 0;
                    border-radius: 4px;
                    border-left: 4px solid;
                }
                
                .alert-error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border-left-color: var(--vscode-inputValidation-errorBorder);
                }
                
                .alert-warning {
                    background-color: var(--vscode-inputValidation-warningBackground);
                    border-left-color: var(--vscode-inputValidation-warningBorder);
                }
                
                .alert-info {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border-left-color: var(--vscode-inputValidation-infoBorder);
                }
                
                .trend-improving { color: var(--vscode-gitDecoration-addedResourceForeground); }
                .trend-stable { color: var(--vscode-foreground); }
                .trend-degrading { color: var(--vscode-gitDecoration-deletedResourceForeground); }
                
                .suggestions {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                h2 {
                    color: var(--vscode-textPreformat-foreground);
                    border-bottom: 1px solid var(--vscode-textSeparator-foreground);
                    padding-bottom: 8px;
                }
            </style>
        </head>
        <body>
            <h1>📊 Echo AI Performance Report</h1>
            <p><em>Generated: ${new Date().toLocaleString()}</em></p>
            
            <h2>Current Performance Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <h3>Memory Usage</h3>
                    <div class="metric-value">${this.formatBytes(currentMetrics?.memoryUsage.heapUsed || 0)}</div>
                    <p>Heap: ${this.formatBytes(currentMetrics?.memoryUsage.heapTotal || 0)}</p>
                </div>
                
                <div class="metric-card">
                    <h3>Analysis Performance</h3>
                    <div class="metric-value">${Math.round(currentMetrics?.analysisMetrics.averageTime || 0)}ms</div>
                    <p>Average analysis time</p>
                </div>
                
                <div class="metric-card">
                    <h3>Cache Performance</h3>
                    <div class="metric-value">${Math.round((currentMetrics?.analysisMetrics.cacheHitRate || 0) * 100)}%</div>
                    <p>Cache hit rate</p>
                </div>
                
                <div class="metric-card">
                    <h3>Active Analyses</h3>
                    <div class="metric-value">${currentMetrics?.analysisMetrics.concurrentAnalyses || 0}</div>
                    <p>Currently running</p>
                </div>
            </div>
            
            <h2>Performance Trends</h2>
            ${trends.map(trend => `
                <div class="metric-card">
                    <h3 class="trend-${trend.trend}">${trend.metric} - ${trend.trend.toUpperCase()}</h3>
                    <p>Change: ${trend.changePercent > 0 ? '+' : ''}${trend.changePercent.toFixed(1)}% over ${trend.timeframe} minutes</p>
                </div>
            `).join('')}
            
            <h2>Recent Alerts</h2>
            ${this.alerts.slice(-10).reverse().map(alert => `
                <div class="alert alert-${alert.severity}">
                    <h4>${alert.type.toUpperCase()} - ${alert.severity.toUpperCase()}</h4>
                    <p>${alert.message}</p>
                    <p><em>${new Date(alert.timestamp).toLocaleString()}</em></p>
                    <div class="suggestions">
                        <strong>Suggestions:</strong>
                        <ul>
                            ${alert.suggestions.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `).join('')}
            
            <h2>System Information</h2>
            <div class="metric-card">
                <p><strong>Total Memory:</strong> ${this.formatBytes(currentMetrics?.systemMetrics.totalMemory || 0)}</p>
                <p><strong>Free Memory:</strong> ${this.formatBytes(currentMetrics?.systemMetrics.freeMemory || 0)}</p>
                <p><strong>CPU Cores:</strong> ${currentMetrics?.systemMetrics.cpuCount || 0}</p>
                <p><strong>Load Average:</strong> ${currentMetrics?.systemMetrics.loadAverage?.map(l => l.toFixed(2)).join(', ') || 'N/A'}</p>
                <p><strong>Open Documents:</strong> ${currentMetrics?.vsCodeMetrics.openDocuments || 0}</p>
                <p><strong>Active Editors:</strong> ${currentMetrics?.vsCodeMetrics.activeEditors || 0}</p>
                <p><strong>Total Diagnostics:</strong> ${currentMetrics?.vsCodeMetrics.diagnosticsCount || 0}</p>
            </div>
            
            <p><em>Performance monitoring helps optimize Echo AI for your development environment</em></p>
        </body>
        </html>`;
    }

    private calculateTrends(): PerformanceTrend[] {
        if (this.metrics.length < 2) return [];

        const trends: PerformanceTrend[] = [];
        const recent = this.metrics.slice(-10); // Last 10 data points
        const timeframe = recent.length > 1 ? 
            (recent[recent.length - 1].timestamp - recent[0].timestamp) / 60000 : 0; // minutes

        if (timeframe > 0) {
            // Memory trend
            const memoryValues = recent.map(m => m.memoryUsage.heapUsed);
            const memoryChange = this.calculateChangePercent(memoryValues);
            
            trends.push({
                metric: 'memoryUsage' as keyof PerformanceMetrics,
                trend: this.classifyTrend(memoryChange, -10, 10), // Memory: lower is better
                changePercent: memoryChange,
                timeframe: Math.round(timeframe)
            });

            // Analysis time trend
            const analysisTimeValues = recent.map(m => m.analysisMetrics.averageTime);
            const analysisTimeChange = this.calculateChangePercent(analysisTimeValues);
            
            trends.push({
                metric: 'analysisMetrics' as keyof PerformanceMetrics,
                trend: this.classifyTrend(analysisTimeChange, -15, 15), // Analysis time: lower is better
                changePercent: analysisTimeChange,
                timeframe: Math.round(timeframe)
            });
        }

        return trends;
    }

    private calculateChangePercent(values: number[]): number {
        if (values.length < 2) return 0;
        
        const first = values[0];
        const last = values[values.length - 1];
        
        if (first === 0) return 0;
        
        return ((last - first) / first) * 100;
    }

    private classifyTrend(changePercent: number, improvingThreshold: number, degradingThreshold: number): PerformanceTrend['trend'] {
        if (changePercent <= improvingThreshold) return 'improving';
        if (changePercent >= degradingThreshold) return 'degrading';
        return 'stable';
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Public methods for tracking analysis performance
    public startAnalysis(id: string): void {
        this.analysisStartTimes.set(id, Date.now());
        this.concurrentAnalyses++;
    }

    public endAnalysis(id: string, success: boolean = true): void {
        const startTime = this.analysisStartTimes.get(id);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.totalAnalysisTime += duration;
            this.totalAnalyses++;
            this.analysisStartTimes.delete(id);
        }
        
        this.concurrentAnalyses = Math.max(0, this.concurrentAnalyses - 1);
        
        if (!success) {
            this.analysisTimeouts++;
        }
    }

    public recordCacheHit(): void {
        this.cacheHits++;
    }

    public recordCacheMiss(): void {
        this.cacheMisses++;
    }

    public getLatestMetrics(): PerformanceMetrics | null {
        return this.metrics[this.metrics.length - 1] || null;
    }

    public getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[] {
        return severity ? 
            this.alerts.filter(a => a.severity === severity) : 
            [...this.alerts];
    }

    public clearAlerts(): void {
        this.alerts = [];
    }

    public dispose(): void {
        this.stopMonitoring();
        
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
        
        this.metrics = [];
        this.alerts = [];
        this.analysisStartTimes.clear();
    }
}