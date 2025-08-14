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
// ============================================================================
// CORE CONFIGURATION MANAGER
// ============================================================================
class ConfigManager {
    SECTION = 'echoAI';
    get(key, defaultValue) {
        return vscode.workspace.getConfiguration(this.SECTION).get(key, defaultValue);
    }
    async set(key, value) {
        await vscode.workspace.getConfiguration(this.SECTION).update(key, value, vscode.ConfigurationTarget.Global);
    }
}
// ============================================================================
// SIMPLIFIED AI PROVIDER
// ============================================================================
class AIProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async getCompletion(prompt, context = '', language = 'typescript') {
        const provider = this.config.get('provider', 'claude');
        // Simulate AI response - replace with actual provider implementation
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`AI response for: ${prompt.substring(0, 50)}...`);
            }, 500);
        });
    }
    async explainCode(code, language) {
        return this.getCompletion(`Explain this ${language} code:\n${code}`);
    }
    async refactorCode(code, language) {
        return this.getCompletion(`Refactor this ${language} code:\n${code}`);
    }
    async generateTests(code, language) {
        return this.getCompletion(`Generate tests for this ${language} code:\n${code}`);
    }
}
// ============================================================================
// COMPLETION PROVIDER
// ============================================================================
class CompletionProvider {
    aiProvider;
    constructor(aiProvider) {
        this.aiProvider = aiProvider;
    }
    async getInlineCompletion(document, position, context, token) {
        if (token.isCancellationRequested)
            return null;
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        if (prefix.trim().length < 3)
            return null;
        try {
            const completion = await this.aiProvider.getCompletion(`Complete this code: ${prefix}`, this.getContext(document, position), document.languageId);
            return new vscode.InlineCompletionItem(completion, new vscode.Range(position, position));
        }
        catch (error) {
            console.error('Completion error:', error);
            return null;
        }
    }
    getContext(document, position) {
        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(document.lineCount - 1, position.line + 2);
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            context += document.lineAt(i).text + '\n';
        }
        return context;
    }
}
// ============================================================================
// MEMORY MANAGER
// ============================================================================
class MemoryManager {
    cache = new Map();
    TTL = 60000; // 1 minute
    cleanupInterval;
    constructor() {
        // Clean cache every 30 seconds
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }
    set(key, value) {
        this.cache.set(key, { data: value, timestamp: Date.now() });
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        if (Date.now() - item.timestamp > this.TTL) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }
    clear() {
        this.cache.clear();
    }
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.TTL) {
                this.cache.delete(key);
            }
        }
    }
    getStats() {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            cacheItems: this.cache.size
        };
    }
    dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }
}
// ============================================================================
// MINIMAL CLI SERVICE
// ============================================================================
class CLIService {
    context;
    aiProvider;
    panel;
    logs = [];
    maxLogs = 50;
    constructor(context, aiProvider) {
        this.context = context;
        this.aiProvider = aiProvider;
    }
    showCLI() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        this.panel = vscode.window.createWebviewPanel('echo-ai-cli', 'Echo AI', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: false });
        this.panel.webview.html = this.getCLIHTML();
        this.panel.onDidDispose(() => { this.panel = undefined; this.logs = []; });
        this.setupMessageHandling();
        this.log('info', 'Echo AI CLI Ready - Type /help for commands');
    }
    log(level, message) {
        const entry = {
            time: new Date().toLocaleTimeString(),
            level,
            message
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        if (this.panel) {
            this.panel.webview.postMessage({ command: 'log', entry });
        }
    }
    setupMessageHandling() {
        this.panel?.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'execute') {
                await this.executeCommand(message.text);
            }
        });
    }
    async executeCommand(input) {
        const command = input.trim();
        if (!command)
            return;
        this.log('user', `> ${command}`);
        try {
            if (command.startsWith('/')) {
                await this.handleSystemCommand(command);
            }
            else {
                await this.handleAICommand(command);
            }
        }
        catch (error) {
            this.log('error', `Error: ${error}`);
        }
    }
    async handleSystemCommand(command) {
        const [cmd] = command.toLowerCase().split(' ');
        switch (cmd) {
            case '/help':
                this.log('info', 'Commands:\n/help - Show this help\n/clear - Clear logs\n/status - Show status\n/analyze - Analyze current file\nOr type any question for AI');
                break;
            case '/clear':
                this.logs = [];
                if (this.panel)
                    this.panel.webview.postMessage({ command: 'clear' });
                break;
            case '/status':
                const stats = memoryManager.getStats();
                this.log('info', `Memory: ${stats.heapUsed}MB / Provider: ${configManager.get('provider', 'claude')} / Cache: ${stats.cacheItems} items`);
                break;
            case '/analyze':
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const code = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                    const analysis = await this.aiProvider.explainCode(code, editor.document.languageId);
                    this.log('success', analysis.substring(0, 300) + (analysis.length > 300 ? '...' : ''));
                }
                else {
                    this.log('error', 'No active editor');
                }
                break;
            default:
                this.log('error', `Unknown command: ${cmd}`);
        }
    }
    async handleAICommand(command) {
        const editor = vscode.window.activeTextEditor;
        const context = editor?.selection.isEmpty ? '' : editor.document.getText(editor.selection);
        const response = await this.aiProvider.getCompletion(command, context);
        this.log('success', response);
    }
    getCLIHTML() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'SF Mono', Monaco, monospace; 
            background: var(--vscode-editor-background); 
            color: var(--vscode-foreground); 
            height: 100vh; 
            display: flex; 
            flex-direction: column; 
        }
        .header { 
            padding: 8px 12px; 
            border-bottom: 1px solid var(--vscode-panel-border); 
            background: var(--vscode-sideBar-background); 
            font-weight: bold; 
        }
        .output { 
            flex: 1; 
            padding: 8px 12px; 
            overflow-y: auto; 
            font-size: 12px; 
            line-height: 1.4; 
        }
        .log { margin-bottom: 4px; }
        .log-time { color: var(--vscode-descriptionForeground); margin-right: 6px; }
        .log-user { color: var(--vscode-foreground); }
        .log-info { color: var(--vscode-charts-blue); }
        .log-success { color: var(--vscode-testing-iconPassed); }
        .log-error { color: var(--vscode-errorForeground); }
        .input-container { 
            padding: 8px 12px; 
            border-top: 1px solid var(--vscode-panel-border); 
            background: var(--vscode-sideBar-background); 
        }
        .input { 
            width: 100%; 
            background: var(--vscode-input-background); 
            border: 1px solid var(--vscode-input-border); 
            color: var(--vscode-foreground); 
            padding: 4px 8px; 
            font-family: inherit; 
            outline: none; 
        }
    </style>
</head>
<body>
    <div class="header">Echo AI CLI</div>
    <div class="output" id="output">
        <div class="log log-info">Welcome! Type /help for commands or ask AI anything directly.</div>
    </div>
    <div class="input-container">
        <input type="text" class="input" id="input" placeholder="Enter command or question..." autocomplete="off">
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const output = document.getElementById('output');
        const input = document.getElementById('input');
        
        input.focus();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const text = input.value.trim();
                if (text) {
                    vscode.postMessage({ command: 'execute', text });
                    input.value = '';
                }
            }
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'log') {
                const div = document.createElement('div');
                div.className = \`log log-\${message.entry.level}\`;
                div.innerHTML = \`<span class="log-time">\${message.entry.time}</span>\${message.entry.message}\`;
                output.appendChild(div);
                output.scrollTop = output.scrollHeight;
            } else if (message.command === 'clear') {
                output.innerHTML = '';
            }
        });
    </script>
</body>
</html>`;
    }
    dispose() {
        if (this.panel)
            this.panel.dispose();
    }
}
// ============================================================================
// GLOBAL INSTANCES
// ============================================================================
let configManager;
let aiProvider;
let completionProvider;
let memoryManager;
let cliService;
let statusBarItem;
// ============================================================================
// MAIN EXTENSION ACTIVATION
// ============================================================================
async function activate(context) {
    console.log('Echo AI extension activated');
    try {
        // Initialize core services
        configManager = new ConfigManager();
        aiProvider = new AIProvider(configManager);
        completionProvider = new CompletionProvider(aiProvider);
        memoryManager = new MemoryManager();
        cliService = new CLIService(context, aiProvider);
        // Create status bar
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        updateStatusBar();
        statusBarItem.show();
        // Register commands
        registerCommands(context);
        // Register providers
        registerProviders(context);
        // Start memory monitoring
        startMemoryMonitoring();
        // Show welcome
        vscode.window.showInformationMessage('Echo AI Ready - Optimized for performance', 'Open CLI', 'Configure').then(selection => {
            if (selection === 'Open CLI') {
                vscode.commands.executeCommand('echo-ai.showCLI');
            }
            else if (selection === 'Configure') {
                vscode.commands.executeCommand('echo-ai.configure');
            }
        });
    }
    catch (error) {
        console.error('Echo AI activation failed:', error);
        vscode.window.showErrorMessage(`Echo AI activation failed: ${error}`);
    }
}
function registerCommands(context) {
    // Explain command
    const explainCommand = vscode.commands.registerCommand('echo-ai.explain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to explain');
            return;
        }
        try {
            const selectedText = editor.document.getText(editor.selection);
            const explanation = await aiProvider.explainCode(selectedText, editor.document.languageId);
            // Show in notification
            const short = explanation.length > 200 ? explanation.substring(0, 200) + '...' : explanation;
            vscode.window.showInformationMessage(short, 'Show Full').then(selection => {
                if (selection === 'Show Full') {
                    vscode.workspace.openTextDocument({
                        content: `# Code Explanation\n\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\`\n\n${explanation}`,
                        language: 'markdown'
                    }).then(doc => vscode.window.showTextDocument(doc));
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Explanation failed: ${error}`);
        }
    });
    // Refactor command
    const refactorCommand = vscode.commands.registerCommand('echo-ai.refactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to refactor');
            return;
        }
        try {
            const selectedText = editor.document.getText(editor.selection);
            const refactoredCode = await aiProvider.refactorCode(selectedText, editor.document.languageId);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, editor.selection, refactoredCode);
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                vscode.window.showInformationMessage('Code refactored successfully!');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Refactor failed: ${error}`);
        }
    });
    // Generate tests command
    const generateTestsCommand = vscode.commands.registerCommand('echo-ai.generateTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor');
            return;
        }
        try {
            const code = editor.document.getText();
            const tests = await aiProvider.generateTests(code, editor.document.languageId);
            const testFileName = editor.document.fileName.replace(/\.(ts|js|py)$/, '.test.$1');
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
            vscode.window.showErrorMessage(`Test generation failed: ${error}`);
        }
    });
    // CLI command
    const showCLICommand = vscode.commands.registerCommand('echo-ai.showCLI', async () => {
        const terminal = vscode.window.createTerminal({
            name: 'Echo AI',
            iconPath: new vscode.ThemeIcon('terminal'),
            location: { viewColumn: vscode.ViewColumn.Two, preserveFocus: false }
        });
        terminal.show();
        // Use npx directly to avoid path issues - it's cached after first run anyway
        terminal.sendText('npx --yes echoai@latest');
    });
    // Configure command
    const configureCommand = vscode.commands.registerCommand('echo-ai.configure', async () => {
        const providers = ['claude', 'openai', 'groq', 'openrouter', 'gemini', 'meta'];
        const selectedProvider = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select AI Provider'
        });
        if (selectedProvider) {
            await configManager.set('provider', selectedProvider);
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
    // Performance command
    const performanceCommand = vscode.commands.registerCommand('echo-ai.performance', () => {
        const stats = memoryManager.getStats();
        const info = `Echo AI Performance:\nMemory: ${stats.heapUsed}MB / ${stats.heapTotal}MB\nCache: ${stats.cacheItems} items\nProvider: ${configManager.get('provider', 'claude')}`;
        vscode.workspace.openTextDocument({
            content: info,
            language: 'plaintext'
        }).then(doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside));
    });
    context.subscriptions.push(explainCommand, refactorCommand, generateTestsCommand, showCLICommand, configureCommand, performanceCommand);
}
function registerProviders(context) {
    // Only register completion if enabled and memory allows
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (configManager.get('enableInlineCompletion', true) && memUsage < 200) {
        const inlineProvider = vscode.languages.registerInlineCompletionItemProvider({ scheme: 'file' }, {
            provideInlineCompletionItems: async (document, position, context, token) => {
                try {
                    const result = await completionProvider.getInlineCompletion(document, position, context, token);
                    return result ? [result] : [];
                }
                catch (error) {
                    console.error('Completion error:', error);
                    return [];
                }
            }
        });
        context.subscriptions.push(inlineProvider);
    }
}
function startMemoryMonitoring() {
    setInterval(() => {
        updateStatusBar();
        // Auto cleanup if memory usage is high
        const stats = memoryManager.getStats();
        if (stats.heapUsed > 200) {
            memoryManager.clear();
            console.log('Echo AI: High memory usage, cleared cache');
        }
    }, 30000);
}
function updateStatusBar() {
    const stats = memoryManager.getStats();
    const isHighMemory = stats.heapUsed > 150;
    statusBarItem.text = `$(${isHighMemory ? 'warning' : 'zap'}) Echo AI (${stats.heapUsed}MB)`;
    statusBarItem.tooltip = `Echo AI - Click to open CLI\nMemory: ${stats.heapUsed}MB, Cache: ${stats.cacheItems} items`;
    statusBarItem.command = 'echo-ai.showCLI';
    statusBarItem.backgroundColor = isHighMemory ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
}
function deactivate() {
    console.log('Echo AI extension deactivated');
    if (memoryManager)
        memoryManager.dispose();
    if (cliService)
        cliService.dispose();
    if (statusBarItem)
        statusBarItem.dispose();
}
//# sourceMappingURL=clean-extension.js.map