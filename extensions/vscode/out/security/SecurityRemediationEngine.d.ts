import { EchoAIProvider } from '../providers/EchoAIProvider';
import { SecurityVulnerability, VulnerabilityScanner } from './VulnerabilityScanner';
export interface RemediationAction {
    id: string;
    vulnerabilityId: string;
    type: RemediationActionType;
    title: string;
    description: string;
    automated: boolean;
    confidence: number;
    risk: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    changes: CodeChange[];
    validation: ValidationStep[];
    rollbackPlan: string[];
}
export type RemediationActionType = 'fix_code' | 'add_validation' | 'implement_sanitization' | 'add_authorization' | 'update_configuration' | 'add_logging' | 'implement_rate_limiting' | 'add_encryption' | 'update_dependencies' | 'add_security_headers' | 'implement_csp' | 'add_input_validation';
export interface CodeChange {
    file: string;
    startLine: number;
    endLine: number;
    originalCode: string;
    newCode: string;
    explanation: string;
}
export interface ValidationStep {
    id: string;
    description: string;
    type: 'manual' | 'automated';
    command?: string;
    expectedResult: string;
}
export interface RemediationResult {
    actionId: string;
    success: boolean;
    appliedChanges: CodeChange[];
    validationResults: ValidationResult[];
    errors: string[];
    warnings: string[];
    rollbackInfo?: string;
}
export interface ValidationResult {
    stepId: string;
    passed: boolean;
    details: string;
    timestamp: number;
}
export interface RemediationPlan {
    id: string;
    vulnerabilities: SecurityVulnerability[];
    actions: RemediationAction[];
    priority: number[];
    estimatedTime: number;
    riskAssessment: {
        breakingChanges: boolean;
        dataLoss: boolean;
        serviceInterruption: boolean;
        testingRequired: boolean;
    };
}
export declare class SecurityRemediationEngine {
    private echoProvider;
    private vulnerabilityScanner;
    private remediationTemplates;
    private appliedRemediations;
    private currentRemediation?;
    constructor(echoProvider: EchoAIProvider, vulnerabilityScanner: VulnerabilityScanner);
    createRemediationPlan(vulnerabilities: SecurityVulnerability[]): Promise<RemediationPlan>;
    executeRemediationPlan(plan: RemediationPlan, options?: {
        autoApprove?: boolean;
        skipValidation?: boolean;
        dryRun?: boolean;
    }): Promise<RemediationResult[]>;
    generateRemediationActions(vulnerability: SecurityVulnerability): Promise<RemediationAction[]>;
    private generateAIRemediation;
    private executeRemediationAction;
    private applyCodeChange;
    private executeValidation;
    autoRemediateHardcodedSecrets(vulnerability: SecurityVulnerability): Promise<RemediationResult>;
    private generateEnvironmentVariableCode;
    private initializeRemediationTemplates;
    private applyTemplate;
    private generateGenericRemediation;
    private optimizeActionSequence;
    private calculateActionPriority;
    private estimateRemediationTime;
    private assessRemediationRisk;
    private requestApproval;
    private updateRemediationProgress;
    private createRollbackInfo;
    private generatePlanId;
    private generateActionId;
    getCurrentRemediationProgress(): {
        planId: string;
        progress: number;
        currentAction: string;
        startTime: number;
    };
    getAppliedRemediation(actionId: string): RemediationResult | undefined;
    getAllAppliedRemediations(): RemediationResult[];
    rollbackRemediation(actionId: string): Promise<boolean>;
}
//# sourceMappingURL=SecurityRemediationEngine.d.ts.map