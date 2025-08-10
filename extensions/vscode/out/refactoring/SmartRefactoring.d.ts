import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { RefactoringEngine, RefactoringOperation, RefactoringResult } from './RefactoringEngine';
import { ArchitecturalRefactoring } from './ArchitecturalRefactoring';
export interface SmartRefactoringSession {
    id: string;
    startTime: number;
    operations: RefactoringOperation[];
    results: RefactoringResult[];
    context: vscode.TextDocument;
    goals: RefactoringGoal[];
    progress: {
        completed: number;
        total: number;
        currentOperation?: RefactoringOperation;
    };
    aiInsights: AIInsight[];
}
export interface RefactoringGoal {
    type: 'reduce_complexity' | 'improve_readability' | 'extract_components' | 'modernize_code' | 'improve_performance' | 'apply_patterns';
    priority: 'high' | 'medium' | 'low';
    description: string;
    measurable: boolean;
    target?: number;
    currentValue?: number;
}
export interface AIInsight {
    type: 'opportunity' | 'risk' | 'suggestion' | 'warning';
    confidence: number;
    message: string;
    actionable: boolean;
    operation?: RefactoringOperation;
    relatedGoals: string[];
}
export interface RefactoringWizardStep {
    id: string;
    name: string;
    description: string;
    type: 'analysis' | 'goal_setting' | 'operation_selection' | 'preview' | 'execution' | 'review';
    completed: boolean;
    data?: any;
    nextSteps: string[];
    canSkip: boolean;
}
export interface RefactoringPreview {
    operation: RefactoringOperation;
    beforeCode: string;
    afterCode: string;
    diffHtml: string;
    impacts: {
        filesChanged: number;
        linesChanged: number;
        complexity: {
            before: number;
            after: number;
        };
        readability: {
            before: number;
            after: number;
        };
    };
    risks: string[];
    recommendations: string[];
}
export declare class SmartRefactoring {
    private echoProvider;
    private refactoringEngine;
    private architecturalRefactoring;
    private activeSessions;
    private sessionHistory;
    private userPreferences;
    constructor(echoProvider: EchoAIProvider, refactoringEngine: RefactoringEngine, architecturalRefactoring: ArchitecturalRefactoring);
    startSmartRefactoringSession(document: vscode.TextDocument, goals?: RefactoringGoal[]): Promise<string>;
    getRefactoringWizardSteps(sessionId: string): Promise<RefactoringWizardStep[]>;
    executeWizardStep(sessionId: string, stepId: string, data?: any): Promise<RefactoringWizardStep>;
    generateRefactoringPreview(operation: RefactoringOperation, context: vscode.TextDocument): Promise<RefactoringPreview>;
    getAIRefactoringRecommendations(document: vscode.TextDocument): Promise<AIInsight[]>;
    optimizeRefactoringSequence(operations: RefactoringOperation[]): Promise<RefactoringOperation[]>;
    private generateAIInsights;
    private generateDefaultGoals;
    private executeGoalSetting;
    private executeOperationSelection;
    private executePreview;
    private executeRefactoring;
    private executeReview;
    private measureImprovements;
    private generateSessionId;
    private calculateComplexity;
    private calculateReadability;
    private countChangedLines;
    private generateDiffHtml;
    private generateRecommendations;
    getActiveSession(sessionId: string): SmartRefactoringSession | undefined;
    getSessionHistory(): SmartRefactoringSession[];
    getUserPreferences(): {
        preferredComplexity: "simple" | "medium" | "complex";
        riskTolerance: "low" | "medium" | "high";
        goals: RefactoringGoal[];
        patterns: string[];
    };
    updateUserPreferences(preferences: Partial<typeof this.userPreferences>): void;
}
//# sourceMappingURL=SmartRefactoring.d.ts.map