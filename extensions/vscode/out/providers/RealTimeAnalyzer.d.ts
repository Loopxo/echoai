import * as vscode from 'vscode';
import { EchoAIProvider } from './EchoAIProvider';
export interface AnalysisResult {
    diagnostics: vscode.Diagnostic[];
    confidence: number;
    analysisType: 'syntax' | 'semantic' | 'logic' | 'security' | 'performance';
    processingTime: number;
}
export declare class RealTimeAnalyzer {
    private advancedProvider;
    private diagnosticsCollection;
    private activeAnalyses;
    private analysisHistory;
    private readonly MAX_HISTORY;
    private enabledAnalysisTypes;
    constructor(echoProvider: EchoAIProvider, diagnosticsCollection: vscode.DiagnosticCollection);
    private setupEventListeners;
    private loadConfiguration;
    private shouldAnalyzeDocument;
    private scheduleAnalysis;
    private performRealTimeAnalysis;
    private performSyntaxAnalysis;
    private checkJavaScriptSyntax;
    private checkPythonSyntax;
    private checkJavaSyntax;
    private checkGenericSyntax;
    private hasRecentAnalysis;
    private updateAnalysisHistory;
    private statusBarItem?;
    private showAnalysisProgress;
    private updateAnalysisStatus;
    private hideAnalysisProgress;
    forceAnalysis(document: vscode.TextDocument): Promise<void>;
    getAnalysisHistory(documentUri: string): AnalysisResult[];
    toggleAnalysisType(analysisType: string, enabled: boolean): void;
    dispose(): void;
}
//# sourceMappingURL=RealTimeAnalyzer.d.ts.map