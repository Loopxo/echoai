import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { VulnerabilityScanner, SecurityScanResult, SecurityVulnerability } from './VulnerabilityScanner';
import { SecurityRemediationEngine } from './SecurityRemediationEngine';
export interface SecurityMetrics {
    totalVulnerabilities: number;
    vulnerabilitiesBySeverity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
    vulnerabilitiesByCategory: Map<string, number>;
    riskScore: number;
    complianceScore: number;
    trendData: {
        scansOverTime: Array<{
            date: string;
            count: number;
        }>;
        severityTrends: Array<{
            date: string;
            severity: string;
            count: number;
        }>;
        fixedOverTime: Array<{
            date: string;
            fixed: number;
        }>;
    };
    remediationProgress: {
        planned: number;
        inProgress: number;
        completed: number;
        failed: number;
    };
}
export interface SecurityAlert {
    id: string;
    type: 'new_vulnerability' | 'scan_completed' | 'remediation_failed' | 'compliance_issue';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    message: string;
    timestamp: number;
    acknowledged: boolean;
    vulnerability?: SecurityVulnerability;
}
export interface ComplianceReport {
    framework: 'OWASP' | 'PCI-DSS' | 'GDPR' | 'HIPAA' | 'SOC2';
    status: 'compliant' | 'non_compliant' | 'partial';
    score: number;
    requirements: Array<{
        id: string;
        title: string;
        status: 'pass' | 'fail' | 'warning';
        description: string;
        findings: SecurityVulnerability[];
    }>;
    recommendations: string[];
    lastAssessed: number;
}
export declare class SecurityDashboard {
    private context;
    private echoProvider;
    private vulnerabilityScanner;
    private remediationEngine;
    private metrics;
    private alerts;
    private scanHistory;
    private remediationPlans;
    private statusBarItem;
    private securityDiagnostics;
    private dashboardPanel?;
    private vulnerabilityPanel?;
    constructor(context: vscode.ExtensionContext, echoProvider: EchoAIProvider, vulnerabilityScanner: VulnerabilityScanner, remediationEngine: SecurityRemediationEngine);
    showSecurityDashboard(): Promise<void>;
    runSecurityScan(options?: {
        fullScan?: boolean;
        aiEnhanced?: boolean;
        includeTests?: boolean;
    }): Promise<void>;
    startAutomatedRemediation(): Promise<void>;
    executeRemediationPlan(planId: string): Promise<void>;
    generateComplianceReport(framework: ComplianceReport['framework']): Promise<ComplianceReport>;
    private getDashboardWebviewContent;
    private handleDashboardMessage;
    private refreshDashboard;
    private updateMetricsFromScan;
    private addScanToHistory;
    private generateAlertsFromScan;
    private addAlert;
    private acknowledgeAlert;
    private updateSecurityDiagnostics;
    private createDiagnosticFromVulnerability;
    private getScoreClass;
    private getScoreLabel;
    private calculateCategoryDistribution;
    private calculateComplianceScore;
    private updateTrendData;
    private setupStatusBar;
    private updateStatusBar;
    private setupEventHandlers;
    private shouldScanFile;
    private initializeMetrics;
    private generateOWASPComplianceReport;
    private generatePCIComplianceReport;
    private generateGDPRComplianceReport;
    private generateHIPAAComplianceReport;
    private generateSOC2ComplianceReport;
    private generateAndShowComplianceReport;
    private showVulnerabilitiesView;
    private showRemediationPlan;
    dispose(): void;
    getMetrics(): SecurityMetrics;
    getAlerts(): SecurityAlert[];
    getScanHistory(): SecurityScanResult[];
}
//# sourceMappingURL=SecurityDashboard.d.ts.map