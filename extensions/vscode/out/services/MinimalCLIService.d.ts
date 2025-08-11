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
export declare class MinimalCLIService {
    private context;
    private echoProvider;
    private configManager;
    private static instance;
    private panel;
    private logs;
    private maxLogs;
    private isProcessing;
    constructor(context: vscode.ExtensionContext, echoProvider: EchoAIProvider, configManager: ConfigurationManager);
    static getInstance(context: vscode.ExtensionContext, echoProvider: EchoAIProvider, configManager: ConfigurationManager): MinimalCLIService;
    showCLI(): void;
    log(level: MinimalLogEntry['level'], message: string): void;
    private setupMessageHandling;
    private executeCommand;
    private handleSystemCommand;
    private handleAICommand;
    private clearLogs;
    private updateStatus;
    private getMinimalWebviewContent;
    dispose(): void;
}
export {};
//# sourceMappingURL=MinimalCLIService.d.ts.map