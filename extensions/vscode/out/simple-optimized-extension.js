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
const ConfigurationManager_1 = require("./utils/ConfigurationManager");
let echoProvider;
let completionProvider;
let configManager;
let statusBarItem;
let isLowMemoryMode = false;
/**
 * Optimized lightweight activation
 * Only loads essential features, defers heavy components until needed
 */
async function activate(context) {
    console.log('🚀 Echo AI - Lightweight mode activated');
    try {
        // Initialize configuration
        configManager = new ConfigurationManager_1.ConfigurationManager();
        // Create status bar with memory indicator
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        updateStatusBar();
        statusBarItem.show();
        // Monitor memory usage
        startMemoryMonitoring();
        // Register only essential commands
        registerOptimizedCommands(context);
        // Initialize core providers asynchronously to not block startup
        setTimeout(async () => {
            await initializeCoreProviders();
            console.log('✅ Echo AI core ready');
        }, 1000);
        // Show optimized welcome
        vscode.window.showInformationMessage('Echo AI Optimized - Reduced memory footprint, features load on demand', 'Show Performance').then(selection => {
            if (selection === 'Show Performance') {
                showPerformanceInfo();
            }
        });
    }
    catch (error) {
        console.error('❌ Echo AI activation failed:', error);
        vscode.window.showErrorMessage(`Echo AI failed to activate: ${error}`);
    }
}
async function initializeCoreProviders() {
    try {
        // Only initialize if we have sufficient memory
        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memUsage < 300) {
            echoProvider = new EchoAIProvider_1.EchoAIProvider(configManager);
            // Only initialize completion provider if memory allows
            if (memUsage < 200 && configManager.get('enableInlineCompletion', true)) {
                completionProvider = new CompletionProvider_1.CompletionProvider(echoProvider);
                console.log('✅ Completion provider ready');
            }
        }
        else {
            console.log('⚠️ High memory usage, skipping provider initialization');
            isLowMemoryMode = true;
        }
        updateStatusBar();
    }
    catch (error) {
        console.error('Failed to initialize providers:', error);
    }
}
function registerOptimizedCommands(context) {
    // Essential explain command - lightweight implementation
    const explainCommand = vscode.commands.registerCommand('echo-ai.explain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to explain');
            return;
        }
        if (!echoProvider) {
            await initializeCoreProviders();
            if (!echoProvider) {
                vscode.window.showWarningMessage('Echo AI provider not available - insufficient memory');
                return;
            }
        }
        try {
            const selectedText = editor.document.getText(editor.selection);
            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Explaining code...",
                cancellable: false
            }, async () => {
                const explanation = await echoProvider.explainCode(selectedText, editor.document.languageId);
                // Show in notification instead of heavy webview
                const shortExplanation = explanation.length > 200
                    ? explanation.substring(0, 200) + '...'
                    : explanation;
                vscode.window.showInformationMessage(shortExplanation, 'Show Full').then(selection => {
                    if (selection === 'Show Full') {
                        // Create markdown document instead of webview
                        vscode.workspace.openTextDocument({
                            content: `# Code Explanation\n\n## Selected Code:\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\`\n\n## Explanation:\n${explanation}`,
                            language: 'markdown'
                        }).then(doc => vscode.window.showTextDocument(doc));
                    }
                });
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Explanation failed: ${error}`);
        }
    });
    // Lightweight refactor command
    const refactorCommand = vscode.commands.registerCommand('echo-ai.refactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to refactor');
            return;
        }
        if (!echoProvider) {
            await initializeCoreProviders();
            if (!echoProvider) {
                vscode.window.showWarningMessage('Echo AI provider not available');
                return;
            }
        }
        try {
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
            vscode.window.showErrorMessage(`Refactor failed: ${error}`);
        }
    });
    // Performance command
    const performanceCommand = vscode.commands.registerCommand('echo-ai.showPerformance', () => {
        showPerformanceInfo();
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
                // Reinitialize provider with new config
                echoProvider = new EchoAIProvider_1.EchoAIProvider(configManager);
            }
        }
    });
    // Optimized completion provider - only register if memory allows
    setTimeout(() => {
        if (completionProvider && !isLowMemoryMode) {
            const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider({ scheme: 'file' }, {
                provideInlineCompletionItems: async (document, position, context, token) => {
                    try {
                        // Skip completions if memory is low
                        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
                        if (memUsage > 250) {
                            return [];
                        }
                        const completion = await completionProvider.getInlineCompletion(document, position, context, token);
                        return completion ? [completion] : [];
                    }
                    catch (error) {
                        console.error('Completion error:', error);
                        return [];
                    }
                }
            });
            context.subscriptions.push(inlineCompletionProvider);
            console.log('✅ Completion provider registered');
        }
    }, 2000);
    // Register commands
    context.subscriptions.push(explainCommand, refactorCommand, performanceCommand, configureCommand, statusBarItem);
}
function startMemoryMonitoring() {
    // Check memory every 30 seconds
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        // Enable low memory mode if usage is high
        if (heapUsedMB > 200 && !isLowMemoryMode) {
            isLowMemoryMode = true;
            console.log('⚠️ Entering low memory mode');
            vscode.window.showWarningMessage('Echo AI: High memory usage detected, some features disabled');
        }
        else if (heapUsedMB < 150 && isLowMemoryMode) {
            isLowMemoryMode = false;
            console.log('✅ Exiting low memory mode');
        }
        updateStatusBar();
        // Force garbage collection if available and memory is high
        if (heapUsedMB > 300 && global.gc) {
            global.gc();
        }
    }, 30000);
}
function updateStatusBar() {
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    if (isLowMemoryMode) {
        statusBarItem.text = `$(warning) Echo AI (${memUsage}MB)`;
        statusBarItem.tooltip = 'Echo AI - Low memory mode active';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    else {
        statusBarItem.text = `$(zap) Echo AI (${memUsage}MB)`;
        statusBarItem.tooltip = `Echo AI Ready - Memory: ${memUsage}MB`;
        statusBarItem.backgroundColor = undefined;
    }
    statusBarItem.command = 'echo-ai.showPerformance';
}
function showPerformanceInfo() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    const recommendations = [];
    if (heapUsedMB > 200) {
        recommendations.push('• High memory usage - consider restarting VS Code');
        recommendations.push('• Close other extensions if not needed');
    }
    else if (heapUsedMB > 150) {
        recommendations.push('• Memory usage is moderate');
        recommendations.push('• Some advanced features may be limited');
    }
    else {
        recommendations.push('• Memory usage is optimal');
        recommendations.push('• All features available');
    }
    const info = `📊 Echo AI Performance Report

Memory Usage:
• Heap Used: ${heapUsedMB} MB
• Heap Total: ${heapTotalMB} MB  
• RSS: ${rssMB} MB
• Status: ${isLowMemoryMode ? 'Low Memory Mode' : 'Normal'}

Components:
• Core Provider: ${echoProvider ? '✅ Active' : '❌ Inactive'}
• Completion: ${completionProvider ? '✅ Active' : '❌ Inactive'}

Recommendations:
${recommendations.join('\n')}

Generated: ${new Date().toLocaleString()}`;
    // Show in a text document instead of heavy webview
    vscode.workspace.openTextDocument({
        content: info,
        language: 'plaintext'
    }).then(doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside));
}
function deactivate() {
    console.log('Echo AI optimized extension deactivated');
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
