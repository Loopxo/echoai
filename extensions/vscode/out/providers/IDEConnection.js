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
exports.IDEConnection = void 0;
const vscode = __importStar(require("vscode"));
const WebSocket = __importStar(require("ws"));
class IDEConnection extends vscode.EventEmitter {
    ws = null;
    connectionId = null;
    reconnectAttempts = 0;
    reconnectTimer = null;
    pendingRequests = new Map();
    options;
    isConnected = false;
    constructor(options = {}) {
        super();
        this.options = {
            serverPort: 8765,
            reconnectDelay: 3000,
            maxReconnectAttempts: 5,
            enableStreaming: true,
            ...options
        };
    }
    async connect() {
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
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    }
                    catch (error) {
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    handleMessage(message) {
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
    scheduleReconnect() {
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
            }
            catch (error) {
                console.error('Reconnection failed:', error);
            }
        }, delay);
    }
    async requestCompletion(context, prompt, options) {
        return this.sendRequest({
            type: 'completion',
            context,
            prompt,
            options
        });
    }
    async requestChat(context, message, options) {
        return this.sendRequest({
            type: 'chat',
            context,
            message,
            options
        });
    }
    async requestRefactor(context, code, task) {
        return this.sendRequest({
            type: 'refactor',
            context,
            code,
            task
        });
    }
    async requestExplanation(context, code, language) {
        return this.sendRequest({
            type: 'explain',
            context,
            code,
            language
        });
    }
    async requestOptimization(context, code, focus) {
        return this.sendRequest({
            type: 'optimize',
            context,
            code,
            focus
        });
    }
    async sendRequest(request) {
        if (!this.isConnected || !this.ws) {
            throw new Error('IDE Connection not established');
        }
        const requestId = this.generateRequestId();
        const fullRequest = {
            id: requestId,
            ...request
        };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                }
                else {
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
            this.ws.send(JSON.stringify(fullRequest));
        });
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
    buildCurrentContext() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
        const editor = vscode.window.activeTextEditor;
        const files = [];
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
    getCurrentGitBranch() {
        // Implementation would use git extension API or execute git commands
        return undefined;
    }
    getRecentChanges() {
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
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            connectionId: this.connectionId
        };
    }
}
exports.IDEConnection = IDEConnection;
//# sourceMappingURL=IDEConnection.js.map