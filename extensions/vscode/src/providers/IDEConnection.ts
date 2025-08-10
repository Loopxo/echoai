import * as vscode from 'vscode';
import * as WebSocket from 'ws';

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
        cursor?: { line: number; character: number };
        selection?: { start: { line: number; character: number }, end: { line: number; character: number } };
    }>;
    activeFile?: string;
    workspaceRoot: string;
    gitBranch?: string;
    recentChanges?: Array<{ file: string; timestamp: number }>;
}

export class IDEConnection extends vscode.EventEmitter {
    private ws: WebSocket | null = null;
    private connectionId: string | null = null;
    private reconnectAttempts = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pendingRequests = new Map<string, (response: any) => void>();
    private options: IDEConnectionOptions;
    private isConnected = false;

    constructor(options: Partial<IDEConnectionOptions> = {}) {
        super();
        this.options = {
            serverPort: 8765,
            reconnectDelay: 3000,
            maxReconnectAttempts: 5,
            enableStreaming: true,
            ...options
        };
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const serverUrl = `ws://localhost:${this.options.serverPort}`;
                this.ws = new WebSocket(serverUrl);

                this.ws.on('open', () => {
                    console.log('Echo IDE Connection established');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = null;
                    }
                    this.emit('connected');
                    resolve();
                });

                this.ws.on('message', (data: WebSocket.Data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Error parsing IDE server message:', error);
                    }
                });

                this.ws.on('close', () => {
                    console.log('Echo IDE Connection closed');
                    this.isConnected = false;
                    this.connectionId = null;
                    this.emit('disconnected');
                    this.scheduleReconnect();
                });

                this.ws.on('error', (error) => {
                    console.error('Echo IDE Connection error:', error);
                    this.emit('error', error);
                    if (!this.isConnected) {
                        reject(error);
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    private handleMessage(message: any) {
        switch (message.type) {
            case 'connected':
                this.connectionId = message.connectionId;
                console.log('IDE Server capabilities:', message.capabilities);
                break;

            case 'completion':
            case 'chat_response':
            case 'refactor_response':
            case 'explanation':
            case 'optimization':
                const callback = this.pendingRequests.get(message.id);
                if (callback) {
                    callback(message);
                    this.pendingRequests.delete(message.id);
                }
                break;

            case 'error':
                console.error('IDE Server error:', message.message, message.error);
                const errorCallback = this.pendingRequests.get(message.id || 'unknown');
                if (errorCallback) {
                    errorCallback({ error: message.message });
                    this.pendingRequests.delete(message.id || 'unknown');
                }
                break;

            case 'partial':
                this.emit('partialResponse', message);
                break;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                console.error('Reconnection failed:', error);
            }
        }, delay);
    }

    async requestCompletion(context: IDEContext, prompt?: string, options?: any): Promise<any> {
        return this.sendRequest({
            type: 'completion',
            context,
            prompt,
            options
        });
    }

    async requestChat(context: IDEContext, message: string, options?: any): Promise<any> {
        return this.sendRequest({
            type: 'chat',
            context,
            message,
            options
        });
    }

    async requestRefactor(context: IDEContext, code: string, task?: string): Promise<any> {
        return this.sendRequest({
            type: 'refactor',
            context,
            code,
            task
        });
    }

    async requestExplanation(context: IDEContext, code: string, language?: string): Promise<any> {
        return this.sendRequest({
            type: 'explain',
            context,
            code,
            language
        });
    }

    async requestOptimization(context: IDEContext, code: string, focus?: string): Promise<any> {
        return this.sendRequest({
            type: 'optimize',
            context,
            code,
            focus
        });
    }

    private async sendRequest(request: Partial<CompletionRequest>): Promise<any> {
        if (!this.isConnected || !this.ws) {
            throw new Error('IDE Connection not established');
        }

        const requestId = this.generateRequestId();
        const fullRequest: CompletionRequest = {
            id: requestId,
            ...request
        } as CompletionRequest;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });

            // Set timeout for request
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000); // 30 second timeout

            this.ws!.send(JSON.stringify(fullRequest));
        });
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    buildCurrentContext(): IDEContext {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
        
        const editor = vscode.window.activeTextEditor;
        const files: IDEContext['files'] = [];

        if (editor) {
            const cursor = editor.selection.active;
            const selection = !editor.selection.isEmpty ? {
                start: { line: editor.selection.start.line, character: editor.selection.start.character },
                end: { line: editor.selection.end.line, character: editor.selection.end.character }
            } : undefined;

            files.push({
                uri: editor.document.uri.toString(),
                content: editor.document.getText(),
                language: editor.document.languageId,
                cursor: { line: cursor.line, character: cursor.character },
                selection
            });
        }

        // Add recently opened files for better context
        const recentFiles = vscode.workspace.textDocuments
            .filter(doc => doc.uri.scheme === 'file' && doc.uri !== editor?.document.uri)
            .slice(0, 3) // Limit to 3 recent files for context
            .map(doc => ({
                uri: doc.uri.toString(),
                content: doc.getText(),
                language: doc.languageId
            }));

        files.push(...recentFiles);

        return {
            files,
            activeFile: editor?.document.uri.toString(),
            workspaceRoot,
            gitBranch: this.getCurrentGitBranch(),
            recentChanges: this.getRecentChanges()
        };
    }

    private getCurrentGitBranch(): string | undefined {
        // Implementation would use git extension API or execute git commands
        return undefined;
    }

    private getRecentChanges(): Array<{ file: string; timestamp: number }> {
        // Implementation would track recent file changes
        return [];
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.isConnected = false;
            this.ws.close();
            this.ws = null;
        }

        this.pendingRequests.clear();
        this.connectionId = null;
        this.reconnectAttempts = 0;
    }

    getConnectionStatus(): { connected: boolean; connectionId: string | null } {
        return {
            connected: this.isConnected,
            connectionId: this.connectionId
        };
    }
}