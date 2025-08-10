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
exports.SecurityDashboard = void 0;
const vscode = __importStar(require("vscode"));
class SecurityDashboard {
    context;
    echoProvider;
    vulnerabilityScanner;
    remediationEngine;
    // Dashboard state
    metrics;
    alerts = [];
    scanHistory = [];
    remediationPlans = new Map();
    // Status bar integration
    statusBarItem;
    securityDiagnostics;
    // Webview panels
    dashboardPanel;
    vulnerabilityPanel;
    constructor(context, echoProvider, vulnerabilityScanner, remediationEngine) {
        this.context = context;
        this.echoProvider = echoProvider;
        this.vulnerabilityScanner = vulnerabilityScanner;
        this.remediationEngine = remediationEngine;
        this.metrics = this.initializeMetrics();
        this.securityDiagnostics = vscode.languages.createDiagnosticCollection('echo-ai-security');
        this.setupStatusBar();
        this.setupEventHandlers();
    }
    async showSecurityDashboard() {
        if (this.dashboardPanel) {
            this.dashboardPanel.reveal();
            return;
        }
        this.dashboardPanel = vscode.window.createWebviewPanel('echo-ai-security-dashboard', '🛡️ Echo AI Security Dashboard', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.context.extensionUri]
        });
        this.dashboardPanel.webview.html = await this.getDashboardWebviewContent();
        // Handle webview messages
        this.dashboardPanel.webview.onDidReceiveMessage(async (message) => {
            await this.handleDashboardMessage(message);
        });
        this.dashboardPanel.onDidDispose(() => {
            this.dashboardPanel = undefined;
        });
    }
    async runSecurityScan(options) {
        try {
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Running Security Scan...',
                cancellable: true
            }, async (progress, token) => {
                // Start scan
                const scanResult = await this.vulnerabilityScanner.scanWorkspace({
                    includeTests: options?.includeTests,
                    aiEnhanced: options?.aiEnhanced
                });
                // Update metrics and history
                this.updateMetricsFromScan(scanResult);
                this.addScanToHistory(scanResult);
                // Update diagnostics
                this.updateSecurityDiagnostics(scanResult.vulnerabilities);
                // Generate alerts for new critical/high vulnerabilities
                this.generateAlertsFromScan(scanResult);
                // Update dashboard if open
                if (this.dashboardPanel) {
                    await this.refreshDashboard();
                }
                // Update status bar
                this.updateStatusBar(scanResult);
                return scanResult;
            });
            const latestScan = this.vulnerabilityScanner.getLatestScanResult();
            if (latestScan) {
                const criticalCount = latestScan.summary.critical;
                const highCount = latestScan.summary.high;
                if (criticalCount > 0 || highCount > 0) {
                    const action = await vscode.window.showWarningMessage(`Security scan found ${criticalCount} critical and ${highCount} high severity vulnerabilities.`, 'View Dashboard', 'Start Remediation');
                    if (action === 'View Dashboard') {
                        await this.showSecurityDashboard();
                    }
                    else if (action === 'Start Remediation') {
                        await this.startAutomatedRemediation();
                    }
                }
                else {
                    vscode.window.showInformationMessage(`Security scan completed. Found ${latestScan.summary.total} issues total.`);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Security scan failed: ${error}`);
        }
    }
    async startAutomatedRemediation() {
        const latestScan = this.vulnerabilityScanner.getLatestScanResult();
        if (!latestScan || latestScan.vulnerabilities.length === 0) {
            vscode.window.showInformationMessage('No vulnerabilities found to remediate');
            return;
        }
        try {
            // Create remediation plan
            const plan = await this.remediationEngine.createRemediationPlan(latestScan.vulnerabilities);
            this.remediationPlans.set(plan.id, plan);
            // Show remediation plan to user
            const action = await vscode.window.showInformationMessage(`Created remediation plan with ${plan.actions.length} actions. Estimated time: ${Math.round(plan.estimatedTime / 60)} minutes.`, 'Execute Plan', 'View Plan', 'Cancel');
            if (action === 'Execute Plan') {
                await this.executeRemediationPlan(plan.id);
            }
            else if (action === 'View Plan') {
                await this.showRemediationPlan(plan);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create remediation plan: ${error}`);
        }
    }
    async executeRemediationPlan(planId) {
        const plan = this.remediationPlans.get(planId);
        if (!plan) {
            vscode.window.showErrorMessage('Remediation plan not found');
            return;
        }
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Executing Security Remediation...',
                cancellable: false
            }, async (progress) => {
                const results = await this.remediationEngine.executeRemediationPlan(plan, {
                    autoApprove: false,
                    skipValidation: false,
                    dryRun: false
                });
                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success).length;
                if (successful > 0) {
                    vscode.window.showInformationMessage(`Remediation completed: ${successful} actions succeeded, ${failed} failed`);
                    // Re-run scan to verify fixes
                    setTimeout(() => this.runSecurityScan(), 2000);
                }
                else {
                    vscode.window.showWarningMessage('No remediation actions were successful');
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Remediation execution failed: ${error}`);
        }
    }
    async generateComplianceReport(framework) {
        const latestScan = this.vulnerabilityScanner.getLatestScanResult();
        const vulnerabilities = latestScan?.vulnerabilities || [];
        // Generate framework-specific compliance report
        switch (framework) {
            case 'OWASP':
                return this.generateOWASPComplianceReport(vulnerabilities);
            case 'PCI-DSS':
                return this.generatePCIComplianceReport(vulnerabilities);
            case 'GDPR':
                return this.generateGDPRComplianceReport(vulnerabilities);
            case 'HIPAA':
                return this.generateHIPAAComplianceReport(vulnerabilities);
            case 'SOC2':
                return this.generateSOC2ComplianceReport(vulnerabilities);
            default:
                throw new Error(`Unsupported compliance framework: ${framework}`);
        }
    }
    async getDashboardWebviewContent() {
        const metrics = this.metrics;
        const recentAlerts = this.alerts.slice(0, 5);
        const latestScan = this.scanHistory[0];
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Dashboard</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .dashboard-title { font-size: 28px; font-weight: bold; color: var(--vscode-foreground); }
        .security-score { display: flex; align-items: center; }
        .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: white; margin-right: 15px; }
        .score-excellent { background: var(--vscode-testing-iconPassed); }
        .score-good { background: var(--vscode-charts-green); }
        .score-warning { background: var(--vscode-notificationsWarningIcon-foreground); }
        .score-critical { background: var(--vscode-notificationsErrorIcon-foreground); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: var(--vscode-editor-selectionBackground); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; }
        .metric-title { font-size: 14px; color: var(--vscode-descriptionForeground); margin-bottom: 10px; text-transform: uppercase; }
        .metric-value { font-size: 32px; font-weight: bold; color: var(--vscode-foreground); margin-bottom: 5px; }
        .metric-subtitle { font-size: 12px; color: var(--vscode-descriptionForeground); }
        .severity-bar { height: 8px; border-radius: 4px; margin: 10px 0; display: flex; }
        .severity-critical { background: var(--vscode-notificationsErrorIcon-foreground); }
        .severity-high { background: var(--vscode-editorWarning-foreground); }
        .severity-medium { background: var(--vscode-notificationsWarningIcon-foreground); }
        .severity-low { background: var(--vscode-notificationsInfoIcon-foreground); }
        .severity-info { background: var(--vscode-descriptionForeground); }
        .alerts-section { margin: 30px 0; }
        .alert { background: var(--vscode-inputValidation-warningBackground); border-left: 4px solid var(--vscode-notificationsWarningIcon-foreground); padding: 15px; margin: 10px 0; border-radius: 0 5px 5px 0; }
        .alert.critical { border-left-color: var(--vscode-notificationsErrorIcon-foreground); background: var(--vscode-inputValidation-errorBackground); }
        .alert.high { border-left-color: var(--vscode-editorWarning-foreground); }
        .alert-title { font-weight: bold; margin-bottom: 5px; }
        .alert-time { font-size: 12px; color: var(--vscode-descriptionForeground); }
        .action-buttons { display: flex; gap: 10px; margin: 20px 0; }
        .button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; }
        .button:hover { background: var(--vscode-button-hoverBackground); }
        .button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .quick-actions { background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; padding: 20px; margin: 20px 0; }
        .compliance-badges { display: flex; gap: 10px; margin: 15px 0; }
        .badge { padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; }
        .badge.compliant { background: var(--vscode-testing-iconPassed); color: white; }
        .badge.non-compliant { background: var(--vscode-notificationsErrorIcon-foreground); color: white; }
        .badge.partial { background: var(--vscode-notificationsWarningIcon-foreground); color: white; }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="dashboard-title">🛡️ Security Dashboard</div>
        <div class="security-score">
            <div class="score-circle ${this.getScoreClass(metrics.riskScore)}">
                ${100 - metrics.riskScore}
            </div>
            <div>
                <div style="font-weight: bold;">Security Score</div>
                <div style="font-size: 12px; color: var(--vscode-descriptionForeground);">
                    ${this.getScoreLabel(100 - metrics.riskScore)}
                </div>
            </div>
        </div>
    </div>

    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-title">Total Vulnerabilities</div>
            <div class="metric-value">${metrics.totalVulnerabilities}</div>
            <div class="severity-bar">
                <div class="severity-critical" style="width: ${(metrics.vulnerabilitiesBySeverity.critical / metrics.totalVulnerabilities) * 100 || 0}%;"></div>
                <div class="severity-high" style="width: ${(metrics.vulnerabilitiesBySeverity.high / metrics.totalVulnerabilities) * 100 || 0}%;"></div>
                <div class="severity-medium" style="width: ${(metrics.vulnerabilitiesBySeverity.medium / metrics.totalVulnerabilities) * 100 || 0}%;"></div>
                <div class="severity-low" style="width: ${(metrics.vulnerabilitiesBySeverity.low / metrics.totalVulnerabilities) * 100 || 0}%;"></div>
            </div>
            <div class="metric-subtitle">
                ${metrics.vulnerabilitiesBySeverity.critical} Critical • ${metrics.vulnerabilitiesBySeverity.high} High • ${metrics.vulnerabilitiesBySeverity.medium} Medium
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-title">Risk Score</div>
            <div class="metric-value" style="color: ${metrics.riskScore > 70 ? 'var(--vscode-notificationsErrorIcon-foreground)' : metrics.riskScore > 40 ? 'var(--vscode-notificationsWarningIcon-foreground)' : 'var(--vscode-testing-iconPassed)'};">
                ${metrics.riskScore}
            </div>
            <div class="metric-subtitle">Based on severity and count</div>
        </div>

        <div class="metric-card">
            <div class="metric-title">Remediation Progress</div>
            <div class="metric-value">${Math.round((metrics.remediationProgress.completed / (metrics.remediationProgress.completed + metrics.remediationProgress.planned + metrics.remediationProgress.inProgress)) * 100) || 0}%</div>
            <div class="metric-subtitle">
                ${metrics.remediationProgress.completed} Fixed • ${metrics.remediationProgress.planned} Planned
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-title">Compliance Status</div>
            <div class="compliance-badges">
                <span class="badge ${latestScan?.complianceStatus.owasp ? 'compliant' : 'non-compliant'}">OWASP</span>
                <span class="badge ${latestScan?.complianceStatus.pci ? 'compliant' : 'non-compliant'}">PCI</span>
                <span class="badge ${latestScan?.complianceStatus.gdpr ? 'compliant' : 'non-compliant'}">GDPR</span>
            </div>
            <div class="metric-subtitle">${metrics.complianceScore}/100 Compliance Score</div>
        </div>
    </div>

    <div class="quick-actions">
        <h3>Quick Actions</h3>
        <div class="action-buttons">
            <button class="button" onclick="runFullScan()">🔍 Run Full Scan</button>
            <button class="button" onclick="startRemediation()">🔧 Start Remediation</button>
            <button class="button secondary" onclick="generateReport()">📊 Generate Report</button>
            <button class="button secondary" onclick="viewVulnerabilities()">👁️ View All Vulnerabilities</button>
        </div>
    </div>

    ${recentAlerts.length > 0 ? `
        <div class="alerts-section">
            <h3>Recent Security Alerts</h3>
            ${recentAlerts.map(alert => `
                <div class="alert ${alert.severity}">
                    <div class="alert-title">${alert.title}</div>
                    <div>${alert.message}</div>
                    <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
                </div>
            `).join('')}
        </div>
    ` : ''}

    <script>
        const vscode = acquireVsCodeApi();
        
        function runFullScan() {
            vscode.postMessage({ command: 'runFullScan' });
        }
        
        function startRemediation() {
            vscode.postMessage({ command: 'startRemediation' });
        }
        
        function generateReport() {
            vscode.postMessage({ command: 'generateReport' });
        }
        
        function viewVulnerabilities() {
            vscode.postMessage({ command: 'viewVulnerabilities' });
        }
        
        function acknowledgeAlert(alertId) {
            vscode.postMessage({ command: 'acknowledgeAlert', alertId });
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            vscode.postMessage({ command: 'refresh' });
        }, 30000);
    </script>
</body>
</html>`;
    }
    async handleDashboardMessage(message) {
        switch (message.command) {
            case 'runFullScan':
                await this.runSecurityScan({ fullScan: true, aiEnhanced: true });
                break;
            case 'startRemediation':
                await this.startAutomatedRemediation();
                break;
            case 'generateReport':
                await this.generateAndShowComplianceReport();
                break;
            case 'viewVulnerabilities':
                await this.showVulnerabilitiesView();
                break;
            case 'acknowledgeAlert':
                this.acknowledgeAlert(message.alertId);
                break;
            case 'refresh':
                await this.refreshDashboard();
                break;
        }
    }
    async refreshDashboard() {
        if (this.dashboardPanel) {
            this.dashboardPanel.webview.html = await this.getDashboardWebviewContent();
        }
    }
    updateMetricsFromScan(scanResult) {
        this.metrics = {
            totalVulnerabilities: scanResult.summary.total,
            vulnerabilitiesBySeverity: scanResult.summary,
            vulnerabilitiesByCategory: this.calculateCategoryDistribution(scanResult.vulnerabilities),
            riskScore: scanResult.riskScore,
            complianceScore: this.calculateComplianceScore(scanResult.complianceStatus),
            trendData: this.updateTrendData(scanResult),
            remediationProgress: {
                planned: 0,
                inProgress: 0,
                completed: 0,
                failed: 0
            }
        };
    }
    addScanToHistory(scanResult) {
        this.scanHistory.unshift(scanResult);
        // Keep only last 10 scans
        if (this.scanHistory.length > 10) {
            this.scanHistory = this.scanHistory.slice(0, 10);
        }
    }
    generateAlertsFromScan(scanResult) {
        const criticalVulns = scanResult.vulnerabilities.filter(v => v.severity === 'critical');
        const highVulns = scanResult.vulnerabilities.filter(v => v.severity === 'high');
        // Generate alerts for critical vulnerabilities
        for (const vuln of criticalVulns.slice(0, 3)) { // Limit to 3 alerts
            this.addAlert({
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'new_vulnerability',
                severity: 'critical',
                title: `Critical Vulnerability: ${vuln.type}`,
                message: vuln.description,
                timestamp: Date.now(),
                acknowledged: false,
                vulnerability: vuln
            });
        }
        // Scan completion alert
        this.addAlert({
            id: `scan_complete_${Date.now()}`,
            type: 'scan_completed',
            severity: criticalVulns.length > 0 ? 'critical' : highVulns.length > 0 ? 'high' : 'low',
            title: 'Security Scan Completed',
            message: `Found ${scanResult.summary.total} vulnerabilities (${scanResult.summary.critical} critical, ${scanResult.summary.high} high)`,
            timestamp: Date.now(),
            acknowledged: false
        });
    }
    addAlert(alert) {
        this.alerts.unshift(alert);
        // Keep only last 20 alerts
        if (this.alerts.length > 20) {
            this.alerts = this.alerts.slice(0, 20);
        }
    }
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
        }
    }
    updateSecurityDiagnostics(vulnerabilities) {
        this.securityDiagnostics.clear();
        // Group vulnerabilities by file
        const vulnerabilitiesByFile = new Map();
        for (const vuln of vulnerabilities) {
            const file = vuln.location.file;
            if (!vulnerabilitiesByFile.has(file)) {
                vulnerabilitiesByFile.set(file, []);
            }
            vulnerabilitiesByFile.get(file).push(vuln);
        }
        // Create diagnostics for each file
        for (const [filePath, vulns] of vulnerabilitiesByFile) {
            try {
                const uri = vscode.Uri.file(filePath);
                const diagnostics = vulns.map(vuln => this.createDiagnosticFromVulnerability(vuln));
                this.securityDiagnostics.set(uri, diagnostics);
            }
            catch (error) {
                console.warn(`Failed to create diagnostics for ${filePath}:`, error);
            }
        }
    }
    createDiagnosticFromVulnerability(vulnerability) {
        const line = Math.max(0, vulnerability.location.line - 1);
        const endLine = vulnerability.location.endLine ? vulnerability.location.endLine - 1 : line;
        const column = vulnerability.location.column || 0;
        const endColumn = vulnerability.location.endColumn || column + 10;
        const range = new vscode.Range(line, column, endLine, endColumn);
        const severityMap = {
            critical: vscode.DiagnosticSeverity.Error,
            high: vscode.DiagnosticSeverity.Error,
            medium: vscode.DiagnosticSeverity.Warning,
            low: vscode.DiagnosticSeverity.Information,
            info: vscode.DiagnosticSeverity.Hint
        };
        const diagnostic = new vscode.Diagnostic(range, `[${vulnerability.severity.toUpperCase()}] ${vulnerability.title}: ${vulnerability.description}`, severityMap[vulnerability.severity]);
        diagnostic.source = 'Echo AI Security';
        diagnostic.code = vulnerability.cwe || vulnerability.type;
        return diagnostic;
    }
    // Helper methods for dashboard display
    getScoreClass(riskScore) {
        const securityScore = 100 - riskScore;
        if (securityScore >= 90)
            return 'score-excellent';
        if (securityScore >= 70)
            return 'score-good';
        if (securityScore >= 50)
            return 'score-warning';
        return 'score-critical';
    }
    getScoreLabel(securityScore) {
        if (securityScore >= 90)
            return 'Excellent';
        if (securityScore >= 70)
            return 'Good';
        if (securityScore >= 50)
            return 'Needs Attention';
        return 'Critical';
    }
    calculateCategoryDistribution(vulnerabilities) {
        const distribution = new Map();
        for (const vuln of vulnerabilities) {
            const category = vuln.category;
            distribution.set(category, (distribution.get(category) || 0) + 1);
        }
        return distribution;
    }
    calculateComplianceScore(complianceStatus) {
        const frameworks = Object.values(complianceStatus);
        const compliantCount = frameworks.filter(status => status).length;
        return Math.round((compliantCount / frameworks.length) * 100);
    }
    updateTrendData(scanResult) {
        // Simplified trend data - would be more sophisticated in real implementation
        return {
            scansOverTime: [],
            severityTrends: [],
            fixedOverTime: []
        };
    }
    setupStatusBar() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'echo-ai.showSecurityDashboard';
        this.updateStatusBar();
        this.statusBarItem.show();
    }
    updateStatusBar(scanResult) {
        if (scanResult) {
            const critical = scanResult.summary.critical;
            const high = scanResult.summary.high;
            if (critical > 0) {
                this.statusBarItem.text = `🚨 Security: ${critical} Critical`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }
            else if (high > 0) {
                this.statusBarItem.text = `⚠️ Security: ${high} High`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }
            else {
                this.statusBarItem.text = `✅ Security: Clean`;
                this.statusBarItem.backgroundColor = undefined;
            }
        }
        else {
            this.statusBarItem.text = `🛡️ Security`;
            this.statusBarItem.backgroundColor = undefined;
        }
        this.statusBarItem.tooltip = 'Click to open Security Dashboard';
    }
    setupEventHandlers() {
        // Listen for file changes to trigger incremental scans
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            // Run quick scan on saved file
            if (this.shouldScanFile(document)) {
                // Implement incremental scan logic
            }
        });
    }
    shouldScanFile(document) {
        const supportedTypes = ['javascript', 'typescript', 'python', 'java', 'csharp'];
        return supportedTypes.includes(document.languageId);
    }
    initializeMetrics() {
        return {
            totalVulnerabilities: 0,
            vulnerabilitiesBySeverity: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
            },
            vulnerabilitiesByCategory: new Map(),
            riskScore: 0,
            complianceScore: 100,
            trendData: {
                scansOverTime: [],
                severityTrends: [],
                fixedOverTime: []
            },
            remediationProgress: {
                planned: 0,
                inProgress: 0,
                completed: 0,
                failed: 0
            }
        };
    }
    // Compliance report generators
    async generateOWASPComplianceReport(vulnerabilities) {
        // Implementation for OWASP Top 10 compliance
        return {
            framework: 'OWASP',
            status: 'partial',
            score: 75,
            requirements: [],
            recommendations: [],
            lastAssessed: Date.now()
        };
    }
    async generatePCIComplianceReport(vulnerabilities) {
        // Implementation for PCI DSS compliance
        return {
            framework: 'PCI-DSS',
            status: 'non_compliant',
            score: 60,
            requirements: [],
            recommendations: [],
            lastAssessed: Date.now()
        };
    }
    async generateGDPRComplianceReport(vulnerabilities) {
        // Implementation for GDPR compliance
        return {
            framework: 'GDPR',
            status: 'compliant',
            score: 85,
            requirements: [],
            recommendations: [],
            lastAssessed: Date.now()
        };
    }
    async generateHIPAAComplianceReport(vulnerabilities) {
        // Implementation for HIPAA compliance
        return {
            framework: 'HIPAA',
            status: 'partial',
            score: 70,
            requirements: [],
            recommendations: [],
            lastAssessed: Date.now()
        };
    }
    async generateSOC2ComplianceReport(vulnerabilities) {
        // Implementation for SOC 2 compliance
        return {
            framework: 'SOC2',
            status: 'compliant',
            score: 90,
            requirements: [],
            recommendations: [],
            lastAssessed: Date.now()
        };
    }
    async generateAndShowComplianceReport() {
        const framework = await vscode.window.showQuickPick(['OWASP', 'PCI-DSS', 'GDPR', 'HIPAA', 'SOC2'], { placeHolder: 'Select compliance framework' });
        if (framework) {
            const report = await this.generateComplianceReport(framework);
            // Show compliance report in webview
        }
    }
    async showVulnerabilitiesView() {
        // Implementation for detailed vulnerabilities view
    }
    async showRemediationPlan(plan) {
        // Implementation for remediation plan view
    }
    // Public interface
    dispose() {
        this.statusBarItem.dispose();
        this.securityDiagnostics.dispose();
        if (this.dashboardPanel) {
            this.dashboardPanel.dispose();
        }
        if (this.vulnerabilityPanel) {
            this.vulnerabilityPanel.dispose();
        }
    }
    getMetrics() {
        return this.metrics;
    }
    getAlerts() {
        return this.alerts;
    }
    getScanHistory() {
        return this.scanHistory;
    }
}
exports.SecurityDashboard = SecurityDashboard;
//# sourceMappingURL=SecurityDashboard.js.map