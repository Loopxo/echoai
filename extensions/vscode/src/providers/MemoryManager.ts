import * as vscode from 'vscode';

export interface ConversationEntry {
    id: string;
    timestamp: Date;
    type: 'user' | 'assistant' | 'system';
    content: string;
    context?: any;
    metadata?: any;
}

export class MemoryManager {
    private currentSession: any;
    private globalMemory: any;

    constructor(private context: vscode.ExtensionContext) {
        this.currentSession = this.createNewSession();
        this.globalMemory = {
            user_preferences: [],
            learned_patterns: [],
            code_patterns: [],
            project_insights: new Map()
        };

        this.loadMemoryFromStorage();
    }

    private createNewSession(): any {
        return {
            session_id: this.generateSessionId(),
            started: new Date(),
            conversations: [],
            learned_patterns: [],
            user_preferences: [],
            code_patterns: [],
            project_insights: [],
            context_switches: []
        };
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    private async loadMemoryFromStorage(): Promise<void> {
        try {
            const preferences = this.context.globalState.get<any[]>('echo.memory.preferences', []);
            this.globalMemory.user_preferences = preferences;

            const patterns = this.context.globalState.get<any[]>('echo.memory.patterns', []);
            this.globalMemory.learned_patterns = patterns;
        } catch (error) {
            console.error('Error loading memory from storage:', error);
        }
    }

    private async saveMemoryToStorage(): Promise<void> {
        try {
            await this.context.globalState.update('echo.memory.preferences', this.globalMemory.user_preferences);
            await this.context.globalState.update('echo.memory.patterns', this.globalMemory.learned_patterns);
        } catch (error) {
            console.error('Error saving memory to storage:', error);
        }
    }

    addConversation(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void {
        const conversationEntry: ConversationEntry = {
            ...entry,
            id: this.generateEntryId(),
            timestamp: new Date()
        };

        this.currentSession.conversations.push(conversationEntry);
    }

    private generateEntryId(): string {
        return `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    buildContextualPrompt(basePrompt: string, currentContext: any): string {
        return basePrompt + '\n\n[Enhanced with user context and preferences]';
    }

    getMemoryStats(): any {
        return {
            conversations: this.currentSession.conversations.length,
            patterns: this.globalMemory.learned_patterns.length,
            preferences: this.globalMemory.user_preferences.length,
            codePatterns: this.globalMemory.code_patterns.length,
            projectInsights: 0
        };
    }

    dispose(): void {
        this.saveMemoryToStorage();
    }
}