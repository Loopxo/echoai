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
export declare class CLIService {
    private context;
    private echoProvider;
    private configManager;
    private static instance;
    private panel;
    private logs;
    private maxLogs;
    private isProcessing;
    private commandHistory;
    private historyIndex;
    constructor(context: vscode.ExtensionContext, echoProvider: EchoAIProvider, configManager: ConfigurationManager);
    static getInstance(context: vscode.ExtensionContext, echoProvider: EchoAIProvider, configManager: ConfigurationManager): CLIService;
    showCLI(): void;
    log(level: CLILogEntry['level'], message: string, command?: string, context?: string): void;
    clearLogs(): void;
    private setupEventListeners;
    private setupWebviewMessageHandling;
    private executeCommand;
    private executeSystemCommand;
    private executeAICommand;
    private showHelp;
    private showStatus;
    private showConfig;
    private listProviders;
    private changeModel;
    private analyzeCurrentFile;
    private quickRefactor;
    private securityScan;
    private showPerformanceInfo;
    private exportLogs;
    private sendLogsToWebview;
    private sendCommandHistory;
    private getClientConfig;
    private getCLIWebviewContent;
    dispose(): void;
}
//# sourceMappingURL=CLIService.d.ts.map