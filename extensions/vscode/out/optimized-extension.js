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
const OptimizedResourceManager_1 = require("./services/OptimizedResourceManager");
const PerformanceReporter_1 = require("./utils/PerformanceReporter");
const ConfigurationManager_1 = require("./utils/ConfigurationManager");
let resourceManager;
let performanceReporter;
let statusBarItem;
let echoProvider;
let completionProvider;
/**
 * Optimized extension activation - minimizes startup impact
 */
function activate(context) {
    console.log('🚀 Echo AI - Optimized mode activated');
    try {
        // Initialize lightweight activation system
        activation = LightweightActivation.getInstance(context);
        // Setup performance monitoring
        const resourceManager = OptimizedResourceManager_1.OptimizedResourceManager.getInstance(new ConfigurationManager_1.ConfigurationManager());
        performanceReporter = new PerformanceReporter_1.PerformanceReporter(resourceManager);
        // Create status bar item
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = "$(zap) Echo AI";
        statusBarItem.tooltip = "Echo AI - Optimized Mode";
        statusBarItem.command = 'echo-ai.showStatus';
        statusBarItem.show();
        // Register essential commands only
        registerEssentialCommands(context);
        // Activate core features asynchronously
        activation.activateEssentials().then(() => {
            console.log('✅ Echo AI core features ready');
            updateStatusBar('ready');
        }).catch(error => {
            console.error('❌ Echo AI activation failed:', error);
            updateStatusBar('error');
        });
        // Show welcome message
        vscode.window.showInformationMessage('Echo AI Optimized - Core features ready, advanced features load on demand', 'Open CLI', 'Performance Report').then(selection => {
            if (selection === 'Open CLI') {
                vscode.commands.executeCommand('echo-ai.showCLI');
            }
            else if (selection === 'Performance Report') {
                performanceReporter.showPerformanceReport();
            }
        });
    }
    catch (error) {
        console.error('Echo AI activation failed:', error);
        vscode.window.showErrorMessage(`Echo AI failed to activate: ${error}`);
    }
}
function registerEssentialCommands(context) {
    // CLI Command
    const showCLICommand = vscode.commands.registerCommand('echo-ai.showCLI', async () => {
        if (!cliService) {
            const echoProvider = await activation.activateFeature('echoProvider');
            cliService = MinimalCLIService.getInstance(context, echoProvider, new ConfigurationManager_1.ConfigurationManager());
        }
        cliService.showCLI();
    });
    // Status Command
    const showStatusCommand = vscode.commands.registerCommand('echo-ai.showStatus', () => {
        performanceReporter.showPerformanceReport();
    });
    // Performance Report Command
    const performanceReportCommand = vscode.commands.registerCommand('echo-ai.showPerformanceReport', () => {
        performanceReporter.showPerformanceReport();
    });
    // Explain Command - lazy loaded
    const explainCommand = vscode.commands.registerCommand('echo-ai.explain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to explain');
            return;
        }
        try {
            if (!activation.canActivateFeature('analysis')) {
                vscode.window.showWarningMessage('Insufficient resources for analysis. Try closing other extensions or restarting VS Code.');
                return;
            }
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Echo AI analyzing code...",
                cancellable: false
            }, async () => {
                const echoProvider = await activation.activateFeature('echoProvider');
                const selectedText = editor.document.getText(editor.selection);
                const explanation = await echoProvider.explainCode(selectedText, editor.document.languageId);
                // Show in simple notification instead of webview to save resources
                vscode.window.showInformationMessage(explanation.substring(0, 200) + (explanation.length > 200 ? '...' : ''), 'Show Full').then(selection => {
                    if (selection === 'Show Full') {
                        // Create temporary text document
                        vscode.workspace.openTextDocument({
                            content: `Code Explanation:\n\n${selectedText}\n\n---\n\n${explanation}`,
                            language: 'markdown'
                        }).then(doc => vscode.window.showTextDocument(doc));
                    }
                });
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Echo AI explain error: ${error}`);
        }
    });
    // Quick refactor command - lazy loaded
    const refactorCommand = vscode.commands.registerCommand('echo-ai.refactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to refactor');
            return;
        }
        try {
            if (!activation.canActivateFeature('refactoring')) {
                vscode.window.showWarningMessage('Insufficient resources for refactoring. Try freeing up memory first.');
                return;
            }
            const echoProvider = await activation.activateFeature('echoProvider');
            const selectedText = editor.document.getText(editor.selection);
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Refactoring code...",
                cancellable: false
            }, async () => {
                const refactoredCode = await echoProvider.refactorCode(selectedText, editor.document.languageId);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(editor.document.uri, editor.selection, refactoredCode);
                const applied = await vscode.workspace.applyEdit(edit);
                if (applied) {
                    vscode.window.showInformationMessage('Code refactored successfully!');
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Echo AI refactor error: ${error}`);
        }
    });
    // Register completion providers with lazy loading
    const completionProvider = vscode.languages.registerInlineCompletionItemProvider({ scheme: 'file' }, {
        provideInlineCompletionItems: async (document, position, context, token) => {
            try {
                if (!activation.canActivateFeature('analysis')) {
                    return []; // Skip completions if low on resources
                }
                const echoProvider = await activation.activateFeature('echoProvider');
                const completionProvider = await activation.activateFeature('completionProvider');
                const completion = await completionProvider.getInlineCompletion(document, position, context, token);
                return completion ? [completion] : [];
            }
            catch (error) {
                console.error('Echo AI completion error:', error);
                return [];
            }
        }
    });
    // Configure command
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
                await context.secrets.store(`echo-ai-${selectedProvider}`, apiKey);
                vscode.window.showInformationMessage(`Echo AI configured with ${selectedProvider}`);
            }
        }
    });
    // Register all commands
    context.subscriptions.push(showCLICommand, showStatusCommand, performanceReportCommand, explainCommand, refactorCommand, completionProvider, configureCommand, statusBarItem);
}
function updateStatusBar(status) {
    const icons = { ready: '$(zap)', loading: '$(sync~spin)', error: '$(warning)' };
    const tooltips = {
        ready: 'Echo AI Ready - Click for performance report',
        loading: 'Echo AI Loading...',
        error: 'Echo AI Error - Click for details'
    };
    statusBarItem.text = `${icons[status]} Echo AI`;
    statusBarItem.tooltip = tooltips[status];
}
function deactivate() {
    console.log('Echo AI optimized extension deactivated');
    if (activation) {
        activation.dispose();
    }
    if (cliService) {
        cliService.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
//# sourceMappingURL=optimized-extension.js.map