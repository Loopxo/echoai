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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const EchoAIProvider_1 = require("./providers/EchoAIProvider");
const CompletionProvider_1 = require("./providers/CompletionProvider");
const ErrorDetectionProvider_1 = require("./providers/ErrorDetectionProvider");
const AdvancedDiagnosticsProvider_1 = require("./providers/AdvancedDiagnosticsProvider");
const RealTimeAnalyzer_1 = require("./providers/RealTimeAnalyzer");
const ConfigurationManager_1 = require("./utils/ConfigurationManager");
const CodeAnalyzer_1 = require("./utils/CodeAnalyzer");
const CodebaseIndexer_1 = require("./services/CodebaseIndexer");
const IncrementalAnalyzer_1 = require("./services/IncrementalAnalyzer");
const PerformanceMonitor_1 = require("./services/PerformanceMonitor");
const RefactoringEngine_1 = require("./refactoring/RefactoringEngine");
const ArchitecturalRefactoring_1 = require("./refactoring/ArchitecturalRefactoring");
const SmartRefactoring_1 = require("./refactoring/SmartRefactoring");
let echoProvider;
let completionProvider;
let errorProvider;
let advancedDiagnosticsProvider;
let realTimeAnalyzer;
let codebaseIndexer;
let incrementalAnalyzer;
let performanceMonitor;
let refactoringEngine;
let architecturalRefactoring;
let smartRefactoring;
function activate(context) {
    console.log('Echo AI extension is now active!');
    // Initialize core components
    const configManager = new ConfigurationManager_1.ConfigurationManager();
    echoProvider = new EchoAIProvider_1.EchoAIProvider(configManager);
    completionProvider = new CompletionProvider_1.CompletionProvider(echoProvider);
    errorProvider = new ErrorDetectionProvider_1.ErrorDetectionProvider(echoProvider);
    advancedDiagnosticsProvider = new AdvancedDiagnosticsProvider_1.AdvancedDiagnosticsProvider(echoProvider);
    // Phase 3: Performance optimization services
    performanceMonitor = new PerformanceMonitor_1.PerformanceMonitor();
    codebaseIndexer = new CodebaseIndexer_1.CodebaseIndexer();
    incrementalAnalyzer = new IncrementalAnalyzer_1.IncrementalAnalyzer(codebaseIndexer, echoProvider);
    // Phase 4: Advanced refactoring services
    refactoringEngine = new RefactoringEngine_1.RefactoringEngine(echoProvider, codebaseIndexer);
    architecturalRefactoring = new ArchitecturalRefactoring_1.ArchitecturalRefactoring(echoProvider, codebaseIndexer, refactoringEngine);
    smartRefactoring = new SmartRefactoring_1.SmartRefactoring(echoProvider, refactoringEngine, architecturalRefactoring);
    // Register inline completion provider for all languages
    const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider({ scheme: 'file' }, {
        provideInlineCompletionItems: async (document, position, context, token) => {
            if (!configManager.get('enableInlineCompletion', true)) {
                return [];
            }
            try {
                const completion = await completionProvider.getInlineCompletion(document, position, context, token);
                return completion ? [completion] : [];
            }
            catch (error) {
                console.error('Echo AI completion error:', error);
                return [];
            }
        }
    });
    // Register completion item provider for traditional completions
    const completionItemProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file' }, {
        provideCompletionItems: async (document, position, token) => {
            try {
                return await completionProvider.getCompletionItems(document, position, token);
            }
            catch (error) {
                console.error('Echo AI completion items error:', error);
                return [];
            }
        }
    }, '.', '(', '[', '{', ' ');
    // Register diagnostic provider for error detection
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('echo-ai');
    context.subscriptions.push(diagnosticCollection);
    // Initialize real-time analyzer with enhanced capabilities
    realTimeAnalyzer = new RealTimeAnalyzer_1.RealTimeAnalyzer(echoProvider, diagnosticCollection);
    // Register code action provider for advanced diagnostics
    const codeActionProvider = vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, {
        provideCodeActions: async (document, range, context) => {
            try {
                return await advancedDiagnosticsProvider.provideAdvancedCodeActions(document, range, [...context.diagnostics]);
            }
            catch (error) {
                console.error('Advanced code actions error:', error);
                return [];
            }
        }
    });
    // Register commands
    const explainCommand = vscode.commands.registerCommand('echo-ai.explain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to explain');
            return;
        }
        const selectedText = editor.document.getText(selection);
        try {
            const explanation = await echoProvider.explainCode(selectedText, editor.document.languageId);
            // Show explanation in a webview panel
            const panel = vscode.window.createWebviewPanel('echo-ai-explanation', 'Echo AI - Code Explanation', vscode.ViewColumn.Two, { enableScripts: true });
            panel.webview.html = getExplanationWebviewContent(explanation, selectedText);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Echo AI error: ${error}`);
        }
    });
    const refactorCommand = vscode.commands.registerCommand('echo-ai.refactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to refactor');
            return;
        }
        const selectedText = editor.document.getText(selection);
        try {
            const refactoredCode = await echoProvider.refactorCode(selectedText, editor.document.languageId);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, selection, refactoredCode);
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                vscode.window.showInformationMessage('Code refactored successfully!');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Echo AI refactor error: ${error}`);
        }
    });
    const generateTestsCommand = vscode.commands.registerCommand('echo-ai.generateTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const document = editor.document;
        const codeAnalyzer = new CodeAnalyzer_1.CodeAnalyzer();
        try {
            const functions = codeAnalyzer.extractFunctions(document.getText(), document.languageId);
            if (functions.length === 0) {
                vscode.window.showInformationMessage('No functions found to generate tests for');
                return;
            }
            const tests = await echoProvider.generateTests(functions, document.languageId);
            // Create a new test file
            const testFileName = document.fileName.replace(/\.(ts|js|py)$/, '.test.$1');
            const testUri = vscode.Uri.file(testFileName);
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(testUri, { overwrite: false });
            edit.insert(testUri, new vscode.Position(0, 0), tests);
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                vscode.window.showInformationMessage(`Test file created: ${testFileName}`);
                vscode.window.showTextDocument(testUri);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Echo AI test generation error: ${error}`);
        }
    });
    const fixErrorsCommand = vscode.commands.registerCommand('echo-ai.fixErrors', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        try {
            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
            if (diagnostics.length === 0) {
                vscode.window.showInformationMessage('No errors found to fix');
                return;
            }
            const fixes = await echoProvider.fixErrors(editor.document.getText(), diagnostics, editor.document.languageId);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, new vscode.Range(0, 0, editor.document.lineCount, 0), fixes);
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                vscode.window.showInformationMessage('Errors fixed successfully!');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Echo AI fix errors error: ${error}`);
        }
    });
    const configureCommand = vscode.commands.registerCommand('echo-ai.configure', async () => {
        const providers = ['claude', 'openai', 'groq', 'openrouter', 'gemini', 'meta'];
        const selectedProvider = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select AI Provider'
        });
        if (selectedProvider) {
            const config = vscode.workspace.getConfiguration('echoAI');
            await config.update('provider', selectedProvider, vscode.ConfigurationTarget.Global);
            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter API key for ${selectedProvider}`,
                password: true
            });
            if (apiKey) {
                // Store API key securely
                await context.secrets.store(`echo-ai-${selectedProvider}`, apiKey);
                vscode.window.showInformationMessage(`Echo AI configured with ${selectedProvider}`);
            }
        }
    });
    // Phase 2: Advanced Analysis Commands
    const forceAnalysisCommand = vscode.commands.registerCommand('echo-ai.forceAnalysis', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        try {
            vscode.window.showInformationMessage('Running advanced analysis...');
            await realTimeAnalyzer.forceAnalysis(editor.document);
            vscode.window.showInformationMessage('Advanced analysis completed');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        }
    });
    const autoFixAdvancedCommand = vscode.commands.registerCommand('echo-ai.autoFixAdvanced', async (diagnostics, documentUri) => {
        try {
            const document = await vscode.workspace.openTextDocument(documentUri);
            vscode.window.showInformationMessage('Applying advanced fixes...');
            // Get fixes for advanced issues
            const fixes = await echoProvider.fixErrors(document.getText(), diagnostics, document.languageId);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(documentUri, new vscode.Range(0, 0, document.lineCount, 0), fixes);
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                vscode.window.showInformationMessage('Advanced fixes applied successfully!');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Auto-fix failed: ${error}`);
        }
    });
    const explainAdvancedIssueCommand = vscode.commands.registerCommand('echo-ai.explainAdvancedIssue', async (diagnostic) => {
        try {
            const explanation = await echoProvider.explainCode(`Issue: ${diagnostic.message}\nCode: ${diagnostic.code}\nSeverity: ${diagnostic.severity}`, 'analysis');
            const panel = vscode.window.createWebviewPanel('echo-ai-issue-explanation', 'Echo AI - Issue Explanation', vscode.ViewColumn.Two, { enableScripts: true });
            panel.webview.html = getIssueExplanationWebviewContent(explanation, diagnostic);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Explanation failed: ${error}`);
        }
    });
    const showSecurityRecommendationsCommand = vscode.commands.registerCommand('echo-ai.showSecurityRecommendations', async (diagnostics) => {
        try {
            const securityIssues = diagnostics.map(d => d.message).join('\n');
            const recommendations = await echoProvider.getCompletion(`Provide security recommendations for these issues:\n${securityIssues}`, '', 'security', 1000);
            const panel = vscode.window.createWebviewPanel('echo-ai-security', 'Echo AI - Security Recommendations', vscode.ViewColumn.Two, { enableScripts: true });
            panel.webview.html = getSecurityRecommendationsWebviewContent(recommendations, diagnostics);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Security analysis failed: ${error}`);
        }
    });
    const toggleAnalysisTypeCommand = vscode.commands.registerCommand('echo-ai.toggleAnalysisType', async () => {
        const analysisTypes = [
            { label: 'Syntax Analysis', value: 'syntax' },
            { label: 'Semantic Analysis', value: 'semantic' },
            { label: 'Logic Analysis', value: 'logic' },
            { label: 'Security Analysis', value: 'security' },
            { label: 'Performance Analysis', value: 'performance' }
        ];
        const selectedType = await vscode.window.showQuickPick(analysisTypes, {
            placeHolder: 'Select analysis type to toggle'
        });
        if (selectedType) {
            const config = vscode.workspace.getConfiguration('echoAI.analysis');
            const currentTypes = config.get('enabledTypes', ['syntax', 'semantic', 'logic', 'security', 'performance']);
            const isEnabled = currentTypes.includes(selectedType.value);
            let newTypes;
            if (isEnabled) {
                newTypes = currentTypes.filter(t => t !== selectedType.value);
                vscode.window.showInformationMessage(`${selectedType.label} disabled`);
            }
            else {
                newTypes = [...currentTypes, selectedType.value];
                vscode.window.showInformationMessage(`${selectedType.label} enabled`);
            }
            await config.update('enabledTypes', newTypes, vscode.ConfigurationTarget.Global);
            realTimeAnalyzer.toggleAnalysisType(selectedType.value, !isEnabled);
        }
    });
    // Phase 3: Performance Optimization Commands
    const indexWorkspaceCommand = vscode.commands.registerCommand('echo-ai.indexWorkspace', async () => {
        try {
            vscode.window.showInformationMessage('Starting codebase indexing...');
            const stats = await codebaseIndexer.indexWorkspace();
            vscode.window.showInformationMessage(`Indexing complete! ${stats.indexedFiles} files indexed in ${(stats.indexingTime / 1000).toFixed(2)}s`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Indexing failed: ${error}`);
        }
    });
    const analyzeWorkspaceCommand = vscode.commands.registerCommand('echo-ai.analyzeWorkspace', async () => {
        try {
            vscode.window.showInformationMessage('Starting workspace analysis...');
            await incrementalAnalyzer.analyzeWorkspace();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Workspace analysis failed: ${error}`);
        }
    });
    const showPerformanceReportCommand = vscode.commands.registerCommand('echo-ai.showPerformanceReport', async () => {
        performanceMonitor.showPerformanceReport();
    });
    const showCodebaseStatsCommand = vscode.commands.registerCommand('echo-ai.showCodebaseStats', async () => {
        const stats = codebaseIndexer.getStats();
        const queueStatus = incrementalAnalyzer.getQueueStatus();
        const performanceMetrics = incrementalAnalyzer.getPerformanceMetrics();
        const panel = vscode.window.createWebviewPanel('echo-ai-codebase-stats', 'Echo AI - Codebase Statistics', vscode.ViewColumn.Two, { enableScripts: true });
        panel.webview.html = getCodebaseStatsWebviewContent(stats, queueStatus, performanceMetrics);
    });
    const clearAnalysisCacheCommand = vscode.commands.registerCommand('echo-ai.clearAnalysisCache', async () => {
        incrementalAnalyzer.clearCache();
        performanceMonitor.clearAlerts();
        vscode.window.showInformationMessage('Analysis cache cleared successfully');
    });
    const optimizePerformanceCommand = vscode.commands.registerCommand('echo-ai.optimizePerformance', async () => {
        const options = [
            { label: 'Clear All Caches', action: 'clearCaches' },
            { label: 'Refresh Codebase Index', action: 'refreshIndex' },
            { label: 'Reduce Analysis Scope', action: 'reduceScope' },
            { label: 'Show Performance Tips', action: 'showTips' }
        ];
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select optimization action'
        });
        if (!selected)
            return;
        switch (selected.action) {
            case 'clearCaches':
                incrementalAnalyzer.clearCache();
                performanceMonitor.clearAlerts();
                vscode.window.showInformationMessage('All caches cleared');
                break;
            case 'refreshIndex':
                await codebaseIndexer.refreshIndex();
                vscode.window.showInformationMessage('Codebase index refreshed');
                break;
            case 'reduceScope':
                await vscode.commands.executeCommand('echo-ai.toggleAnalysisType');
                break;
            case 'showTips':
                showPerformanceTips();
                break;
        }
    });
    const findSymbolCommand = vscode.commands.registerCommand('echo-ai.findSymbol', async () => {
        const symbolName = await vscode.window.showInputBox({
            prompt: 'Enter symbol name to find',
            placeHolder: 'function, class, or variable name'
        });
        if (!symbolName)
            return;
        const symbols = codebaseIndexer.findSymbol(symbolName);
        if (symbols.length === 0) {
            vscode.window.showInformationMessage(`No symbols found matching "${symbolName}"`);
            return;
        }
        const quickPickItems = symbols.slice(0, 50).map(symbol => ({
            label: symbol.name,
            description: `${symbol.kind} in ${symbol.scope}`,
            detail: `Line ${symbol.line}`,
            symbol
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `Found ${symbols.length} symbols matching "${symbolName}"`
        });
        if (selected) {
            // Navigate to symbol - this would need to be implemented based on the file structure
            vscode.window.showInformationMessage(`Found ${selected.symbol.name} at line ${selected.symbol.line} in ${selected.symbol.scope}`);
        }
    });
    // Start performance monitoring
    performanceMonitor.startMonitoring();
    // Phase 4: Advanced Refactoring Commands
    const smartRefactorCommand = vscode.commands.registerCommand('echo-ai.smartRefactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        try {
            vscode.window.showInformationMessage('Starting smart refactoring session...');
            const sessionId = await smartRefactoring.startSmartRefactoringSession(editor.document);
            // Show refactoring wizard
            const panel = vscode.window.createWebviewPanel('echo-ai-refactoring-wizard', 'Echo AI - Smart Refactoring Wizard', vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
            const steps = await smartRefactoring.getRefactoringWizardSteps(sessionId);
            panel.webview.html = getRefactoringWizardWebviewContent(sessionId);
            // Handle messages from webview
            panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'executeStep':
                        const stepResult = await smartRefactoring.executeWizardStep(sessionId, message.stepId, message.data);
                        panel.webview.postMessage({ command: 'stepCompleted', step: stepResult });
                        break;
                    case 'getPreview':
                        const preview = await smartRefactoring.generateRefactoringPreview(message.operation, editor.document);
                        panel.webview.postMessage({ command: 'previewReady', preview });
                        break;
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Smart refactoring failed: ${error}`);
        }
    });
    const analyzeArchitectureCommand = vscode.commands.registerCommand('echo-ai.analyzeArchitecture', async () => {
        try {
            vscode.window.showInformationMessage('Analyzing project architecture...');
            const analysis = await architecturalRefactoring.analyzeArchitecture();
            const suggestions = await architecturalRefactoring.suggestArchitecturalRefactoring(analysis);
            const panel = vscode.window.createWebviewPanel('echo-ai-architecture-analysis', 'Echo AI - Architecture Analysis', vscode.ViewColumn.Two, { enableScripts: true });
            panel.webview.html = getArchitectureAnalysisWebviewContent(analysis);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Architecture analysis failed: ${error}`);
        }
    });
    const refactorOpportunitiesCommand = vscode.commands.registerCommand('echo-ai.refactorOpportunities', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        try {
            const opportunities = await refactoringEngine.analyzeRefactoringOpportunities(editor.document);
            if (opportunities.length === 0) {
                vscode.window.showInformationMessage('No refactoring opportunities found in current file');
                return;
            }
            const quickPickItems = opportunities.slice(0, 20).map(op => ({
                label: op.name,
                description: `${op.complexity} complexity, ${op.riskLevel} risk`,
                detail: op.description,
                operation: op
            }));
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Found ${opportunities.length} refactoring opportunities`
            });
            if (selected) {
                const context = await refactoringEngine.buildRefactoringContext(editor.document);
                vscode.window.showInformationMessage(`Executing: ${selected.operation.name}`);
                const result = await refactoringEngine.executeRefactoring(selected.operation, context);
                if (result.success && result.changes) {
                    const applied = await vscode.workspace.applyEdit(result.changes);
                    if (applied) {
                        vscode.window.showInformationMessage(`Refactoring completed successfully! (Confidence: ${result.confidence}%)`);
                    }
                }
                else {
                    vscode.window.showErrorMessage(`Refactoring failed: ${result.errors.join(', ')}`);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Refactoring analysis failed: ${error}`);
        }
    });
    const aiRefactorRecommendationsCommand = vscode.commands.registerCommand('echo-ai.aiRefactorRecommendations', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        try {
            vscode.window.showInformationMessage('Getting AI refactoring recommendations...');
            const recommendations = await smartRefactoring.getAIRefactoringRecommendations(editor.document);
            const panel = vscode.window.createWebviewPanel('echo-ai-refactor-recommendations', 'Echo AI - Refactoring Recommendations', vscode.ViewColumn.Two, { enableScripts: true });
            panel.webview.html = getRefactoringRecommendationsWebviewContent(recommendations);
        }
        catch (error) {
            vscode.window.showErrorMessage(`AI recommendations failed: ${error}`);
        }
    });
    const extractMethodCommand = vscode.commands.registerCommand('echo-ai.extractMethod', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to extract into a method');
            return;
        }
        try {
            const operation = {
                id: `extract_method_${Date.now()}`,
                type: 'extract_method',
                name: 'Extract Method',
                description: 'Extract selected code into a new method',
                scope: 'function',
                complexity: 'medium',
                estimatedTime: 60000,
                riskLevel: 'medium',
                prerequisites: [],
                impacts: ['Improved code organization', 'Better reusability'],
                preview: true
            };
            const context = await refactoringEngine.buildRefactoringContext(editor.document);
            const result = await refactoringEngine.executeRefactoring(operation, context);
            if (result.success && result.changes) {
                const applied = await vscode.workspace.applyEdit(result.changes);
                if (applied) {
                    vscode.window.showInformationMessage('Method extracted successfully!');
                }
            }
            else {
                vscode.window.showErrorMessage(`Method extraction failed: ${result.errors.join(', ')}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Extract method failed: ${error}`);
        }
    });
    const modernizeCodeCommand = vscode.commands.registerCommand('echo-ai.modernizeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        if (editor.document.languageId !== 'javascript' && editor.document.languageId !== 'typescript') {
            vscode.window.showInformationMessage('Code modernization is currently supported for JavaScript and TypeScript files only');
            return;
        }
        try {
            const operation = {
                id: `modernize_code_${Date.now()}`,
                type: 'modernize_syntax',
                name: 'Modernize Code Syntax',
                description: 'Update code to use modern JavaScript/TypeScript features',
                scope: 'file',
                complexity: 'simple',
                estimatedTime: 30000,
                riskLevel: 'low',
                prerequisites: [],
                impacts: ['Modern syntax', 'Better performance', 'Improved readability'],
                preview: true
            };
            const context = await refactoringEngine.buildRefactoringContext(editor.document);
            const result = await refactoringEngine.executeRefactoring(operation, context);
            if (result.success && result.changes) {
                const applied = await vscode.workspace.applyEdit(result.changes);
                if (applied) {
                    vscode.window.showInformationMessage('Code modernized successfully!');
                }
            }
            else {
                vscode.window.showErrorMessage(`Code modernization failed: ${result.errors.join(', ')}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Code modernization failed: ${error}`);
        }
    });
    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(zap) Echo AI";
    statusBarItem.tooltip = "Echo AI is active";
    statusBarItem.command = 'echo-ai.configure';
    statusBarItem.show();
    // Add all subscriptions
    context.subscriptions.push(inlineCompletionProvider, completionItemProvider, codeActionProvider, explainCommand, refactorCommand, generateTestsCommand, fixErrorsCommand, configureCommand, forceAnalysisCommand, autoFixAdvancedCommand, explainAdvancedIssueCommand, showSecurityRecommendationsCommand, toggleAnalysisTypeCommand, indexWorkspaceCommand, analyzeWorkspaceCommand, showPerformanceReportCommand, showCodebaseStatsCommand, clearAnalysisCacheCommand, optimizePerformanceCommand, findSymbolCommand, smartRefactorCommand, analyzeArchitectureCommand, refactorOpportunitiesCommand, aiRefactorRecommendationsCommand, extractMethodCommand, modernizeCodeCommand, statusBarItem);
    // Show welcome message
    vscode.window.showInformationMessage('Echo AI is now active! Use Ctrl+Space for completions or right-click for AI features.', 'Configure').then(selection => {
        if (selection === 'Configure') {
            vscode.commands.executeCommand('echo-ai.configure');
        }
    });
}
function deactivate() {
    console.log('Echo AI extension is now deactivated');
    // Clean up Phase 2 components
    if (realTimeAnalyzer) {
        realTimeAnalyzer.dispose();
    }
    // Clean up Phase 3 components
    if (performanceMonitor) {
        performanceMonitor.dispose();
    }
    if (incrementalAnalyzer) {
        incrementalAnalyzer.dispose();
    }
    if (codebaseIndexer) {
        codebaseIndexer.dispose();
    }
}
function getExplanationWebviewContent(explanation, code) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Echo AI - Code Explanation</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            
            .code-block {
                background-color: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-textBlockQuote-border);
                padding: 16px;
                margin: 16px 0;
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                border-radius: 4px;
            }
            
            .explanation {
                margin: 20px 0;
                padding: 16px;
                background-color: var(--vscode-editor-selectionBackground);
                border-radius: 4px;
            }
            
            h2 {
                color: var(--vscode-textPreformat-foreground);
                border-bottom: 1px solid var(--vscode-textSeparator-foreground);
                padding-bottom: 8px;
            }
        </style>
    </head>
    <body>
        <h2>🔮 Code Explanation</h2>
        
        <h3>Selected Code:</h3>
        <div class="code-block"><pre><code>${escapeHtml(code)}</code></pre></div>
        
        <h3>Explanation:</h3>
        <div class="explanation">${explanation.replace(/\n/g, '<br>')}</div>
        
        <p><em>Generated by Echo AI</em></p>
    </body>
    </html>`;
}
function getIssueExplanationWebviewContent(explanation, diagnostic) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Echo AI - Issue Explanation</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            
            .issue-block {
                background-color: var(--vscode-inputValidation-errorBackground);
                border-left: 4px solid var(--vscode-inputValidation-errorBorder);
                padding: 16px;
                margin: 16px 0;
                border-radius: 4px;
            }
            
            .explanation {
                margin: 20px 0;
                padding: 16px;
                background-color: var(--vscode-editor-selectionBackground);
                border-radius: 4px;
            }
            
            .severity-error { color: var(--vscode-errorForeground); }
            .severity-warning { color: var(--vscode-warningForeground); }
            .severity-info { color: var(--vscode-infoForeground); }
            
            h2 {
                color: var(--vscode-textPreformat-foreground);
                border-bottom: 1px solid var(--vscode-textSeparator-foreground);
                padding-bottom: 8px;
            }
        </style>
    </head>
    <body>
        <h2>🔍 Advanced Issue Analysis</h2>
        
        <h3>Issue Details:</h3>
        <div class="issue-block">
            <p><strong>Message:</strong> ${escapeHtml(diagnostic.message)}</p>
            <p><strong>Type:</strong> ${diagnostic.code}</p>
            <p><strong>Severity:</strong> <span class="severity-${diagnostic.severity === 0 ? 'error' : diagnostic.severity === 1 ? 'warning' : 'info'}">${diagnostic.severity === 0 ? 'Error' : diagnostic.severity === 1 ? 'Warning' : 'Info'}</span></p>
        </div>
        
        <h3>AI Analysis & Explanation:</h3>
        <div class="explanation">${explanation.replace(/\n/g, '<br>')}</div>
        
        <p><em>Advanced analysis by Echo AI</em></p>
    </body>
    </html>`;
}
function getSecurityRecommendationsWebviewContent(recommendations, diagnostics) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Echo AI - Security Recommendations</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            
            .security-issue {
                background-color: var(--vscode-inputValidation-warningBackground);
                border-left: 4px solid var(--vscode-inputValidation-warningBorder);
                padding: 12px;
                margin: 8px 0;
                border-radius: 4px;
            }
            
            .recommendations {
                margin: 20px 0;
                padding: 16px;
                background-color: var(--vscode-textCodeBlock-background);
                border-radius: 4px;
            }
            
            .security-warning {
                color: var(--vscode-warningForeground);
                font-weight: bold;
            }
            
            h2 {
                color: var(--vscode-textPreformat-foreground);
                border-bottom: 1px solid var(--vscode-textSeparator-foreground);
                padding-bottom: 8px;
            }
            
            ul {
                margin: 10px 0;
                padding-left: 20px;
            }
        </style>
    </head>
    <body>
        <h2>🛡️ Security Analysis & Recommendations</h2>
        
        <h3>Security Issues Found:</h3>
        ${diagnostics.map(d => `<div class="security-issue">
            <span class="security-warning">⚠️</span> ${escapeHtml(d.message)}
        </div>`).join('')}
        
        <h3>AI Security Recommendations:</h3>
        <div class="recommendations">${recommendations.replace(/\n/g, '<br>')}</div>
        
        <h3>General Security Best Practices:</h3>
        <ul>
            <li>Always validate and sanitize user input</li>
            <li>Use environment variables for sensitive data</li>
            <li>Keep dependencies up to date</li>
            <li>Implement proper authentication and authorization</li>
            <li>Use HTTPS for all communications</li>
            <li>Follow the principle of least privilege</li>
        </ul>
        
        <p><em>Security analysis by Echo AI</em></p>
    </body>
    </html>`;
}
function getCodebaseStatsWebviewContent(stats, queueStatus, performanceMetrics) {
    const languageDistribution = Array.from(stats.languageDistribution.entries())
        .map(([lang, count]) => ({ lang, count }))
        .sort((a, b) => b.count - a.count);
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Echo AI - Codebase Statistics</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin: 20px 0;
            }
            
            .stat-card {
                background-color: var(--vscode-editor-selectionBackground);
                border-radius: 8px;
                padding: 16px;
                border-left: 4px solid var(--vscode-textBlockQuote-border);
            }
            
            .stat-value {
                font-size: 1.5em;
                font-weight: bold;
                color: var(--vscode-textPreformat-foreground);
            }
            
            .language-bar {
                background-color: var(--vscode-progressBar-background);
                height: 20px;
                border-radius: 10px;
                overflow: hidden;
                margin: 8px 0;
            }
            
            .language-fill {
                height: 100%;
                background-color: var(--vscode-progressBar-background);
                transition: width 0.3s ease;
            }
            
            h2 {
                color: var(--vscode-textPreformat-foreground);
                border-bottom: 1px solid var(--vscode-textSeparator-foreground);
                padding-bottom: 8px;
            }
        </style>
    </head>
    <body>
        <h1>📊 Codebase Statistics</h1>
        <p><em>Generated: ${new Date().toLocaleString()}</em></p>
        
        <h2>Overview</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Files</h3>
                <div class="stat-value">${stats.totalFiles.toLocaleString()}</div>
                <p>Files in codebase</p>
            </div>
            
            <div class="stat-card">
                <h3>Indexed Files</h3>
                <div class="stat-value">${stats.indexedFiles.toLocaleString()}</div>
                <p>Successfully analyzed</p>
            </div>
            
            <div class="stat-card">
                <h3>Total Lines</h3>
                <div class="stat-value">${stats.totalLines.toLocaleString()}</div>
                <p>Estimated lines of code</p>
            </div>
            
            <div class="stat-card">
                <h3>Average Complexity</h3>
                <div class="stat-value">${stats.averageComplexity.toFixed(1)}</div>
                <p>Cyclomatic complexity</p>
            </div>
        </div>
        
        <h2>Language Distribution</h2>
        ${languageDistribution.slice(0, 10).map(item => {
        const percentage = (item.count / stats.totalFiles * 100).toFixed(1);
        return `
                <div style="margin: 12px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>${item.lang}</span>
                        <span>${item.count} files (${percentage}%)</span>
                    </div>
                    <div class="language-bar">
                        <div class="language-fill" style="width: ${percentage}%; background-color: hsl(${(languageDistribution.indexOf(item) * 60) % 360}, 70%, 60%);"></div>
                    </div>
                </div>
            `;
    }).join('')}
        
        <h2>Analysis Queue Status</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Queue Size</h3>
                <div class="stat-value">${queueStatus.size}</div>
                <p>Files pending analysis</p>
            </div>
            
            <div class="stat-card">
                <h3>Active Analyses</h3>
                <div class="stat-value">${queueStatus.activeCount}</div>
                <p>Currently processing</p>
            </div>
            
            <div class="stat-card">
                <h3>Cache Hit Rate</h3>
                <div class="stat-value">${(performanceMetrics.cacheHitRate * 100).toFixed(1)}%</div>
                <p>Analysis cache efficiency</p>
            </div>
            
            <div class="stat-card">
                <h3>Avg Analysis Time</h3>
                <div class="stat-value">${Math.round(performanceMetrics.averageAnalysisTime)}ms</div>
                <p>Per file analysis</p>
            </div>
        </div>
        
        <h2>Largest Files</h2>
        <div style="margin: 20px 0;">
            ${stats.largestFiles.slice(0, 5).map((file) => `
                <div class="stat-card" style="margin: 8px 0;">
                    <strong>${file.uri.fsPath.split('/').pop()}</strong>
                    <p>Size: ${(file.size / 1024).toFixed(1)} KB | Language: ${file.languageId} | Functions: ${file.functions.length}</p>
                </div>
            `).join('')}
        </div>
        
        <p><em>Statistics help optimize Echo AI performance for your specific codebase</em></p>
    </body>
    </html>`;
}
function showPerformanceTips() {
    const panel = vscode.window.createWebviewPanel('echo-ai-performance-tips', 'Echo AI - Performance Tips', vscode.ViewColumn.Two, { enableScripts: true });
    panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Echo AI - Performance Tips</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            
            .tip-card {
                background-color: var(--vscode-editor-selectionBackground);
                border-radius: 8px;
                padding: 16px;
                margin: 16px 0;
                border-left: 4px solid var(--vscode-textBlockQuote-border);
            }
            
            .tip-priority-high { border-left-color: var(--vscode-inputValidation-errorBorder); }
            .tip-priority-medium { border-left-color: var(--vscode-inputValidation-warningBorder); }
            .tip-priority-low { border-left-color: var(--vscode-inputValidation-infoBorder); }
            
            h2 {
                color: var(--vscode-textPreformat-foreground);
                border-bottom: 1px solid var(--vscode-textSeparator-foreground);
                padding-bottom: 8px;
            }
            
            code {
                background-color: var(--vscode-textCodeBlock-background);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
            }
        </style>
    </head>
    <body>
        <h1>🚀 Echo AI Performance Optimization Tips</h1>
        
        <h2>High Priority Optimizations</h2>
        
        <div class="tip-card tip-priority-high">
            <h3>🎯 Reduce Analysis Scope</h3>
            <p>Disable analysis types you don't need:</p>
            <ul>
                <li>Use <code>Echo AI: Toggle Analysis Type</code> command</li>
                <li>Disable performance analysis for small projects</li>
                <li>Turn off maintainability analysis for prototypes</li>
            </ul>
        </div>
        
        <div class="tip-card tip-priority-high">
            <h3>⚡ Increase Analysis Delays</h3>
            <p>Adjust settings for better performance:</p>
            <ul>
                <li><code>echoAI.analysis.analysisDelay</code>: Increase to 3000ms+ for large files</li>
                <li><code>echoAI.completionDelay</code>: Increase to 1000ms+ for slower systems</li>
            </ul>
        </div>
        
        <h2>Medium Priority Optimizations</h2>
        
        <div class="tip-card tip-priority-medium">
            <h3>🗂️ File Size Management</h3>
            <p>Optimize which files get analyzed:</p>
            <ul>
                <li>Split very large files into smaller modules</li>
                <li>Use <code>echoAI.analysis.maxFileSize</code> to skip huge files</li>
                <li>Focus analysis on actively developed code</li>
            </ul>
        </div>
        
        <div class="tip-card tip-priority-medium">
            <h3>🎛️ Cache Management</h3>
            <p>Optimize cache performance:</p>
            <ul>
                <li>Clear cache regularly with <code>Echo AI: Clear Analysis Cache</code></li>
                <li>Monitor cache hit rates in performance reports</li>
                <li>Restart VS Code if memory usage gets too high</li>
            </ul>
        </div>
        
        <h2>Low Priority Optimizations</h2>
        
        <div class="tip-card tip-priority-low">
            <h3>🔧 System-Level Optimizations</h3>
            <p>Improve overall system performance:</p>
            <ul>
                <li>Close unnecessary browser tabs and applications</li>
                <li>Increase system RAM if possible (8GB+ recommended)</li>
                <li>Use SSD storage for better file I/O performance</li>
            </ul>
        </div>
        
        <div class="tip-card tip-priority-low">
            <h3>📊 Monitoring Best Practices</h3>
            <p>Keep track of performance:</p>
            <ul>
                <li>Check <code>Echo AI: Show Performance Report</code> weekly</li>
                <li>Monitor the performance status bar indicator</li>
                <li>Review codebase statistics after major changes</li>
            </ul>
        </div>
        
        <h2>Advanced Tips</h2>
        
        <div class="tip-card tip-priority-medium">
            <h3>🧠 Smart Analysis Scheduling</h3>
            <p>The incremental analyzer automatically:</p>
            <ul>
                <li>Prioritizes recently changed files</li>
                <li>Analyzes dependencies in optimal order</li>
                <li>Adapts delays based on system performance</li>
                <li>Caches results to avoid redundant work</li>
            </ul>
        </div>
        
        <p><em>Apply these tips to optimize Echo AI for your specific development environment and workflow.</em></p>
    </body>
    </html>`;
}
function getRefactoringWizardWebviewContent(sessionId) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Refactoring Wizard</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        .wizard-container { max-width: 800px; margin: 0 auto; }
        .step { margin: 20px 0; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
        .step.active { background: var(--vscode-editor-selectionBackground); }
        .step.completed { opacity: 0.7; border-color: var(--vscode-testing-iconPassed); }
        .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .step-title { font-weight: bold; font-size: 16px; }
        .step-status { padding: 4px 8px; border-radius: 3px; font-size: 12px; }
        .step-status.pending { background: var(--vscode-statusBarItem-warningBackground); }
        .step-status.active { background: var(--vscode-statusBarItem-prominentBackground); }
        .step-status.completed { background: var(--vscode-testing-iconPassed); }
        .progress-bar { width: 100%; height: 8px; background: var(--vscode-progressBar-background); border-radius: 4px; margin: 20px 0; }
        .progress-fill { height: 100%; background: var(--vscode-progressBar-foreground); border-radius: 4px; transition: width 0.3s ease; }
        .button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin: 5px; }
        .button:hover { background: var(--vscode-button-hoverBackground); }
        .button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .insights { margin: 20px 0; padding: 15px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 5px; }
        .insight { margin: 10px 0; padding: 8px; border-left: 4px solid var(--vscode-notificationsInfoIcon-foreground); }
    </style>
</head>
<body>
    <div class="wizard-container">
        <h1>🧙‍♂️ Smart Refactoring Wizard</h1>
        <p>AI-powered refactoring with step-by-step guidance</p>
        
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%" id="progressBar"></div>
        </div>

        <div id="wizardSteps">
            <div class="step active">
                <div class="step-header">
                    <div class="step-title">🔍 Code Analysis</div>
                    <div class="step-status active">Active</div>
                </div>
                <p>Analyzing your code for refactoring opportunities...</p>
                <button class="button" onclick="startAnalysis()">Start Analysis</button>
            </div>
        </div>

        <div class="insights">
            <h3>💡 AI Insights</h3>
            <div id="aiInsights">
                <div class="insight">Click "Start Analysis" to begin discovering refactoring opportunities</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function startAnalysis() {
            vscode.postMessage({ command: 'executeStep', stepId: 'analysis', sessionId: '${sessionId || ''}' });
        }
        
        function executeStep(stepId, data) {
            vscode.postMessage({ command: 'executeStep', stepId, data, sessionId: '${sessionId || ''}' });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'stepCompleted':
                    updateProgress(40);
                    document.getElementById('aiInsights').innerHTML = 
                        '<div class="insight">✅ Step completed: ' + message.step.name + '</div>';
                    break;
                case 'previewReady':
                    updateProgress(60);
                    break;
            }
        });

        function updateProgress(percent) {
            document.getElementById('progressBar').style.width = percent + '%';
        }
    </script>
</body>
</html>`;
}
function getArchitectureAnalysisWebviewContent(analysis) {
    const currentPattern = analysis?.currentPattern || 'Unknown';
    const issueCount = analysis?.issues?.length || 0;
    const suggestionCount = analysis?.suggestions?.length || 0;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Architecture Analysis</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        .analysis-container { max-width: 1000px; margin: 0 auto; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: var(--vscode-charts-blue); }
        .metric-label { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 5px; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid var(--vscode-notificationsErrorIcon-foreground); background: var(--vscode-inputValidation-errorBackground); }
        .issue.medium { border-left-color: var(--vscode-notificationsWarningIcon-foreground); }
        .issue.low { border-left-color: var(--vscode-notificationsInfoIcon-foreground); }
        .suggestion { margin: 10px 0; padding: 10px; border-left: 4px solid var(--vscode-testing-iconPassed); background: var(--vscode-editor-inactiveSelectionBackground); }
        .pattern-badge { display: inline-block; padding: 4px 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; font-size: 12px; }
        .button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin: 5px; }
    </style>
</head>
<body>
    <div class="analysis-container">
        <h1>🏗️ Architecture Analysis</h1>
        
        <div class="section">
            <h2>Current Architecture</h2>
            <p>Detected Pattern: <span class="pattern-badge">${currentPattern}</span></p>
        </div>

        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${analysis?.metrics?.coupling || 0}</div>
                <div class="metric-label">Coupling Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analysis?.metrics?.cohesion || 0}</div>
                <div class="metric-label">Cohesion Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analysis?.metrics?.complexity || 0}</div>
                <div class="metric-label">Complexity</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analysis?.metrics?.maintainability || 0}</div>
                <div class="metric-label">Maintainability</div>
            </div>
        </div>

        <div class="section">
            <h2>🚨 Issues Found (${issueCount})</h2>
            <div id="issues">
                ${analysis?.issues?.map((issue) => `
                    <div class="issue ${issue.severity}">
                        <strong>${issue.type.toUpperCase()}</strong> - ${issue.description}
                        <br><small>Impact: ${issue.impact} | Effort: ${issue.effort}</small>
                    </div>
                `).join('') || '<p>No significant issues detected.</p>'}
            </div>
        </div>

        <div class="section">
            <h2>💡 Improvement Suggestions (${suggestionCount})</h2>
            <div id="suggestions">
                ${analysis?.suggestions?.map((suggestion) => `
                    <div class="suggestion">
                        <strong>${suggestion.pattern?.name || 'Suggestion'}</strong> (${suggestion.confidence}% confidence)
                        <br>${suggestion.pattern?.description || 'General improvement'}
                        <br><small>Risk: ${suggestion.riskLevel} | Est. Time: ${Math.round((suggestion.estimatedTime || 0) / 60000)}min</small>
                        <br><button class="button" onclick="applySuggestion('${suggestion.pattern?.name}')">Apply Suggestion</button>
                    </div>
                `).join('') || '<p>No suggestions available at this time.</p>'}
            </div>
        </div>

        <div class="section">
            <button class="button" onclick="refreshAnalysis()">🔄 Refresh Analysis</button>
            <button class="button" onclick="exportReport()">📄 Export Report</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function refreshAnalysis() {
            vscode.postMessage({ command: 'refreshArchitectureAnalysis' });
        }
        
        function applySuggestion(patternName) {
            vscode.postMessage({ command: 'applySuggestion', pattern: patternName });
        }
        
        function exportReport() {
            vscode.postMessage({ command: 'exportArchitectureReport' });
        }
    </script>
</body>
</html>`;
}
function getRefactoringRecommendationsWebviewContent(recommendations) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Refactoring Recommendations</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        .recommendations-container { max-width: 1000px; margin: 0 auto; }
        .recommendation { margin: 15px 0; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
        .recommendation.high-confidence { border-left: 4px solid var(--vscode-testing-iconPassed); }
        .recommendation.medium-confidence { border-left: 4px solid var(--vscode-notificationsWarningIcon-foreground); }
        .recommendation.low-confidence { border-left: 4px solid var(--vscode-descriptionForeground); }
        .recommendation-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .recommendation-title { font-weight: bold; font-size: 16px; }
        .confidence-badge { padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
        .confidence-high { background: var(--vscode-testing-iconPassed); color: white; }
        .confidence-medium { background: var(--vscode-notificationsWarningIcon-foreground); color: white; }
        .confidence-low { background: var(--vscode-descriptionForeground); color: white; }
        .recommendation-type { font-size: 12px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 5px; }
        .recommendation-message { margin: 10px 0; line-height: 1.5; }
        .tags { margin: 10px 0; }
        .tag { display: inline-block; padding: 2px 6px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; font-size: 11px; margin: 2px; }
        .button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin: 5px 5px 5px 0; }
        .button:hover { background: var(--vscode-button-hoverBackground); }
        .button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { padding: 10px; text-align: center; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
        .stat-value { font-size: 20px; font-weight: bold; color: var(--vscode-charts-blue); }
        .stat-label { font-size: 12px; color: var(--vscode-descriptionForeground); }
        .filter-bar { margin: 20px 0; padding: 15px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 5px; }
        .filter-button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; margin: 2px; }
        .filter-button.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    </style>
</head>
<body>
    <div class="recommendations-container">
        <h1>🤖 AI Refactoring Recommendations</h1>
        <p>Intelligent suggestions powered by AI analysis of your codebase</p>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${recommendations?.length || 0}</div>
                <div class="stat-label">Total Recommendations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${recommendations?.filter(r => r.confidence > 80).length || 0}</div>
                <div class="stat-label">High Confidence</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${recommendations?.filter(r => r.actionable).length || 0}</div>
                <div class="stat-label">Actionable</div>
            </div>
        </div>

        <div class="filter-bar">
            <strong>Filter by:</strong>
            <button class="filter-button active" onclick="filterRecommendations('all')">All</button>
            <button class="filter-button" onclick="filterRecommendations('opportunity')">Opportunities</button>
            <button class="filter-button" onclick="filterRecommendations('suggestion')">Suggestions</button>
            <button class="filter-button" onclick="filterRecommendations('warning')">Warnings</button>
            <button class="filter-button" onclick="filterRecommendations('actionable')">Actionable Only</button>
        </div>

        <div id="recommendationsList">
            ${recommendations?.map((rec, index) => {
        const confidenceClass = rec.confidence > 80 ? 'high' : rec.confidence > 60 ? 'medium' : 'low';
        return `
                    <div class="recommendation ${confidenceClass}-confidence" data-type="${rec.type}" data-actionable="${rec.actionable}">
                        <div class="recommendation-header">
                            <div>
                                <div class="recommendation-type">${rec.type.replace('_', ' ')}</div>
                                <div class="recommendation-title">AI Insight #${index + 1}</div>
                            </div>
                            <div class="confidence-badge confidence-${confidenceClass}">${rec.confidence}% confidence</div>
                        </div>
                        <div class="recommendation-message">${rec.message}</div>
                        <div class="tags">
                            ${rec.relatedGoals?.map((goal) => `<span class="tag">${goal.replace('_', ' ')}</span>`).join('') || ''}
                            ${rec.actionable ? '<span class="tag">Actionable</span>' : ''}
                        </div>
                        ${rec.actionable ? `
                            <button class="button" onclick="applyRecommendation(${index})">Apply Recommendation</button>
                            <button class="button secondary" onclick="previewRecommendation(${index})">Preview</button>
                        ` : ''}
                        <button class="button secondary" onclick="dismissRecommendation(${index})">Dismiss</button>
                    </div>
                `;
    }).join('') || '<p>No recommendations available. Analyze your code to get AI-powered suggestions.</p>'}
        </div>

        <div style="margin: 30px 0; text-align: center;">
            <button class="button" onclick="refreshRecommendations()">🔄 Refresh Recommendations</button>
            <button class="button secondary" onclick="analyzeCurrentFile()">🔍 Analyze Current File</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function filterRecommendations(filter) {
            const recommendations = document.querySelectorAll('.recommendation');
            const buttons = document.querySelectorAll('.filter-button');
            
            // Update active button
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            // Filter recommendations
            recommendations.forEach(rec => {
                let show = true;
                
                switch (filter) {
                    case 'opportunity':
                        show = rec.dataset.type === 'opportunity';
                        break;
                    case 'suggestion':
                        show = rec.dataset.type === 'suggestion';
                        break;
                    case 'warning':
                        show = rec.dataset.type === 'warning';
                        break;
                    case 'actionable':
                        show = rec.dataset.actionable === 'true';
                        break;
                    default:
                        show = true;
                }
                
                rec.style.display = show ? 'block' : 'none';
            });
        }
        
        function applyRecommendation(index) {
            vscode.postMessage({ command: 'applyRecommendation', index });
        }
        
        function previewRecommendation(index) {
            vscode.postMessage({ command: 'previewRecommendation', index });
        }
        
        function dismissRecommendation(index) {
            vscode.postMessage({ command: 'dismissRecommendation', index });
        }
        
        function refreshRecommendations() {
            vscode.postMessage({ command: 'refreshRecommendations' });
        }
        
        function analyzeCurrentFile() {
            vscode.postMessage({ command: 'analyzeCurrentFile' });
        }
    </script>
</body>
</html>`;
}
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
//# sourceMappingURL=extension.js.map