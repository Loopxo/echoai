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
const ConfigurationManager_1 = require("./utils/ConfigurationManager");
const CodeAnalyzer_1 = require("./utils/CodeAnalyzer");
let echoProvider;
let completionProvider;
let errorProvider;
function activate(context) {
    console.log('Echo AI extension is now active!');
    // Initialize core components
    const configManager = new ConfigurationManager_1.ConfigurationManager();
    echoProvider = new EchoAIProvider_1.EchoAIProvider(configManager);
    completionProvider = new CompletionProvider_1.CompletionProvider(echoProvider);
    errorProvider = new ErrorDetectionProvider_1.ErrorDetectionProvider(echoProvider);
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
    const errorDetectionProvider = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (!configManager.get('enableErrorDetection', true)) {
            return;
        }
        try {
            const diagnostics = await errorProvider.provideDiagnostics(event.document);
            diagnosticCollection.set(event.document.uri, diagnostics);
        }
        catch (error) {
            console.error('Echo AI error detection error:', error);
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
    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(zap) Echo AI";
    statusBarItem.tooltip = "Echo AI is active";
    statusBarItem.command = 'echo-ai.configure';
    statusBarItem.show();
    // Add all subscriptions
    context.subscriptions.push(inlineCompletionProvider, completionItemProvider, errorDetectionProvider, explainCommand, refactorCommand, generateTestsCommand, fixErrorsCommand, configureCommand, statusBarItem);
    // Show welcome message
    vscode.window.showInformationMessage('Echo AI is now active! Use Ctrl+Space for completions or right-click for AI features.', 'Configure').then(selection => {
        if (selection === 'Configure') {
            vscode.commands.executeCommand('echo-ai.configure');
        }
    });
}
function deactivate() {
    console.log('Echo AI extension is now deactivated');
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
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
//# sourceMappingURL=extension.js.map