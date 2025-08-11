import * as vscode from 'vscode';
export interface ConversationEntry {
    id: string;
    timestamp: Date;
    type: 'user' | 'assistant' | 'system';
    content: string;
    context?: any;
    metadata?: any;
}
export declare class MemoryManager {
    private context;
    private currentSession;
    private globalMemory;
    constructor(context: vscode.ExtensionContext);
    private createNewSession;
    private generateSessionId;
    private loadMemoryFromStorage;
    private saveMemoryToStorage;
    addConversation(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void;
    private generateEntryId;
    buildContextualPrompt(basePrompt: string, currentContext: any): string;
    getMemoryStats(): any;
    dispose(): void;
}
//# sourceMappingURL=MemoryManager.d.ts.map