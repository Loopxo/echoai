import * as vscode from 'vscode';
import { AdvancedDiagnosticsProvider } from './AdvancedDiagnosticsProvider';
import { EchoAIProvider } from './EchoAIProvider';

export interface AnalysisResult {
    diagnostics: vscode.Diagnostic[];
    confidence: number;
    analysisType: 'syntax' | 'semantic' | 'logic' | 'security' | 'performance';
    processingTime: number;
}

export class RealTimeAnalyzer {
    private advancedProvider: AdvancedDiagnosticsProvider;
    private diagnosticsCollection: vscode.DiagnosticCollection;
    private activeAnalyses: Map<string, NodeJS.Timeout> = new Map();
    private analysisHistory: Map<string, AnalysisResult[]> = new Map();
    private readonly MAX_HISTORY = 10;
    
    // Configuration
    private enabledAnalysisTypes: Set<string> = new Set([
        'syntax', 'semantic', 'logic', 'security', 'performance'
    ]);
    
    constructor(
        echoProvider: EchoAIProvider, 
        diagnosticsCollection: vscode.DiagnosticCollection
    ) {
        this.advancedProvider = new AdvancedDiagnosticsProvider(echoProvider);
        this.diagnosticsCollection = diagnosticsCollection;
        
        this.setupEventListeners();
        this.loadConfiguration();
    }

    private setupEventListeners(): void {
        // Real-time analysis on document changes
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (this.shouldAnalyzeDocument(event.document)) {
                await this.scheduleAnalysis(event.document, 'incremental');
            }
        });

        // Full analysis on document open/save
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (this.shouldAnalyzeDocument(document)) {
                await this.scheduleAnalysis(document, 'full');
            }
        });

        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (this.shouldAnalyzeDocument(document)) {
                await this.scheduleAnalysis(document, 'full');
            }
        });

        // Configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('echoAI.analysis')) {
                this.loadConfiguration();
            }
        });
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('echoAI.analysis');
        
        const enabledTypes = config.get<string[]>('enabledTypes', [
            'syntax', 'semantic', 'logic', 'security', 'performance'
        ]);
        
        this.enabledAnalysisTypes.clear();
        enabledTypes.forEach(type => this.enabledAnalysisTypes.add(type));
    }

    private shouldAnalyzeDocument(document: vscode.TextDocument): boolean {
        // Skip analysis for certain conditions
        if (document.uri.scheme !== 'file') return false;
        if (document.isUntitled) return false;
        if (document.getText().length > 200000) return false; // Skip very large files
        
        // Only analyze supported languages
        const supportedLanguages = [
            'javascript', 'typescript', 'python', 'java', 'csharp', 
            'cpp', 'c', 'go', 'rust', 'php', 'ruby'
        ];
        
        return supportedLanguages.includes(document.languageId);
    }

    private async scheduleAnalysis(
        document: vscode.TextDocument, 
        mode: 'incremental' | 'full'
    ): Promise<void> {
        const documentKey = document.uri.toString();
        
        // Cancel existing analysis for this document
        const existingTimeout = this.activeAnalyses.get(documentKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Schedule new analysis with appropriate delay
        const delay = mode === 'incremental' ? 2000 : 500; // Longer delay for incremental
        
        const timeout = setTimeout(async () => {
            try {
                await this.performRealTimeAnalysis(document, mode);
                this.activeAnalyses.delete(documentKey);
            } catch (error) {
                console.error('Real-time analysis failed:', error);
                this.activeAnalyses.delete(documentKey);
            }
        }, delay);

        this.activeAnalyses.set(documentKey, timeout);
    }

    private async performRealTimeAnalysis(
        document: vscode.TextDocument,
        mode: 'incremental' | 'full'
    ): Promise<void> {
        const startTime = Date.now();
        const documentKey = document.uri.toString();

        try {
            // Show analysis indicator in status bar
            this.showAnalysisProgress(document.fileName);

            let allDiagnostics: vscode.Diagnostic[] = [];
            const results: AnalysisResult[] = [];

            // Perform different types of analysis based on configuration
            if (this.enabledAnalysisTypes.has('syntax')) {
                const syntaxDiagnostics = await this.performSyntaxAnalysis(document);
                allDiagnostics.push(...syntaxDiagnostics);
                
                results.push({
                    diagnostics: syntaxDiagnostics,
                    confidence: 95,
                    analysisType: 'syntax',
                    processingTime: Date.now() - startTime
                });
            }

            // For full analysis or if no recent analysis exists
            if (mode === 'full' || !this.hasRecentAnalysis(documentKey)) {
                if (this.enabledAnalysisTypes.has('semantic') || 
                    this.enabledAnalysisTypes.has('logic') || 
                    this.enabledAnalysisTypes.has('security') || 
                    this.enabledAnalysisTypes.has('performance')) {
                    
                    const advancedDiagnostics = await this.advancedProvider.analyzeCode(document);
                    allDiagnostics.push(...advancedDiagnostics);
                    
                    // Categorize advanced diagnostics
                    const semanticDiagnostics = advancedDiagnostics.filter(d => 
                        d.code && d.code.toString().includes('semantic')
                    );
                    const logicDiagnostics = advancedDiagnostics.filter(d => 
                        d.code && d.code.toString().includes('logic')
                    );
                    const securityDiagnostics = advancedDiagnostics.filter(d => 
                        d.code && d.code.toString().includes('security')
                    );
                    const performanceDiagnostics = advancedDiagnostics.filter(d => 
                        d.code && d.code.toString().includes('performance')
                    );

                    if (semanticDiagnostics.length > 0) {
                        results.push({
                            diagnostics: semanticDiagnostics,
                            confidence: 85,
                            analysisType: 'semantic',
                            processingTime: Date.now() - startTime
                        });
                    }

                    if (logicDiagnostics.length > 0) {
                        results.push({
                            diagnostics: logicDiagnostics,
                            confidence: 80,
                            analysisType: 'logic',
                            processingTime: Date.now() - startTime
                        });
                    }

                    if (securityDiagnostics.length > 0) {
                        results.push({
                            diagnostics: securityDiagnostics,
                            confidence: 90,
                            analysisType: 'security',
                            processingTime: Date.now() - startTime
                        });
                    }

                    if (performanceDiagnostics.length > 0) {
                        results.push({
                            diagnostics: performanceDiagnostics,
                            confidence: 75,
                            analysisType: 'performance',
                            processingTime: Date.now() - startTime
                        });
                    }
                }
            }

            // Update diagnostics collection
            this.diagnosticsCollection.set(document.uri, allDiagnostics);

            // Store analysis history
            this.updateAnalysisHistory(documentKey, results);

            // Update status bar with results
            this.updateAnalysisStatus(allDiagnostics, Date.now() - startTime);

        } catch (error) {
            console.error('Real-time analysis error:', error);
            this.hideAnalysisProgress();
        }
    }

    private async performSyntaxAnalysis(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        // Basic syntax analysis - can be enhanced with language servers
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Language-specific syntax checking
        switch (document.languageId) {
            case 'javascript':
            case 'typescript':
                return this.checkJavaScriptSyntax(lines, document);
            case 'python':
                return this.checkPythonSyntax(lines, document);
            case 'java':
                return this.checkJavaSyntax(lines, document);
            default:
                return this.checkGenericSyntax(lines, document);
        }
    }

    private checkJavaScriptSyntax(lines: string[], document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        lines.forEach((line, index) => {
            // Check for common syntax issues
            if (line.trim().endsWith(',}')) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(index, line.length - 2, index, line.length - 1),
                    'Trailing comma before closing brace',
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            // Unclosed brackets
            const openBrackets = (line.match(/[({[]/g) || []).length;
            const closeBrackets = (line.match(/[)}\]]/g) || []).length;
            if (openBrackets > closeBrackets && !line.trim().endsWith('{') && !line.trim().endsWith('(')) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(index, 0, index, line.length),
                    'Possible unclosed bracket',
                    vscode.DiagnosticSeverity.Error
                ));
            }

            // Missing semicolon (basic check)
            if (line.trim().match(/^(var|let|const|return)\s+.*[^;{},]$/) && 
                !line.trim().endsWith('//') && !line.trim().endsWith('/*')) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(index, line.length, index, line.length),
                    'Missing semicolon',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        });

        return diagnostics;
    }

    private checkPythonSyntax(lines: string[], document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        lines.forEach((line, index) => {
            // Check indentation consistency
            if (line.trim() && !line.startsWith('#')) {
                const leadingSpaces = line.length - line.trimStart().length;
                if (leadingSpaces % 4 !== 0 && !line.match(/^\t+/)) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(index, 0, index, leadingSpaces),
                        'Inconsistent indentation (use 4 spaces)',
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }

            // Missing colon after control statements
            if (line.trim().match(/^(if|elif|else|for|while|def|class|try|except|finally|with)\s+.*[^:]$/)) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(index, line.length, index, line.length),
                    'Missing colon',
                    vscode.DiagnosticSeverity.Error
                ));
            }
        });

        return diagnostics;
    }

    private checkJavaSyntax(lines: string[], document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        lines.forEach((line, index) => {
            // Missing semicolon
            if (line.trim().match(/^[^{};\/\*]*[^{};\/\*\s]$/) && 
                !line.includes('//') && !line.includes('/*') && 
                line.trim().length > 0) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(index, line.length, index, line.length),
                    'Missing semicolon',
                    vscode.DiagnosticSeverity.Error
                ));
            }

            // Bracket mismatch
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            if (closeBraces > openBraces) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(index, 0, index, line.length),
                    'Unmatched closing brace',
                    vscode.DiagnosticSeverity.Error
                ));
            }
        });

        return diagnostics;
    }

    private checkGenericSyntax(lines: string[], document: vscode.TextDocument): vscode.Diagnostic[] {
        // Generic syntax checking for other languages
        return [];
    }

    private hasRecentAnalysis(documentKey: string): boolean {
        const history = this.analysisHistory.get(documentKey);
        if (!history || history.length === 0) return false;
        
        const lastAnalysis = history[history.length - 1];
        return (Date.now() - lastAnalysis.processingTime) < 30000; // 30 seconds
    }

    private updateAnalysisHistory(documentKey: string, results: AnalysisResult[]): void {
        let history = this.analysisHistory.get(documentKey) || [];
        
        // Add new results
        history.push(...results);
        
        // Keep only recent history
        if (history.length > this.MAX_HISTORY) {
            history = history.slice(-this.MAX_HISTORY);
        }
        
        this.analysisHistory.set(documentKey, history);
    }

    // Status bar and progress management
    private statusBarItem?: vscode.StatusBarItem;

    private showAnalysisProgress(fileName: string): void {
        if (!this.statusBarItem) {
            this.statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Left, 
                100
            );
        }

        this.statusBarItem.text = "$(sync~spin) Echo AI Analyzing...";
        this.statusBarItem.tooltip = `Analyzing ${fileName}`;
        this.statusBarItem.show();
    }

    private updateAnalysisStatus(diagnostics: vscode.Diagnostic[], processingTime: number): void {
        if (!this.statusBarItem) return;

        const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
        const warningCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;

        if (errorCount > 0) {
            this.statusBarItem.text = `$(error) ${errorCount} errors, $(warning) ${warningCount} warnings`;
            this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
        } else if (warningCount > 0) {
            this.statusBarItem.text = `$(check) No errors, $(warning) ${warningCount} warnings`;
            this.statusBarItem.color = new vscode.ThemeColor('warningForeground');
        } else {
            this.statusBarItem.text = "$(check) No issues found";
            this.statusBarItem.color = new vscode.ThemeColor('foreground');
        }

        this.statusBarItem.tooltip = `Analysis completed in ${processingTime}ms`;
        
        // Hide status after 5 seconds
        setTimeout(() => {
            this.hideAnalysisProgress();
        }, 5000);
    }

    private hideAnalysisProgress(): void {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    // Public methods for external use
    public async forceAnalysis(document: vscode.TextDocument): Promise<void> {
        await this.performRealTimeAnalysis(document, 'full');
    }

    public getAnalysisHistory(documentUri: string): AnalysisResult[] {
        return this.analysisHistory.get(documentUri) || [];
    }

    public toggleAnalysisType(analysisType: string, enabled: boolean): void {
        if (enabled) {
            this.enabledAnalysisTypes.add(analysisType);
        } else {
            this.enabledAnalysisTypes.delete(analysisType);
        }
    }

    public dispose(): void {
        // Cancel all active analyses
        this.activeAnalyses.forEach((timeout) => {
            clearTimeout(timeout);
        });
        this.activeAnalyses.clear();

        // Clear history
        this.analysisHistory.clear();

        // Dispose status bar
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
}