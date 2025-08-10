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
exports.RealTimeAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const AdvancedDiagnosticsProvider_1 = require("./AdvancedDiagnosticsProvider");
class RealTimeAnalyzer {
    advancedProvider;
    diagnosticsCollection;
    activeAnalyses = new Map();
    analysisHistory = new Map();
    MAX_HISTORY = 10;
    // Configuration
    enabledAnalysisTypes = new Set([
        'syntax', 'semantic', 'logic', 'security', 'performance'
    ]);
    constructor(echoProvider, diagnosticsCollection) {
        this.advancedProvider = new AdvancedDiagnosticsProvider_1.AdvancedDiagnosticsProvider(echoProvider);
        this.diagnosticsCollection = diagnosticsCollection;
        this.setupEventListeners();
        this.loadConfiguration();
    }
    setupEventListeners() {
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
    loadConfiguration() {
        const config = vscode.workspace.getConfiguration('echoAI.analysis');
        const enabledTypes = config.get('enabledTypes', [
            'syntax', 'semantic', 'logic', 'security', 'performance'
        ]);
        this.enabledAnalysisTypes.clear();
        enabledTypes.forEach(type => this.enabledAnalysisTypes.add(type));
    }
    shouldAnalyzeDocument(document) {
        // Skip analysis for certain conditions
        if (document.uri.scheme !== 'file')
            return false;
        if (document.isUntitled)
            return false;
        if (document.getText().length > 200000)
            return false; // Skip very large files
        // Only analyze supported languages
        const supportedLanguages = [
            'javascript', 'typescript', 'python', 'java', 'csharp',
            'cpp', 'c', 'go', 'rust', 'php', 'ruby'
        ];
        return supportedLanguages.includes(document.languageId);
    }
    async scheduleAnalysis(document, mode) {
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
            }
            catch (error) {
                console.error('Real-time analysis failed:', error);
                this.activeAnalyses.delete(documentKey);
            }
        }, delay);
        this.activeAnalyses.set(documentKey, timeout);
    }
    async performRealTimeAnalysis(document, mode) {
        const startTime = Date.now();
        const documentKey = document.uri.toString();
        try {
            // Show analysis indicator in status bar
            this.showAnalysisProgress(document.fileName);
            let allDiagnostics = [];
            const results = [];
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
                    const semanticDiagnostics = advancedDiagnostics.filter(d => d.code && d.code.toString().includes('semantic'));
                    const logicDiagnostics = advancedDiagnostics.filter(d => d.code && d.code.toString().includes('logic'));
                    const securityDiagnostics = advancedDiagnostics.filter(d => d.code && d.code.toString().includes('security'));
                    const performanceDiagnostics = advancedDiagnostics.filter(d => d.code && d.code.toString().includes('performance'));
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
        }
        catch (error) {
            console.error('Real-time analysis error:', error);
            this.hideAnalysisProgress();
        }
    }
    async performSyntaxAnalysis(document) {
        // Basic syntax analysis - can be enhanced with language servers
        const diagnostics = [];
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
    checkJavaScriptSyntax(lines, document) {
        const diagnostics = [];
        lines.forEach((line, index) => {
            // Check for common syntax issues
            if (line.trim().endsWith(',}')) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, line.length - 2, index, line.length - 1), 'Trailing comma before closing brace', vscode.DiagnosticSeverity.Warning));
            }
            // Unclosed brackets
            const openBrackets = (line.match(/[({[]/g) || []).length;
            const closeBrackets = (line.match(/[)}\]]/g) || []).length;
            if (openBrackets > closeBrackets && !line.trim().endsWith('{') && !line.trim().endsWith('(')) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, 0, index, line.length), 'Possible unclosed bracket', vscode.DiagnosticSeverity.Error));
            }
            // Missing semicolon (basic check)
            if (line.trim().match(/^(var|let|const|return)\s+.*[^;{},]$/) &&
                !line.trim().endsWith('//') && !line.trim().endsWith('/*')) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, line.length, index, line.length), 'Missing semicolon', vscode.DiagnosticSeverity.Warning));
            }
        });
        return diagnostics;
    }
    checkPythonSyntax(lines, document) {
        const diagnostics = [];
        lines.forEach((line, index) => {
            // Check indentation consistency
            if (line.trim() && !line.startsWith('#')) {
                const leadingSpaces = line.length - line.trimStart().length;
                if (leadingSpaces % 4 !== 0 && !line.match(/^\t+/)) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, 0, index, leadingSpaces), 'Inconsistent indentation (use 4 spaces)', vscode.DiagnosticSeverity.Warning));
                }
            }
            // Missing colon after control statements
            if (line.trim().match(/^(if|elif|else|for|while|def|class|try|except|finally|with)\s+.*[^:]$/)) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, line.length, index, line.length), 'Missing colon', vscode.DiagnosticSeverity.Error));
            }
        });
        return diagnostics;
    }
    checkJavaSyntax(lines, document) {
        const diagnostics = [];
        lines.forEach((line, index) => {
            // Missing semicolon
            if (line.trim().match(/^[^{};\/\*]*[^{};\/\*\s]$/) &&
                !line.includes('//') && !line.includes('/*') &&
                line.trim().length > 0) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, line.length, index, line.length), 'Missing semicolon', vscode.DiagnosticSeverity.Error));
            }
            // Bracket mismatch
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            if (closeBraces > openBraces) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(index, 0, index, line.length), 'Unmatched closing brace', vscode.DiagnosticSeverity.Error));
            }
        });
        return diagnostics;
    }
    checkGenericSyntax(lines, document) {
        // Generic syntax checking for other languages
        return [];
    }
    hasRecentAnalysis(documentKey) {
        const history = this.analysisHistory.get(documentKey);
        if (!history || history.length === 0)
            return false;
        const lastAnalysis = history[history.length - 1];
        return (Date.now() - lastAnalysis.processingTime) < 30000; // 30 seconds
    }
    updateAnalysisHistory(documentKey, results) {
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
    statusBarItem;
    showAnalysisProgress(fileName) {
        if (!this.statusBarItem) {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        }
        this.statusBarItem.text = "$(sync~spin) Echo AI Analyzing...";
        this.statusBarItem.tooltip = `Analyzing ${fileName}`;
        this.statusBarItem.show();
    }
    updateAnalysisStatus(diagnostics, processingTime) {
        if (!this.statusBarItem)
            return;
        const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
        const warningCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
        if (errorCount > 0) {
            this.statusBarItem.text = `$(error) ${errorCount} errors, $(warning) ${warningCount} warnings`;
            this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
        }
        else if (warningCount > 0) {
            this.statusBarItem.text = `$(check) No errors, $(warning) ${warningCount} warnings`;
            this.statusBarItem.color = new vscode.ThemeColor('warningForeground');
        }
        else {
            this.statusBarItem.text = "$(check) No issues found";
            this.statusBarItem.color = new vscode.ThemeColor('foreground');
        }
        this.statusBarItem.tooltip = `Analysis completed in ${processingTime}ms`;
        // Hide status after 5 seconds
        setTimeout(() => {
            this.hideAnalysisProgress();
        }, 5000);
    }
    hideAnalysisProgress() {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }
    // Public methods for external use
    async forceAnalysis(document) {
        await this.performRealTimeAnalysis(document, 'full');
    }
    getAnalysisHistory(documentUri) {
        return this.analysisHistory.get(documentUri) || [];
    }
    toggleAnalysisType(analysisType, enabled) {
        if (enabled) {
            this.enabledAnalysisTypes.add(analysisType);
        }
        else {
            this.enabledAnalysisTypes.delete(analysisType);
        }
    }
    dispose() {
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
exports.RealTimeAnalyzer = RealTimeAnalyzer;
//# sourceMappingURL=RealTimeAnalyzer.js.map