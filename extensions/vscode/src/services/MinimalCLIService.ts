import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { ConfigurationManager } from '../utils/ConfigurationManager';

interface MinimalLogEntry {
    timestamp: Date;
    level: 'info' | 'error' | 'success';
    message: string;
}

/**
 * Minimal CLI service optimized for performance
 * Inspired by groq CLI - fast, lightweight, focused
 */
export class MinimalCLIService {
    private static instance: MinimalCLIService;
    private panel: vscode.WebviewPanel | undefined;
    private logs: MinimalLogEntry[] = [];
    private maxLogs = 50; // Much smaller log buffer
    private isProcessing = false;

    constructor(
        private context: vscode.ExtensionContext,
        private echoProvider: EchoAIProvider,
        private configManager: ConfigurationManager
    ) {}

    public static getInstance(
        context: vscode.ExtensionContext, 
        echoProvider: EchoAIProvider, 
        configManager: ConfigurationManager
    ): MinimalCLIService {
        if (!MinimalCLIService.instance) {
            MinimalCLIService.instance = new MinimalCLIService(context, echoProvider, configManager);
        }
        return MinimalCLIService.instance;
    }

    public showCLI(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'echo-ai-minimal-cli',
            'Echo AI',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: false // Don't retain - save memory
            }
        );

        this.panel.webview.html = this.getMinimalWebviewContent();
        this.setupMessageHandling();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.logs = []; // Clear logs when closed to save memory
        });

        this.log('info', 'Echo AI Ready');
    }

    public log(level: MinimalLogEntry['level'], message: string): void {
        const entry: MinimalLogEntry = {
            timestamp: new Date(),
            level,
            message
        };

        this.logs.push(entry);

        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Send to webview if open
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'log',
                entry
            });
        }
    }

    private setupMessageHandling(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'execute' && !this.isProcessing) {
                await this.executeCommand(message.text);
            }
        });
    }

    private async executeCommand(input: string): Promise<void> {
        const command = input.trim();
        if (!command) return;

        this.isProcessing = true;
        this.updateStatus('processing');

        try {
            // Simple command routing
            if (command.startsWith('/')) {
                await this.handleSystemCommand(command);
            } else {
                await this.handleAICommand(command);
            }
        } catch (error) {
            this.log('error', `Error: ${error}`);
        } finally {
            this.isProcessing = false;
            this.updateStatus('ready');
        }
    }

    private async handleSystemCommand(command: string): Promise<void> {
        const [cmd] = command.toLowerCase().split(' ');

        switch (cmd) {
            case '/help':
                this.log('info', 'Commands: /help /clear /status /analyze /fix\nOr just type any question for AI');
                break;
            case '/clear':
                this.clearLogs();
                break;
            case '/status':
                const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                this.log('info', `Memory: ${mem}MB | Provider: ${this.configManager.get('provider', 'claude')}`);
                break;
            case '/analyze':
                await vscode.commands.executeCommand('echo-ai.forceAnalysis');
                this.log('success', 'Analysis completed');
                break;
            case '/fix':
                await vscode.commands.executeCommand('echo-ai.fixErrors');
                this.log('success', 'Fix attempted');
                break;
            default:
                this.log('error', `Unknown command: ${cmd}`);
        }
    }

    private async handleAICommand(command: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        const context = editor?.selection.isEmpty ? '' : editor.document.getText(editor.selection);
        
        try {
            const response = await this.echoProvider.getCompletion(
                command,
                context,
                editor?.document.languageId || 'plaintext',
                1000 // Shorter responses for CLI
            );

            // Truncate very long responses
            const truncated = response.length > 500 
                ? response.substring(0, 500) + '...' 
                : response;

            this.log('success', truncated);
        } catch (error) {
            this.log('error', `AI request failed: ${error}`);
        }
    }

    private clearLogs(): void {
        this.logs = [];
        if (this.panel) {
            this.panel.webview.postMessage({ command: 'clear' });
        }
    }

    private updateStatus(status: 'ready' | 'processing'): void {
        if (this.panel) {
            this.panel.webview.postMessage({ command: 'status', status });
        }
    }

    private getMinimalWebviewContent(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Echo AI</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
            font-size: 13px;
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }
        .title { font-weight: 600; color: var(--vscode-foreground); }
        .status { 
            font-size: 11px; 
            color: var(--vscode-descriptionForeground); 
            text-transform: uppercase;
        }
        .output {
            flex: 1;
            padding: 8px 12px;
            overflow-y: auto;
            font-size: 12px;
            line-height: 1.4;
        }
        .log-entry {
            margin-bottom: 4px;
            padding: 2px 0;
        }
        .log-time {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            margin-right: 6px;
        }
        .log-info { color: var(--vscode-foreground); }
        .log-success { color: var(--vscode-testing-iconPassed); }
        .log-error { color: var(--vscode-errorForeground); }
        .input-container {
            padding: 8px 12px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }
        .input-wrapper {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .prompt { 
            color: var(--vscode-testing-iconPassed); 
            font-weight: 600;
        }
        .input {
            flex: 1;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-foreground);
            padding: 4px 8px;
            border-radius: 2px;
            font-family: inherit;
            font-size: 12px;
            outline: none;
        }
        .input:focus { border-color: var(--vscode-focusBorder); }
        .processing { opacity: 0.6; }
        .welcome {
            text-align: center;
            margin: 20px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🚀 Echo AI</div>
        <div class="status" id="status">Ready</div>
    </div>
    
    <div class="output" id="output">
        <div class="welcome">
            <p>Type /help for commands or ask AI anything directly</p>
        </div>
    </div>
    
    <div class="input-container">
        <div class="input-wrapper">
            <span class="prompt">></span>
            <input type="text" class="input" id="input" placeholder="Enter command or question..." autocomplete="off">
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const output = document.getElementById('output');
        const input = document.getElementById('input');
        const status = document.getElementById('status');

        input.focus();

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const text = input.value.trim();
                if (text && !input.disabled) {
                    vscode.postMessage({ command: 'execute', text });
                    input.value = '';
                }
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'log':
                    addLogEntry(message.entry);
                    break;
                case 'clear':
                    output.innerHTML = '';
                    break;
                case 'status':
                    status.textContent = message.status === 'processing' ? 'Processing...' : 'Ready';
                    input.disabled = message.status === 'processing';
                    document.body.className = message.status === 'processing' ? 'processing' : '';
                    if (message.status === 'ready') input.focus();
                    break;
            }
        });

        function addLogEntry(entry) {
            const div = document.createElement('div');
            div.className = \`log-entry log-\${entry.level}\`;
            
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            div.innerHTML = \`<span class="log-time">\${time}</span>\${entry.message}\`;
            output.appendChild(div);
            output.scrollTop = output.scrollHeight;
            
            // Remove welcome message
            const welcome = output.querySelector('.welcome');
            if (welcome) welcome.remove();
        }
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.logs = [];
    }
}