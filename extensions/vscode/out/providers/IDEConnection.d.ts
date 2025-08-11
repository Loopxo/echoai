import * as vscode from 'vscode';
export interface IDEConnectionOptions {
    serverPort: number;
    reconnectDelay: number;
    maxReconnectAttempts: number;
    enableStreaming: boolean;
}
export interface CompletionRequest {
    id: string;
    type: 'completion' | 'chat' | 'refactor' | 'explain' | 'optimize';
    context: IDEContext;
    prompt?: string;
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        includeContext?: boolean;
    };
}
export interface IDEContext {
    files: Array<{
        uri: string;
        content: string;
        language: string;
        cursor?: {
            line: number;
            character: number;
        };
        selection?: {
            start: {
                line: number;
                character: number;
            };
            end: {
                line: number;
                character: number;
            };
        };
    }>;
    activeFile?: string;
    workspaceRoot: string;
    gitBranch?: string;
    recentChanges?: Array<{
        file: string;
        timestamp: number;
    }>;
}
export declare class IDEConnection extends vscode.EventEmitter {
    private ws;
    private connectionId;
    private reconnectAttempts;
    private reconnectTimer;
    private pendingRequests;
    private options;
    private isConnected;
    constructor(options?: Partial<IDEConnectionOptions>);
    connect(): Promise<void>;
    private handleMessage;
    private scheduleReconnect;
    requestCompletion(context: IDEContext, prompt?: string, options?: any): Promise<any>;
    requestChat(context: IDEContext, message: string, options?: any): Promise<any>;
    requestRefactor(context: IDEContext, code: string, task?: string): Promise<any>;
    requestExplanation(context: IDEContext, code: string, language?: string): Promise<any>;
    requestOptimization(context: IDEContext, code: string, focus?: string): Promise<any>;
    private sendRequest;
    private generateRequestId;
    buildCurrentContext(): IDEContext;
    private getCurrentGitBranch;
    private getRecentChanges;
    disconnect(): void;
    getConnectionStatus(): {
        connected: boolean;
        connectionId: string | null;
    };
}
//# sourceMappingURL=IDEConnection.d.ts.map