import * as vscode from 'vscode';

// ============================================================================
// CORE CONFIGURATION MANAGER
// ============================================================================
class ConfigManager {
    private readonly SECTION = 'echoAI';
    
    get<T>(key: string, defaultValue?: T): T {
        return vscode.workspace.getConfiguration(this.SECTION).get(key, defaultValue as T);
    }
    
    async set(key: string, value: any): Promise<void> {
        await vscode.workspace.getConfiguration(this.SECTION).update(key, value, vscode.ConfigurationTarget.Global);
    }
}

// ============================================================================
// SIMPLIFIED AI PROVIDER
// ============================================================================
class AIProvider {
    private config: ConfigManager;
    
    constructor(config: ConfigManager) {
        this.config = config;
    }
    
    async getCompletion(prompt: string, context: string = '', language: string = 'typescript'): Promise<string> {
        const provider = this.config.get<string>('provider', 'claude');
        
        // Simulate AI response - replace with actual provider implementation
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`AI response for: ${prompt.substring(0, 50)}...`);
            }, 500);
        });
    }
    
    async explainCode(code: string, language: string): Promise<string> {
        return this.getCompletion(`Explain this ${language} code:\n${code}`);
    }
    
    async refactorCode(code: string, language: string): Promise<string> {
        return this.getCompletion(`Refactor this ${language} code:\n${code}`);
    }
    
    async generateTests(code: string, language: string): Promise<string> {
        return this.getCompletion(`Generate tests for this ${language} code:\n${code}`);
    }
}

// ============================================================================
// COMPLETION PROVIDER
// ============================================================================
class CompletionProvider {
    private aiProvider: AIProvider;
    
    constructor(aiProvider: AIProvider) {
        this.aiProvider = aiProvider;
    }
    
    async getInlineCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem | null> {
        if (token.isCancellationRequested) return null;
        
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        
        if (prefix.trim().length < 3) return null;
        
        try {
            const completion = await this.aiProvider.getCompletion(
                `Complete this code: ${prefix}`,
                this.getContext(document, position),
                document.languageId
            );
            
            return new vscode.InlineCompletionItem(
                completion,
                new vscode.Range(position, position)
            );
        } catch (error) {
            console.error('Completion error:', error);
            return null;
        }
    }
    
    private getContext(document: vscode.TextDocument, position: vscode.Position): string {
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
    private cache = new Map<string, { data: any; timestamp: number }>();
    private readonly TTL = 60000; // 1 minute
    private cleanupInterval: NodeJS.Timeout;
    
    constructor() {
        // Clean cache every 30 seconds
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }
    
    set(key: string, value: any): void {
        this.cache.set(key, { data: value, timestamp: Date.now() });
    }
    
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data as T;
    }
    
    clear(): void {
        this.cache.clear();
    }
    
    private cleanup(): void {
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
    
    dispose(): void {
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
    private panel: vscode.WebviewPanel | undefined;
    private logs: Array<{ time: string; level: string; message: string }> = [];
    private maxLogs = 50;
    
    constructor(
        private context: vscode.ExtensionContext,
        private aiProvider: AIProvider
    ) {}
    
    showCLI(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        
        this.panel = vscode.window.createWebviewPanel(
            'echo-ai-cli',
            'Echo AI',
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: false }
        );
        
        this.panel.webview.html = this.getCLIHTML();
        this.panel.onDidDispose(() => { this.panel = undefined; this.logs = []; });
        this.setupMessageHandling();
        
        this.log('info', 'Echo AI CLI Ready - Type /help for commands');
    }
    
    log(level: string, message: string): void {
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
    
    private setupMessageHandling(): void {
        this.panel?.webview.onDidReceiveMessage(async message => {
            if (message.command === 'execute') {
                await this.executeCommand(message.text);
            }
        });
    }
    
    private async executeCommand(input: string): Promise<void> {
        const command = input.trim();
        if (!command) return;
        
        this.log('user', `> ${command}`);
        
        try {
            if (command.startsWith('/')) {
                await this.handleSystemCommand(command);
            } else {
                await this.handleAICommand(command);
            }
        } catch (error) {
            this.log('error', `Error: ${error}`);
        }
    }
    
    private async handleSystemCommand(command: string): Promise<void> {
        const [cmd] = command.toLowerCase().split(' ');
        
        switch (cmd) {
            case '/help':
                this.log('info', 'Commands:\n/help - Show this help\n/clear - Clear logs\n/status - Show status\n/analyze - Analyze current file\nOr type any question for AI');
                break;
            case '/clear':
                this.logs = [];
                if (this.panel) this.panel.webview.postMessage({ command: 'clear' });
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
                } else {
                    this.log('error', 'No active editor');
                }
                break;
            default:
                this.log('error', `Unknown command: ${cmd}`);
        }
    }
    
    private async handleAICommand(command: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        const context = editor?.selection.isEmpty ? '' : editor.document.getText(editor.selection);
        
        const response = await this.aiProvider.getCompletion(command, context);
        this.log('success', response);
    }
    
    private getCLIHTML(): string {
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
    
    dispose(): void {
        if (this.panel) this.panel.dispose();
    }
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================
let configManager: ConfigManager;
let aiProvider: AIProvider;
let completionProvider: CompletionProvider;
let memoryManager: MemoryManager;
let cliService: CLIService;
let statusBarItem: vscode.StatusBarItem;

// ============================================================================
// MAIN EXTENSION ACTIVATION
// ============================================================================
export async function activate(context: vscode.ExtensionContext) {
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
        vscode.window.showInformationMessage(
            'Echo AI Ready - Optimized for performance',
            'Open CLI', 'Configure'
        ).then(selection => {
            if (selection === 'Open CLI') {
                vscode.commands.executeCommand('echo-ai.showCLI');
            } else if (selection === 'Configure') {
                vscode.commands.executeCommand('echo-ai.configure');
            }
        });
        
    } catch (error) {
        console.error('Echo AI activation failed:', error);
        vscode.window.showErrorMessage(`Echo AI activation failed: ${error}`);
    }
}

function registerCommands(context: vscode.ExtensionContext): void {
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
            vscode.window.showErrorMessage(`Test generation failed: ${error}`);
        }
    });
    
    // CLI command
    const showCLICommand = vscode.commands.registerCommand('echo-ai.showCLI', () => {
        cliService.showCLI();
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
    
    context.subscriptions.push(
        explainCommand,
        refactorCommand, 
        generateTestsCommand,
        showCLICommand,
        configureCommand,
        performanceCommand
    );
}

function registerProviders(context: vscode.ExtensionContext): void {
    // Only register completion if enabled and memory allows
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    
    if (configManager.get<boolean>('enableInlineCompletion', true) && memUsage < 200) {
        const inlineProvider = vscode.languages.registerInlineCompletionItemProvider(
            { scheme: 'file' },
            {
                provideInlineCompletionItems: async (document, position, context, token) => {
                    try {
                        const result = await completionProvider.getInlineCompletion(document, position, context, token);
                        return result ? [result] : [];
                    } catch (error) {
                        console.error('Completion error:', error);
                        return [];
                    }
                }
            }
        );
        context.subscriptions.push(inlineProvider);
    }
}

function startMemoryMonitoring(): void {
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

function updateStatusBar(): void {
    const stats = memoryManager.getStats();
    const isHighMemory = stats.heapUsed > 150;
    
    statusBarItem.text = `$(${isHighMemory ? 'warning' : 'zap'}) Echo AI (${stats.heapUsed}MB)`;
    statusBarItem.tooltip = `Echo AI - Memory: ${stats.heapUsed}MB, Cache: ${stats.cacheItems} items`;
    statusBarItem.command = 'echo-ai.performance';
    statusBarItem.backgroundColor = isHighMemory ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
}

export function deactivate() {
    console.log('Echo AI extension deactivated');
    
    if (memoryManager) memoryManager.dispose();
    if (cliService) cliService.dispose();
    if (statusBarItem) statusBarItem.dispose();
}