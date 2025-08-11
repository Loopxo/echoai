import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { ConfigurationManager } from '../utils/ConfigurationManager';

export interface CLILogEntry {
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'success';
    message: string;
    command?: string;
    context?: string;
}

export class CLIService {
    private static instance: CLIService;
    private panel: vscode.WebviewPanel | undefined;
    private logs: CLILogEntry[] = [];
    private maxLogs: number = 1000;
    private isProcessing: boolean = false;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;

    constructor(
        private context: vscode.ExtensionContext,
        private echoProvider: EchoAIProvider,
        private configManager: ConfigurationManager
    ) {
        this.maxLogs = this.configManager.get<number>('cli.maxLogEntries', 1000);
        this.setupEventListeners();
    }

    public static getInstance(context: vscode.ExtensionContext, echoProvider: EchoAIProvider, configManager: ConfigurationManager): CLIService {
        if (!CLIService.instance) {
            CLIService.instance = new CLIService(context, echoProvider, configManager);
        }
        return CLIService.instance;
    }

    public showCLI(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'echo-ai-cli',
            'Echo AI CLI',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        this.panel.webview.html = this.getCLIWebviewContent();
        this.setupWebviewMessageHandling();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Send initial logs
        this.sendLogsToWebview();
        this.log('info', 'Echo AI CLI Ready - Type /help for commands');
    }

    public log(level: CLILogEntry['level'], message: string, command?: string, context?: string): void {
        const entry: CLILogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            command,
            context
        };

        this.logs.push(entry);

        // Maintain max log entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Send to webview if open
        if (this.panel && this.configManager.get<boolean>('cli.showLogs', true)) {
            this.panel.webview.postMessage({
                command: 'newLog',
                log: entry
            });
        }
    }

    public clearLogs(): void {
        this.logs = [];
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'clearLogs'
            });
        }
        this.log('info', 'Logs cleared');
    }

    private setupEventListeners(): void {
        // Listen to configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('echoAI.cli')) {
                this.maxLogs = this.configManager.get<number>('cli.maxLogEntries', 1000);
                if (this.panel) {
                    this.panel.webview.postMessage({
                        command: 'configChanged',
                        config: this.getClientConfig()
                    });
                }
            }
        });
    }

    private setupWebviewMessageHandling(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'executeCommand':
                        await this.executeCommand(message.text);
                        break;
                    case 'getHistory':
                        this.sendCommandHistory();
                        break;
                    case 'clearLogs':
                        this.clearLogs();
                        break;
                    case 'exportLogs':
                        await this.exportLogs();
                        break;
                }
            } catch (error) {
                this.log('error', `Command execution error: ${error}`);
            }
        });
    }

    private async executeCommand(input: string): Promise<void> {
        if (this.isProcessing) {
            this.log('warning', 'Please wait for current command to complete');
            return;
        }

        const command = input.trim();
        if (!command) return;

        // Add to history
        if (this.commandHistory[this.commandHistory.length - 1] !== command) {
            this.commandHistory.push(command);
            if (this.commandHistory.length > 100) {
                this.commandHistory = this.commandHistory.slice(-100);
            }
        }
        this.historyIndex = -1;

        this.log('info', `> ${command}`, command);
        this.isProcessing = true;

        try {
            if (command.startsWith('/')) {
                await this.executeSystemCommand(command);
            } else {
                await this.executeAICommand(command);
            }
        } catch (error) {
            this.log('error', `Error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private async executeSystemCommand(command: string): Promise<void> {
        const cmd = command.toLowerCase();
        const args = command.split(' ').slice(1);

        switch (cmd.split(' ')[0]) {
            case '/help':
                this.showHelp();
                break;
            case '/clear':
                this.clearLogs();
                break;
            case '/status':
                await this.showStatus();
                break;
            case '/config':
                await this.showConfig(args[0]);
                break;
            case '/providers':
                await this.listProviders();
                break;
            case '/model':
                await this.changeModel(args[0]);
                break;
            case '/analyze':
                await this.analyzeCurrentFile();
                break;
            case '/refactor':
                await this.quickRefactor();
                break;
            case '/security':
                await this.securityScan();
                break;
            case '/performance':
                await this.showPerformanceInfo();
                break;
            case '/export':
                await this.exportLogs();
                break;
            default:
                this.log('error', `Unknown command: ${cmd.split(' ')[0]}. Type /help for available commands.`);
        }
    }

    private async executeAICommand(command: string): Promise<void> {
        this.log('info', 'Processing AI request...');
        
        const editor = vscode.window.activeTextEditor;
        const context = editor ? editor.document.getText(editor.selection) : '';
        const languageId = editor?.document.languageId || 'plaintext';

        try {
            const response = await this.echoProvider.getCompletion(
                command,
                context,
                languageId,
                2000
            );

            this.log('success', response, command, context ? `Context: ${context.substring(0, 100)}...` : undefined);
        } catch (error) {
            this.log('error', `AI request failed: ${error}`);
        }
    }

    private showHelp(): void {
        const helpText = `
Echo AI CLI Commands:

System Commands:
/help          - Show this help message
/clear         - Clear the log history
/status        - Show extension status
/config [key]  - Show configuration (optional key filter)
/providers     - List available AI providers
/model <name>  - Change AI model
/analyze       - Analyze current file
/refactor      - Quick refactor current selection
/security      - Run security scan
/performance   - Show performance metrics
/export        - Export logs to file

AI Commands:
Type any question or request directly to interact with Echo AI.
Examples:
- Explain this code
- Optimize this function
- Find bugs in this file
- Generate unit tests
- Review code quality

Navigation:
- Use ↑/↓ arrow keys for command history
- Ctrl+C to clear current input
- Ctrl+L to clear logs
        `.trim();

        this.log('info', helpText);
    }

    private async showStatus(): Promise<void> {
        const provider = this.configManager.get<string>('provider', 'claude');
        const model = this.configManager.get<string>('model', 'claude-3-5-sonnet-20241022');
        const memUsage = process.memoryUsage();
        
        const statusInfo = `
Echo AI Status:
├─ Provider: ${provider}
├─ Model: ${model}
├─ Memory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB
├─ Log Entries: ${this.logs.length}/${this.maxLogs}
└─ Status: ${this.isProcessing ? 'Processing' : 'Ready'}
        `.trim();

        this.log('info', statusInfo);
    }

    private async showConfig(key?: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('echoAI');
        const allSettings = JSON.stringify(config, null, 2);
        
        if (key) {
            const value = config.get(key);
            this.log('info', `${key}: ${JSON.stringify(value, null, 2)}`);
        } else {
            this.log('info', `Configuration:\n${allSettings}`);
        }
    }

    private async listProviders(): Promise<void> {
        const providers = ['claude', 'openai', 'groq', 'openrouter', 'gemini', 'meta'];
        const current = this.configManager.get<string>('provider', 'claude');
        
        const providerList = providers.map(p => 
            p === current ? `● ${p} (current)` : `○ ${p}`
        ).join('\n');
        
        this.log('info', `Available Providers:\n${providerList}`);
    }

    private async changeModel(modelName: string): Promise<void> {
        if (!modelName) {
            this.log('error', 'Please specify a model name. Usage: /model <model-name>');
            return;
        }

        const config = vscode.workspace.getConfiguration('echoAI');
        await config.update('model', modelName, vscode.ConfigurationTarget.Global);
        this.log('success', `Model changed to: ${modelName}`);
    }

    private async analyzeCurrentFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.log('error', 'No active editor found');
            return;
        }

        this.log('info', 'Analyzing current file...');
        
        try {
            await vscode.commands.executeCommand('echo-ai.forceAnalysis');
            this.log('success', 'File analysis completed');
        } catch (error) {
            this.log('error', `Analysis failed: ${error}`);
        }
    }

    private async quickRefactor(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            this.log('error', 'Please select code to refactor');
            return;
        }

        this.log('info', 'Refactoring selected code...');
        
        try {
            await vscode.commands.executeCommand('echo-ai.refactor');
            this.log('success', 'Code refactored successfully');
        } catch (error) {
            this.log('error', `Refactoring failed: ${error}`);
        }
    }

    private async securityScan(): Promise<void> {
        this.log('info', 'Running security scan...');
        
        try {
            await vscode.commands.executeCommand('echo-ai.quickSecurityScan');
            this.log('success', 'Security scan completed');
        } catch (error) {
            this.log('error', `Security scan failed: ${error}`);
        }
    }

    private async showPerformanceInfo(): Promise<void> {
        const memUsage = process.memoryUsage();
        const performanceInfo = `
Performance Metrics:
├─ Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB
├─ Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB
├─ External: ${Math.round(memUsage.external / 1024 / 1024)}MB
├─ RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB
└─ Uptime: ${Math.round(process.uptime())}s

Tip: Use /clear to free up log memory
        `.trim();

        this.log('info', performanceInfo);
    }

    private async exportLogs(): Promise<void> {
        const logsJson = JSON.stringify(this.logs, null, 2);
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `echo-ai-logs-${timestamp}.json`;

        try {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(filename),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(logsJson));
                this.log('success', `Logs exported to: ${uri.fsPath}`);
            }
        } catch (error) {
            this.log('error', `Export failed: ${error}`);
        }
    }

    private sendLogsToWebview(): void {
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'initLogs',
                logs: this.logs,
                config: this.getClientConfig()
            });
        }
    }

    private sendCommandHistory(): void {
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'commandHistory',
                history: this.commandHistory
            });
        }
    }

    private getClientConfig() {
        return {
            theme: this.configManager.get<string>('cli.theme', 'dark'),
            showLogs: this.configManager.get<boolean>('cli.showLogs', true),
            maxLogEntries: this.configManager.get<number>('cli.maxLogEntries', 1000)
        };
    }

    private getCLIWebviewContent(): string {
        const theme = this.configManager.get<string>('cli.theme', 'dark');
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Echo AI CLI</title>
    <style>
        :root {
            --bg-color: ${theme === 'dark' ? 'var(--vscode-editor-background)' : 'var(--vscode-editor-background)'};
            --text-color: ${theme === 'dark' ? 'var(--vscode-foreground)' : 'var(--vscode-foreground)'};
            --border-color: var(--vscode-panel-border);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --success-color: var(--vscode-testing-iconPassed);
            --error-color: var(--vscode-errorForeground);
            --warning-color: var(--vscode-warningForeground);
            --info-color: var(--vscode-charts-blue);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background: var(--bg-color);
            color: var(--text-color);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .header {
            padding: 10px 15px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }

        .title {
            font-weight: bold;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .controls {
            display: flex;
            gap: 10px;
        }

        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .logs-container {
            flex: 1;
            overflow-y: auto;
            padding: 10px 15px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .log-entry {
            margin-bottom: 8px;
            padding: 4px 0;
            border-left: 3px solid transparent;
            padding-left: 8px;
        }

        .log-entry.info {
            border-left-color: var(--info-color);
        }

        .log-entry.success {
            border-left-color: var(--success-color);
        }

        .log-entry.warning {
            border-left-color: var(--warning-color);
        }

        .log-entry.error {
            border-left-color: var(--error-color);
        }

        .log-timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-right: 8px;
        }

        .log-level {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
            margin-right: 8px;
            padding: 1px 4px;
            border-radius: 2px;
        }

        .log-level.info { background: var(--info-color); color: white; }
        .log-level.success { background: var(--success-color); color: white; }
        .log-level.warning { background: var(--warning-color); color: white; }
        .log-level.error { background: var(--error-color); color: white; }

        .log-message {
            white-space: pre-wrap;
            word-break: break-word;
        }

        .log-context {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-top: 2px;
            font-style: italic;
        }

        .input-container {
            padding: 10px 15px;
            border-top: 1px solid var(--border-color);
            background: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }

        .input-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .prompt {
            color: var(--success-color);
            font-weight: bold;
            font-family: var(--vscode-editor-font-family);
        }

        .input {
            flex: 1;
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-color);
            padding: 6px 10px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            outline: none;
        }

        .input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .processing {
            opacity: 0.7;
        }

        .welcome {
            text-align: center;
            margin: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome h3 {
            margin-bottom: 10px;
            color: var(--text-color);
        }

        .scrollbar::-webkit-scrollbar {
            width: 8px;
        }

        .scrollbar::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        .scrollbar::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }

        .scrollbar::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span>🚀</span>
            Echo AI CLI
            <span class="status" id="status">Ready</span>
        </div>
        <div class="controls">
            <button class="btn" onclick="clearLogs()">Clear</button>
            <button class="btn" onclick="exportLogs()">Export</button>
            <button class="btn" onclick="showHelp()">Help</button>
        </div>
    </div>

    <div class="logs-container scrollbar" id="logs">
        <div class="welcome">
            <h3>🤖 Welcome to Echo AI CLI</h3>
            <p>Type <code>/help</code> for available commands or start chatting with AI directly!</p>
        </div>
    </div>

    <div class="input-container">
        <div class="input-wrapper">
            <span class="prompt">></span>
            <input type="text" class="input" id="commandInput" placeholder="Type a command or ask AI anything..." autocomplete="off" spellcheck="false">
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let commandHistory = [];
        let historyIndex = -1;
        let isProcessing = false;

        const statusEl = document.getElementById('status');
        const logsEl = document.getElementById('logs');
        const inputEl = document.getElementById('commandInput');

        // Focus input on load
        inputEl.focus();

        // Handle input events
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                executeCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateHistory(1);
            } else if (e.ctrlKey && e.key === 'c') {
                inputEl.value = '';
            } else if (e.ctrlKey && e.key === 'l') {
                clearLogs();
            }
        });

        function executeCommand() {
            if (isProcessing) return;
            
            const command = inputEl.value.trim();
            if (!command) return;

            commandHistory.push(command);
            if (commandHistory.length > 100) {
                commandHistory = commandHistory.slice(-100);
            }
            historyIndex = -1;

            vscode.postMessage({
                command: 'executeCommand',
                text: command
            });

            inputEl.value = '';
            setProcessing(true);
        }

        function navigateHistory(direction) {
            if (commandHistory.length === 0) return;

            if (direction === -1) {
                if (historyIndex === -1) {
                    historyIndex = commandHistory.length - 1;
                } else if (historyIndex > 0) {
                    historyIndex--;
                }
            } else {
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                } else {
                    historyIndex = -1;
                    inputEl.value = '';
                    return;
                }
            }

            if (historyIndex >= 0 && historyIndex < commandHistory.length) {
                inputEl.value = commandHistory[historyIndex];
            }
        }

        function setProcessing(processing) {
            isProcessing = processing;
            statusEl.textContent = processing ? 'Processing...' : 'Ready';
            inputEl.disabled = processing;
            if (processing) {
                document.body.classList.add('processing');
            } else {
                document.body.classList.remove('processing');
                inputEl.focus();
            }
        }

        function addLogEntry(log) {
            const entry = document.createElement('div');
            entry.className = \`log-entry \${log.level}\`;
            
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            
            let html = \`
                <span class="log-timestamp">\${timestamp}</span>
                <span class="log-level \${log.level}">\${log.level}</span>
                <div class="log-message">\${escapeHtml(log.message)}</div>
            \`;
            
            if (log.context) {
                html += \`<div class="log-context">Context: \${escapeHtml(log.context)}</div>\`;
            }
            
            entry.innerHTML = html;
            logsEl.appendChild(entry);
            
            // Auto scroll to bottom
            logsEl.scrollTop = logsEl.scrollHeight;
            
            // Remove welcome message if it exists
            const welcome = logsEl.querySelector('.welcome');
            if (welcome) {
                welcome.remove();
            }
        }

        function clearLogs() {
            logsEl.innerHTML = '';
            vscode.postMessage({ command: 'clearLogs' });
        }

        function exportLogs() {
            vscode.postMessage({ command: 'exportLogs' });
        }

        function showHelp() {
            inputEl.value = '/help';
            executeCommand();
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'newLog':
                    addLogEntry(message.log);
                    setProcessing(false);
                    break;
                    
                case 'initLogs':
                    logsEl.innerHTML = '';
                    message.logs.forEach(log => addLogEntry(log));
                    break;
                    
                case 'clearLogs':
                    logsEl.innerHTML = \`
                        <div class="welcome">
                            <h3>🤖 Welcome to Echo AI CLI</h3>
                            <p>Type <code>/help</code> for available commands or start chatting with AI directly!</p>
                        </div>
                    \`;
                    break;
                    
                case 'commandHistory':
                    commandHistory = message.history || [];
                    break;
                    
                case 'configChanged':
                    // Handle config changes if needed
                    break;
            }
        });

        // Request initial data
        vscode.postMessage({ command: 'getHistory' });
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}