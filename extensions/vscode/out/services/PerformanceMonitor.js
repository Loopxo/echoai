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
exports.PerformanceMonitor = void 0;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
class PerformanceMonitor {
    metrics = [];
    alerts = [];
    isMonitoring = false;
    monitoringInterval = null;
    statusBarItem = null;
    // Thresholds for alerts
    MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB
    MEMORY_ERROR_THRESHOLD = 1024 * 1024 * 1024; // 1GB
    CPU_WARNING_THRESHOLD = 70; // 70% CPU
    CPU_ERROR_THRESHOLD = 90; // 90% CPU
    ANALYSIS_TIME_WARNING = 10000; // 10 seconds
    ANALYSIS_TIME_ERROR = 30000; // 30 seconds
    MAX_METRICS_HISTORY = 100;
    MAX_ALERTS_HISTORY = 50;
    // Analysis tracking
    analysisStartTimes = new Map();
    totalAnalyses = 0;
    totalAnalysisTime = 0;
    analysisTimeouts = 0;
    concurrentAnalyses = 0;
    cacheHits = 0;
    cacheMisses = 0;
    constructor() {
        this.setupStatusBar();
    }
    startMonitoring(intervalMs = 10000) {
        if (this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, intervalMs);
        console.log('Performance monitoring started');
    }
    stopMonitoring() {
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
    async collectMetrics() {
        try {
            const timestamp = Date.now();
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const metrics = {
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
        }
        catch (error) {
            console.error('Failed to collect performance metrics:', error);
        }
    }
    getTotalDiagnosticsCount() {
        let total = 0;
        for (const document of vscode.workspace.textDocuments) {
            const diagnostics = vscode.languages.getDiagnostics(document.uri);
            total += diagnostics.length;
        }
        return total;
    }
    analyzeMetrics(current) {
        // Memory analysis
        if (current.memoryUsage.heapUsed > this.MEMORY_ERROR_THRESHOLD) {
            this.createAlert('memory', 'error', `High memory usage: ${this.formatBytes(current.memoryUsage.heapUsed)}`, current, [
                'Restart VS Code to free up memory',
                'Close unnecessary editor tabs',
                'Reduce analysis scope for large files',
                'Clear analysis cache'
            ]);
        }
        else if (current.memoryUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
            this.createAlert('memory', 'warning', `Moderate memory usage: ${this.formatBytes(current.memoryUsage.heapUsed)}`, current, [
                'Consider closing some editor tabs',
                'Clear analysis cache periodically',
                'Monitor memory usage'
            ]);
        }
        // Analysis performance
        if (current.analysisMetrics.averageTime > this.ANALYSIS_TIME_ERROR) {
            this.createAlert('analysis', 'error', `Very slow analysis performance: ${current.analysisMetrics.averageTime.toFixed(0)}ms average`, current, [
                'Increase analysis delays',
                'Reduce concurrent analyses',
                'Disable some analysis types',
                'Check system resources'
            ]);
        }
        else if (current.analysisMetrics.averageTime > this.ANALYSIS_TIME_WARNING) {
            this.createAlert('analysis', 'warning', `Slow analysis performance: ${current.analysisMetrics.averageTime.toFixed(0)}ms average`, current, [
                'Monitor analysis performance',
                'Consider optimizing file sizes'
            ]);
        }
        // System resource analysis
        const memoryUsagePercent = (current.systemMetrics.totalMemory - current.systemMetrics.freeMemory) /
            current.systemMetrics.totalMemory * 100;
        if (memoryUsagePercent > 90) {
            this.createAlert('system', 'error', `Critical system memory usage: ${memoryUsagePercent.toFixed(1)}%`, current, [
                'Close other applications',
                'Restart your computer',
                'Add more RAM if possible'
            ]);
        }
        // Cache performance analysis
        if (current.analysisMetrics.cacheHitRate < 0.3 && this.totalAnalyses > 10) {
            this.createAlert('analysis', 'warning', `Low cache hit rate: ${(current.analysisMetrics.cacheHitRate * 100).toFixed(1)}%`, current, [
                'Increase cache duration',
                'Review file change patterns',
                'Consider batch analysis'
            ]);
        }
    }
    createAlert(type, severity, message, metrics, suggestions) {
        // Don't create duplicate alerts within 5 minutes
        const recentAlerts = this.alerts.filter(a => Date.now() - a.timestamp < 300000 &&
            a.type === type &&
            a.severity === severity);
        if (recentAlerts.length > 0) {
            return;
        }
        const alert = {
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
            vscode.window.showErrorMessage(`Echo AI Performance: ${message}`, 'View Details', 'Dismiss').then(selection => {
                if (selection === 'View Details') {
                    this.showPerformanceReport();
                }
            });
        }
        else if (severity === 'warning') {
            vscode.window.showWarningMessage(`Echo AI Performance: ${message}`, 'View Details').then(selection => {
                if (selection === 'View Details') {
                    this.showPerformanceReport();
                }
            });
        }
        console.log(`Performance Alert [${severity.toUpperCase()}]:`, alert);
    }
    setupStatusBar() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
        this.statusBarItem.tooltip = 'Echo AI Performance Monitor';
        this.statusBarItem.command = 'echo-ai.showPerformanceReport';
    }
    updateStatusBar(metrics) {
        if (!this.statusBarItem)
            return;
        const memoryMB = Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024);
        const avgTime = Math.round(metrics.analysisMetrics.averageTime);
        const cacheRate = Math.round(metrics.analysisMetrics.cacheHitRate * 100);
        // Color coding based on performance
        let color = '';
        if (metrics.memoryUsage.heapUsed > this.MEMORY_ERROR_THRESHOLD ||
            metrics.analysisMetrics.averageTime > this.ANALYSIS_TIME_ERROR) {
            color = 'errorForeground';
        }
        else if (metrics.memoryUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD ||
            metrics.analysisMetrics.averageTime > this.ANALYSIS_TIME_WARNING) {
            color = 'warningForeground';
        }
        this.statusBarItem.text = `$(pulse) ${memoryMB}MB ${avgTime}ms ${cacheRate}%`;
        this.statusBarItem.color = color ? new vscode.ThemeColor(color) : undefined;
        this.statusBarItem.show();
    }
    showPerformanceReport() {
        const panel = vscode.window.createWebviewPanel('echo-ai-performance', 'Echo AI - Performance Report', vscode.ViewColumn.Two, { enableScripts: true });
        panel.webview.html = this.generatePerformanceReportHTML();
    }
    generatePerformanceReportHTML() {
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
    calculateTrends() {
        if (this.metrics.length < 2)
            return [];
        const trends = [];
        const recent = this.metrics.slice(-10); // Last 10 data points
        const timeframe = recent.length > 1 ?
            (recent[recent.length - 1].timestamp - recent[0].timestamp) / 60000 : 0; // minutes
        if (timeframe > 0) {
            // Memory trend
            const memoryValues = recent.map(m => m.memoryUsage.heapUsed);
            const memoryChange = this.calculateChangePercent(memoryValues);
            trends.push({
                metric: 'memoryUsage',
                trend: this.classifyTrend(memoryChange, -10, 10), // Memory: lower is better
                changePercent: memoryChange,
                timeframe: Math.round(timeframe)
            });
            // Analysis time trend
            const analysisTimeValues = recent.map(m => m.analysisMetrics.averageTime);
            const analysisTimeChange = this.calculateChangePercent(analysisTimeValues);
            trends.push({
                metric: 'analysisMetrics',
                trend: this.classifyTrend(analysisTimeChange, -15, 15), // Analysis time: lower is better
                changePercent: analysisTimeChange,
                timeframe: Math.round(timeframe)
            });
        }
        return trends;
    }
    calculateChangePercent(values) {
        if (values.length < 2)
            return 0;
        const first = values[0];
        const last = values[values.length - 1];
        if (first === 0)
            return 0;
        return ((last - first) / first) * 100;
    }
    classifyTrend(changePercent, improvingThreshold, degradingThreshold) {
        if (changePercent <= improvingThreshold)
            return 'improving';
        if (changePercent >= degradingThreshold)
            return 'degrading';
        return 'stable';
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    // Public methods for tracking analysis performance
    startAnalysis(id) {
        this.analysisStartTimes.set(id, Date.now());
        this.concurrentAnalyses++;
    }
    endAnalysis(id, success = true) {
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
    recordCacheHit() {
        this.cacheHits++;
    }
    recordCacheMiss() {
        this.cacheMisses++;
    }
    getLatestMetrics() {
        return this.metrics[this.metrics.length - 1] || null;
    }
    getAlerts(severity) {
        return severity ?
            this.alerts.filter(a => a.severity === severity) :
            [...this.alerts];
    }
    clearAlerts() {
        this.alerts = [];
    }
    dispose() {
        this.stopMonitoring();
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
        this.metrics = [];
        this.alerts = [];
        this.analysisStartTimes.clear();
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=PerformanceMonitor.js.map