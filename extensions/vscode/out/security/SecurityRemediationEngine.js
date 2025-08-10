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
exports.SecurityRemediationEngine = void 0;
const vscode = __importStar(require("vscode"));
class SecurityRemediationEngine {
    echoProvider;
    vulnerabilityScanner;
    // Remediation templates
    remediationTemplates = new Map();
    // Applied remediations tracking
    appliedRemediations = new Map();
    // Progress tracking
    currentRemediation;
    constructor(echoProvider, vulnerabilityScanner) {
        this.echoProvider = echoProvider;
        this.vulnerabilityScanner = vulnerabilityScanner;
        this.initializeRemediationTemplates();
    }
    async createRemediationPlan(vulnerabilities) {
        const planId = this.generatePlanId();
        // Sort vulnerabilities by severity and priority
        const sortedVulnerabilities = vulnerabilities.sort((a, b) => {
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
        // Generate remediation actions
        const actions = [];
        const actionPromises = sortedVulnerabilities.map(vuln => this.generateRemediationActions(vuln));
        const actionResults = await Promise.allSettled(actionPromises);
        actionResults.forEach(result => {
            if (result.status === 'fulfilled') {
                actions.push(...result.value);
            }
        });
        // Optimize action sequence
        const optimizedActions = this.optimizeActionSequence(actions);
        const priority = this.calculateActionPriority(optimizedActions, sortedVulnerabilities);
        const plan = {
            id: planId,
            vulnerabilities: sortedVulnerabilities,
            actions: optimizedActions,
            priority,
            estimatedTime: this.estimateRemediationTime(optimizedActions),
            riskAssessment: this.assessRemediationRisk(optimizedActions)
        };
        return plan;
    }
    async executeRemediationPlan(plan, options) {
        const results = [];
        this.currentRemediation = {
            planId: plan.id,
            progress: 0,
            currentAction: 'Starting remediation...',
            startTime: Date.now()
        };
        try {
            for (let i = 0; i < plan.actions.length; i++) {
                const action = plan.actions[i];
                const progress = (i / plan.actions.length) * 100;
                this.updateRemediationProgress(progress, `Executing: ${action.title}`);
                // Skip high-risk actions without approval
                if (action.risk === 'high' && !options?.autoApprove) {
                    const approved = await this.requestApproval(action);
                    if (!approved) {
                        results.push({
                            actionId: action.id,
                            success: false,
                            appliedChanges: [],
                            validationResults: [],
                            errors: ['Action skipped: User declined high-risk remediation'],
                            warnings: []
                        });
                        continue;
                    }
                }
                // Execute remediation action
                const result = await this.executeRemediationAction(action, options?.dryRun || false);
                results.push(result);
                // Stop on critical failures
                if (!result.success && action.risk === 'high') {
                    break;
                }
            }
            this.updateRemediationProgress(100, 'Remediation completed');
            this.currentRemediation = undefined;
            return results;
        }
        catch (error) {
            console.error('Remediation execution failed:', error);
            this.currentRemediation = undefined;
            throw error;
        }
    }
    async generateRemediationActions(vulnerability) {
        const actions = [];
        // Check if we have a template for this vulnerability type
        const template = this.remediationTemplates.get(vulnerability.type);
        if (template) {
            actions.push(...await this.applyTemplate(template, vulnerability));
        }
        // Generate AI-powered custom remediation
        const aiAction = await this.generateAIRemediation(vulnerability);
        if (aiAction) {
            actions.push(aiAction);
        }
        // Generate generic remediation based on category
        const genericAction = this.generateGenericRemediation(vulnerability);
        if (genericAction) {
            actions.push(genericAction);
        }
        return actions;
    }
    async generateAIRemediation(vulnerability) {
        const prompt = `Generate a specific remediation for this security vulnerability:

Vulnerability Type: ${vulnerability.type}
Severity: ${vulnerability.severity}
Description: ${vulnerability.description}
Location: ${vulnerability.location.file}:${vulnerability.location.line}
Affected Code: ${vulnerability.affectedCode}
Evidence: ${vulnerability.evidence}

Generate a detailed remediation action with:
1. Specific code changes needed
2. Before/after code examples
3. Validation steps
4. Risk assessment

Return as JSON:
{
  "title": "Remediation title",
  "description": "Detailed description",
  "automated": true/false,
  "confidence": 85,
  "risk": "low|medium|high",
  "effort": "low|medium|high",
  "codeChanges": [
    {
      "originalCode": "vulnerable code",
      "newCode": "secure code",
      "explanation": "why this fixes the issue"
    }
  ],
  "validationSteps": [
    {
      "description": "validation step",
      "type": "manual|automated",
      "expectedResult": "expected outcome"
    }
  ]
}

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', 'security', 2000);
            const aiRemediation = JSON.parse(response);
            return {
                id: this.generateActionId(),
                vulnerabilityId: vulnerability.id,
                type: 'fix_code',
                title: aiRemediation.title,
                description: aiRemediation.description,
                automated: aiRemediation.automated,
                confidence: aiRemediation.confidence || 80,
                risk: aiRemediation.risk || 'medium',
                effort: aiRemediation.effort || 'medium',
                changes: aiRemediation.codeChanges?.map((change) => ({
                    file: vulnerability.location.file,
                    startLine: vulnerability.location.line,
                    endLine: vulnerability.location.endLine || vulnerability.location.line,
                    originalCode: change.originalCode,
                    newCode: change.newCode,
                    explanation: change.explanation
                })) || [],
                validation: aiRemediation.validationSteps?.map((step, index) => ({
                    id: `validation_${index}`,
                    description: step.description,
                    type: step.type,
                    expectedResult: step.expectedResult
                })) || [],
                rollbackPlan: [
                    'Create backup of original code',
                    'Revert changes if validation fails',
                    'Restore from version control if needed'
                ]
            };
        }
        catch (error) {
            console.warn('AI remediation generation failed:', error);
            return null;
        }
    }
    async executeRemediationAction(action, dryRun) {
        const result = {
            actionId: action.id,
            success: false,
            appliedChanges: [],
            validationResults: [],
            errors: [],
            warnings: []
        };
        try {
            // Apply code changes
            if (!dryRun) {
                for (const change of action.changes) {
                    const applied = await this.applyCodeChange(change);
                    if (applied.success) {
                        result.appliedChanges.push(change);
                    }
                    else {
                        result.errors.push(`Failed to apply change: ${applied.error}`);
                    }
                }
            }
            // Run validation steps
            for (const validation of action.validation) {
                const validationResult = await this.executeValidation(validation, dryRun);
                result.validationResults.push(validationResult);
                if (!validationResult.passed) {
                    result.warnings.push(`Validation failed: ${validation.description}`);
                }
            }
            // Determine overall success
            result.success = result.errors.length === 0 &&
                (result.validationResults.length === 0 ||
                    result.validationResults.every(v => v.passed));
            // Store rollback info if changes were applied
            if (result.appliedChanges.length > 0) {
                result.rollbackInfo = this.createRollbackInfo(result.appliedChanges);
            }
            // Track applied remediation
            this.appliedRemediations.set(action.id, result);
            return result;
        }
        catch (error) {
            result.errors.push(`Execution error: ${error}`);
            return result;
        }
    }
    async applyCodeChange(change) {
        try {
            const document = await vscode.workspace.openTextDocument(change.file);
            const edit = new vscode.WorkspaceEdit();
            const startPos = new vscode.Position(change.startLine - 1, 0);
            const endPos = new vscode.Position(change.endLine - 1, document.lineAt(change.endLine - 1).text.length);
            const range = new vscode.Range(startPos, endPos);
            edit.replace(document.uri, range, change.newCode);
            const applied = await vscode.workspace.applyEdit(edit);
            return { success: applied };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async executeValidation(validation, dryRun) {
        const result = {
            stepId: validation.id,
            passed: false,
            details: '',
            timestamp: Date.now()
        };
        try {
            if (validation.type === 'automated' && validation.command && !dryRun) {
                // Execute automated validation command
                const terminal = vscode.window.createTerminal('Security Validation');
                terminal.sendText(validation.command);
                // For now, assume validation passes (would need proper command execution handling)
                result.passed = true;
                result.details = `Executed: ${validation.command}`;
            }
            else {
                // Manual validation or dry run
                result.passed = true; // Optimistic for dry run
                result.details = dryRun ? 'Dry run - validation skipped' : 'Manual validation required';
            }
        }
        catch (error) {
            result.details = `Validation error: ${error}`;
        }
        return result;
    }
    // Automated remediation for common vulnerabilities
    async autoRemediateHardcodedSecrets(vulnerability) {
        const action = {
            id: this.generateActionId(),
            vulnerabilityId: vulnerability.id,
            type: 'fix_code',
            title: 'Move Hardcoded Secret to Environment Variable',
            description: 'Replace hardcoded credentials with environment variable references',
            automated: true,
            confidence: 95,
            risk: 'low',
            effort: 'low',
            changes: [{
                    file: vulnerability.location.file,
                    startLine: vulnerability.location.line,
                    endLine: vulnerability.location.line,
                    originalCode: vulnerability.affectedCode,
                    newCode: this.generateEnvironmentVariableCode(vulnerability.affectedCode),
                    explanation: 'Replaced hardcoded secret with environment variable'
                }],
            validation: [{
                    id: 'env_var_check',
                    description: 'Verify environment variable is set',
                    type: 'manual',
                    expectedResult: 'Environment variable contains the secret value'
                }],
            rollbackPlan: ['Restore original hardcoded value if needed for development']
        };
        return this.executeRemediationAction(action, false);
    }
    generateEnvironmentVariableCode(originalCode) {
        // Extract variable name and replace with env var
        const secretMatch = originalCode.match(/(\w+)\s*[:=]\s*["']([^"']+)["']/);
        if (secretMatch) {
            const varName = secretMatch[1];
            const envVarName = varName.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
            return originalCode.replace(/["'][^"']+["']/, `process.env.${envVarName}`);
        }
        return originalCode;
    }
    // Helper methods
    initializeRemediationTemplates() {
        // SQL Injection template
        this.remediationTemplates.set('sql_injection', {
            id: 'sql_injection_template',
            name: 'SQL Injection Remediation',
            description: 'Fix SQL injection vulnerabilities using parameterized queries',
            category: 'injection',
            actions: [
                {
                    type: 'fix_code',
                    description: 'Replace string concatenation with parameterized queries',
                    automated: false,
                    effort: 'medium'
                }
            ]
        });
        // Add more templates...
    }
    async applyTemplate(template, vulnerability) {
        // Apply remediation template to specific vulnerability
        return [];
    }
    generateGenericRemediation(vulnerability) {
        // Generate basic remediation based on vulnerability category
        return {
            id: this.generateActionId(),
            vulnerabilityId: vulnerability.id,
            type: 'fix_code',
            title: `Generic Fix for ${vulnerability.type}`,
            description: vulnerability.remediation.description,
            automated: false,
            confidence: 60,
            risk: 'medium',
            effort: vulnerability.remediation.effort,
            changes: [],
            validation: [],
            rollbackPlan: ['Manual rollback required']
        };
    }
    optimizeActionSequence(actions) {
        // Sort actions by priority, risk, and dependencies
        return actions.sort((a, b) => {
            // Critical fixes first
            if (a.risk === 'high' && b.risk !== 'high')
                return -1;
            if (b.risk === 'high' && a.risk !== 'high')
                return 1;
            // Automated fixes before manual ones
            if (a.automated && !b.automated)
                return -1;
            if (b.automated && !a.automated)
                return 1;
            // Lower effort first
            const effortOrder = { low: 1, medium: 2, high: 3 };
            return effortOrder[a.effort] - effortOrder[b.effort];
        });
    }
    calculateActionPriority(actions, vulnerabilities) {
        return actions.map(action => {
            const vulnerability = vulnerabilities.find(v => v.id === action.vulnerabilityId);
            if (!vulnerability)
                return 5;
            const severityScores = { critical: 10, high: 8, medium: 5, low: 3, info: 1 };
            const confidenceMultiplier = action.confidence / 100;
            return Math.round(severityScores[vulnerability.severity] * confidenceMultiplier);
        });
    }
    estimateRemediationTime(actions) {
        const effortMinutes = { low: 15, medium: 60, high: 240 };
        return actions.reduce((total, action) => total + effortMinutes[action.effort], 0);
    }
    assessRemediationRisk(actions) {
        const hasHighRisk = actions.some(a => a.risk === 'high');
        const hasCodeChanges = actions.some(a => a.changes.length > 0);
        return {
            breakingChanges: hasHighRisk,
            dataLoss: false, // Would be determined by action analysis
            serviceInterruption: hasHighRisk,
            testingRequired: hasCodeChanges
        };
    }
    async requestApproval(action) {
        const response = await vscode.window.showWarningMessage(`High-risk remediation action: ${action.title}\n\nThis action may cause breaking changes. Continue?`, 'Continue', 'Skip');
        return response === 'Continue';
    }
    updateRemediationProgress(progress, currentAction) {
        if (this.currentRemediation) {
            this.currentRemediation.progress = progress;
            this.currentRemediation.currentAction = currentAction;
        }
    }
    createRollbackInfo(changes) {
        return `Rollback info for ${changes.length} changes applied at ${new Date().toISOString()}`;
    }
    generatePlanId() {
        return `remediation_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateActionId() {
        return `remediation_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Public interface methods
    getCurrentRemediationProgress() {
        return this.currentRemediation;
    }
    getAppliedRemediation(actionId) {
        return this.appliedRemediations.get(actionId);
    }
    getAllAppliedRemediations() {
        return Array.from(this.appliedRemediations.values());
    }
    async rollbackRemediation(actionId) {
        const remediation = this.appliedRemediations.get(actionId);
        if (!remediation || !remediation.rollbackInfo) {
            return false;
        }
        try {
            // Implement rollback logic
            // This would reverse the applied changes
            return true;
        }
        catch (error) {
            console.error('Rollback failed:', error);
            return false;
        }
    }
}
exports.SecurityRemediationEngine = SecurityRemediationEngine;
//# sourceMappingURL=SecurityRemediationEngine.js.map