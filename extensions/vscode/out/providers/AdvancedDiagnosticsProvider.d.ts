import * as vscode from 'vscode';
import { EchoAIProvider } from './EchoAIProvider';
export interface SemanticIssue {
    type: 'semantic' | 'logic' | 'performance' | 'security' | 'maintainability';
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    line: number;
    column?: number;
    suggestion?: string;
    fixable: boolean;
    confidence: number;
}
export declare class AdvancedDiagnosticsProvider {
    private echoProvider;
    private codeAnalyzer;
    private diagnosticsCache;
    private readonly CACHE_DURATION;
    private analysisQueue;
    constructor(echoProvider: EchoAIProvider);
    analyzeCode(document: vscode.TextDocument): Promise<vscode.Diagnostic[]>;
    private performAdvancedAnalysis;
    private performSemanticAnalysis;
    private performLogicAnalysis;
    private performPerformanceAnalysis;
    private performSecurityAnalysis;
    private performMaintainabilityAnalysis;
    private parseAnalysisResponse;
    private getSecurityPatterns;
    private convertToDiagnostics;
    private mapSeverity;
    private cleanupCache;
    provideAdvancedCodeActions(document: vscode.TextDocument, range: vscode.Range, diagnostics: vscode.Diagnostic[]): Promise<vscode.CodeAction[]>;
}
//# sourceMappingURL=AdvancedDiagnosticsProvider.d.ts.map