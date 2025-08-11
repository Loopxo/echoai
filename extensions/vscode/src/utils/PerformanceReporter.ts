import * as vscode from 'vscode';
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

export class PerformanceReporter {
    constructor(private resourceManager: OptimizedResourceManager) {}

    public generateReport(): PerformanceReport {
        const memUsage = process.memoryUsage();
        const metrics = this.resourceManager.getMetrics();

        const report: PerformanceReport = {
            timestamp: new Date().toISOString(),
            memoryUsage: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024)
            },
            activeComponents: metrics.activeComponents,
            cacheItems: metrics.cachedItems,
            recommendations: this.generateRecommendations(memUsage, metrics),
            systemInfo: {
                platform: process.platform,
                nodeVersion: process.version,
                vscodeVersion: vscode.version
            }
        };

        return report;
    }

    public showPerformanceReport(): void {
        const report = this.generateReport();
        
        const panel = vscode.window.createWebviewPanel(
            'echo-ai-performance',
            'Echo AI Performance Report',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.getReportHTML(report);
    }

    private generateRecommendations(memUsage: NodeJS.MemoryUsage, metrics: any): string[] {
        const recommendations: string[] = [];
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

        if (heapUsedMB > 200) {
            recommendations.push('High memory usage detected. Consider restarting VS Code.');
        }

        if (heapUsedMB > 150) {
            recommendations.push('Reduce analysis types in settings (echoAI.analysis.enabledTypes)');
            recommendations.push('Increase analysis delay (echoAI.analysis.analysisDelay)');
        }

        if (metrics.activeComponents > 10) {
            recommendations.push('Many components are active. Some features may auto-unload to save memory.');
        }

        if (metrics.cachedItems > 100) {
            recommendations.push('Cache is growing large. Consider clearing it periodically.');
        }

        if (heapUsedMB < 100) {
            recommendations.push('System running efficiently! All features are available.');
        }

        return recommendations;
    }

    private getReportHTML(report: PerformanceReport): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Echo AI Performance Report</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
        }
        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .timestamp { color: var(--vscode-descriptionForeground); }
        .section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metric {
            background: var(--vscode-editor-selectionBackground);
            padding: 15px;
            border-radius: 5px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-charts-blue);
        }
        .metric-label {
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .recommendations {
            list-style: none;
            padding: 0;
        }
        .recommendations li {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 10px;
            margin: 8px 0;
            border-left: 4px solid var(--vscode-charts-blue);
            border-radius: 3px;
        }
        .system-info {
            background: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 3px;
            font-family: monospace;
        }
        .status-good { color: var(--vscode-testing-iconPassed); }
        .status-warning { color: var(--vscode-warningForeground); }
        .status-error { color: var(--vscode-errorForeground); }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📊 Echo AI Performance Report</div>
        <div class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</div>
    </div>

    <div class="section">
        <h2>Current Performance Metrics</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-value ${this.getMemoryStatusClass(report.memoryUsage.heapUsed)}">${report.memoryUsage.heapUsed} MB</div>
                <div class="metric-label">Memory Usage<br>Heap: ${report.memoryUsage.heapTotal} MB</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.activeComponents}</div>
                <div class="metric-label">Active Components<br>Currently loaded</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.cacheItems}</div>
                <div class="metric-label">Cache Items<br>Stored in memory</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul class="recommendations">
            ${report.recommendations.map(rec => `<li>💡 ${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>System Information</h2>
        <div class="system-info">
            Platform: ${report.systemInfo.platform}<br>
            Node.js: ${report.systemInfo.nodeVersion}<br>
            VS Code: ${report.systemInfo.vscodeVersion}<br>
            RSS Memory: ${report.memoryUsage.rss} MB<br>
            External Memory: ${report.memoryUsage.external} MB
        </div>
    </div>

    <div style="text-align: center; margin-top: 30px; color: var(--vscode-descriptionForeground);">
        <p>Performance monitoring helps optimize Echo AI for your development environment.</p>
    </div>
</body>
</html>`;
    }

    private getMemoryStatusClass(heapUsedMB: number): string {
        if (heapUsedMB > 200) return 'status-error';
        if (heapUsedMB > 150) return 'status-warning';
        return 'status-good';
    }
}