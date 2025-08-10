import * as vscode from 'vscode';
import { EchoAIProvider } from './providers/EchoAIProvider';
import { CompletionProvider } from './providers/CompletionProvider';
import { ErrorDetectionProvider } from './providers/ErrorDetectionProvider';
import { AdvancedDiagnosticsProvider } from './providers/AdvancedDiagnosticsProvider';
import { RealTimeAnalyzer } from './providers/RealTimeAnalyzer';
import { ConfigurationManager } from './utils/ConfigurationManager';
import { CodeAnalyzer } from './utils/CodeAnalyzer';

let echoProvider: EchoAIProvider;
let completionProvider: CompletionProvider;
let errorProvider: ErrorDetectionProvider;
let advancedDiagnosticsProvider: AdvancedDiagnosticsProvider;
let realTimeAnalyzer: RealTimeAnalyzer;

export function activate(context: vscode.ExtensionContext) {
    console.log('Echo AI extension is now active!');

    // Initialize core components
    const configManager = new ConfigurationManager();
    echoProvider = new EchoAIProvider(configManager);
    completionProvider = new CompletionProvider(echoProvider);
    errorProvider = new ErrorDetectionProvider(echoProvider);
    advancedDiagnosticsProvider = new AdvancedDiagnosticsProvider(echoProvider);

    // Register inline completion provider for all languages
    const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
        { scheme: 'file' },
        {
            provideInlineCompletionItems: async (document, position, context, token) => {
                if (!configManager.get<boolean>('enableInlineCompletion', true)) {
                    return [];
                }

                try {
                    const completion = await completionProvider.getInlineCompletion(
                        document, 
                        position, 
                        context, 
                        token
                    );
                    
                    return completion ? [completion] : [];
                } catch (error) {
                    console.error('Echo AI completion error:', error);
                    return [];
                }
            }
        }
    );

    // Register completion item provider for traditional completions
    const completionItemProvider = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file' },
        {
            provideCompletionItems: async (document, position, token) => {
                try {
                    return await completionProvider.getCompletionItems(document, position, token);
                } catch (error) {
                    console.error('Echo AI completion items error:', error);
                    return [];
                }
            }
        },
        '.', '(', '[', '{', ' '
    );

    // Register diagnostic provider for error detection
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('echo-ai');
    context.subscriptions.push(diagnosticCollection);

    // Initialize real-time analyzer with enhanced capabilities
    realTimeAnalyzer = new RealTimeAnalyzer(echoProvider, diagnosticCollection);

    // Register code action provider for advanced diagnostics
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        {
            provideCodeActions: async (document, range, context) => {
                try {
                    return await advancedDiagnosticsProvider.provideAdvancedCodeActions(
                        document, range, [...context.diagnostics]
                    );
                } catch (error) {
                    console.error('Advanced code actions error:', error);
                    return [];
                }
            }
        }
    );

    // Register commands
    const explainCommand = vscode.commands.registerCommand('echo-ai.explain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to explain');
            return;
        }

        const selectedText = editor.document.getText(selection);
        try {
            const explanation = await echoProvider.explainCode(selectedText, editor.document.languageId);
            
            // Show explanation in a webview panel
            const panel = vscode.window.createWebviewPanel(
                'echo-ai-explanation',
                'Echo AI - Code Explanation',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = getExplanationWebviewContent(explanation, selectedText);
        } catch (error) {
            vscode.window.showErrorMessage(`Echo AI error: ${error}`);
        }
    });

    const refactorCommand = vscode.commands.registerCommand('echo-ai.refactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

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
        } catch (error) {
            vscode.window.showErrorMessage(`Echo AI refactor error: ${error}`);
        }
    });

    const generateTestsCommand = vscode.commands.registerCommand('echo-ai.generateTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const codeAnalyzer = new CodeAnalyzer();
        
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
        } catch (error) {
            vscode.window.showErrorMessage(`Echo AI test generation error: ${error}`);
        }
    });

    const fixErrorsCommand = vscode.commands.registerCommand('echo-ai.fixErrors', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

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
        } catch (error) {
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
        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        }
    });

    const autoFixAdvancedCommand = vscode.commands.registerCommand('echo-ai.autoFixAdvanced', async (diagnostics: vscode.Diagnostic[], documentUri: vscode.Uri) => {
        try {
            const document = await vscode.workspace.openTextDocument(documentUri);
            
            vscode.window.showInformationMessage('Applying advanced fixes...');
            
            // Get fixes for advanced issues
            const fixes = await echoProvider.fixErrors(
                document.getText(), 
                diagnostics, 
                document.languageId
            );
            
            const edit = new vscode.WorkspaceEdit();
            edit.replace(documentUri, new vscode.Range(0, 0, document.lineCount, 0), fixes);
            
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                vscode.window.showInformationMessage('Advanced fixes applied successfully!');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Auto-fix failed: ${error}`);
        }
    });

    const explainAdvancedIssueCommand = vscode.commands.registerCommand('echo-ai.explainAdvancedIssue', async (diagnostic: vscode.Diagnostic) => {
        try {
            const explanation = await echoProvider.explainCode(
                `Issue: ${diagnostic.message}\nCode: ${diagnostic.code}\nSeverity: ${diagnostic.severity}`,
                'analysis'
            );
            
            const panel = vscode.window.createWebviewPanel(
                'echo-ai-issue-explanation',
                'Echo AI - Issue Explanation',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = getIssueExplanationWebviewContent(explanation, diagnostic);
        } catch (error) {
            vscode.window.showErrorMessage(`Explanation failed: ${error}`);
        }
    });

    const showSecurityRecommendationsCommand = vscode.commands.registerCommand('echo-ai.showSecurityRecommendations', async (diagnostics: vscode.Diagnostic[]) => {
        try {
            const securityIssues = diagnostics.map(d => d.message).join('\n');
            const recommendations = await echoProvider.getCompletion(
                `Provide security recommendations for these issues:\n${securityIssues}`,
                '',
                'security',
                1000
            );
            
            const panel = vscode.window.createWebviewPanel(
                'echo-ai-security',
                'Echo AI - Security Recommendations',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = getSecurityRecommendationsWebviewContent(recommendations, diagnostics);
        } catch (error) {
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
            const currentTypes = config.get<string[]>('enabledTypes', ['syntax', 'semantic', 'logic', 'security', 'performance']);
            
            const isEnabled = currentTypes.includes(selectedType.value);
            let newTypes: string[];
            
            if (isEnabled) {
                newTypes = currentTypes.filter(t => t !== selectedType.value);
                vscode.window.showInformationMessage(`${selectedType.label} disabled`);
            } else {
                newTypes = [...currentTypes, selectedType.value];
                vscode.window.showInformationMessage(`${selectedType.label} enabled`);
            }
            
            await config.update('enabledTypes', newTypes, vscode.ConfigurationTarget.Global);
            realTimeAnalyzer.toggleAnalysisType(selectedType.value, !isEnabled);
        }
    });

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(zap) Echo AI";
    statusBarItem.tooltip = "Echo AI is active";
    statusBarItem.command = 'echo-ai.configure';
    statusBarItem.show();

    // Add all subscriptions
    context.subscriptions.push(
        inlineCompletionProvider,
        completionItemProvider,
        codeActionProvider,
        explainCommand,
        refactorCommand,
        generateTestsCommand,
        fixErrorsCommand,
        configureCommand,
        forceAnalysisCommand,
        autoFixAdvancedCommand,
        explainAdvancedIssueCommand,
        showSecurityRecommendationsCommand,
        toggleAnalysisTypeCommand,
        statusBarItem
    );

    // Show welcome message
    vscode.window.showInformationMessage(
        'Echo AI is now active! Use Ctrl+Space for completions or right-click for AI features.',
        'Configure'
    ).then(selection => {
        if (selection === 'Configure') {
            vscode.commands.executeCommand('echo-ai.configure');
        }
    });
}

export function deactivate() {
    console.log('Echo AI extension is now deactivated');
    
    // Clean up Phase 2 components
    if (realTimeAnalyzer) {
        realTimeAnalyzer.dispose();
    }
}

function getExplanationWebviewContent(explanation: string, code: string): string {
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

function getIssueExplanationWebviewContent(explanation: string, diagnostic: vscode.Diagnostic): string {
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

function getSecurityRecommendationsWebviewContent(recommendations: string, diagnostics: vscode.Diagnostic[]): string {
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

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}