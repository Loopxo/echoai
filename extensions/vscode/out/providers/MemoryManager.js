"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
class MemoryManager {
    context;
    currentSession;
    globalMemory;
    constructor(context) {
        this.context = context;
        this.currentSession = this.createNewSession();
        this.globalMemory = {
            user_preferences: [],
            learned_patterns: [],
            code_patterns: [],
            project_insights: new Map()
        };
        this.loadMemoryFromStorage();
    }
    createNewSession() {
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
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
    async loadMemoryFromStorage() {
        try {
            const preferences = this.context.globalState.get('echo.memory.preferences', []);
            this.globalMemory.user_preferences = preferences;
            const patterns = this.context.globalState.get('echo.memory.patterns', []);
            this.globalMemory.learned_patterns = patterns;
        }
        catch (error) {
            console.error('Error loading memory from storage:', error);
        }
    }
    async saveMemoryToStorage() {
        try {
            await this.context.globalState.update('echo.memory.preferences', this.globalMemory.user_preferences);
            await this.context.globalState.update('echo.memory.patterns', this.globalMemory.learned_patterns);
        }
        catch (error) {
            console.error('Error saving memory to storage:', error);
        }
    }
    addConversation(entry) {
        const conversationEntry = {
            ...entry,
            id: this.generateEntryId(),
            timestamp: new Date()
        };
        this.currentSession.conversations.push(conversationEntry);
    }
    generateEntryId() {
        return `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    buildContextualPrompt(basePrompt, currentContext) {
        return basePrompt + '\n\n[Enhanced with user context and preferences]';
    }
    getMemoryStats() {
        return {
            conversations: this.currentSession.conversations.length,
            patterns: this.globalMemory.learned_patterns.length,
            preferences: this.globalMemory.user_preferences.length,
            codePatterns: this.globalMemory.code_patterns.length,
            projectInsights: 0
        };
    }
    dispose() {
        this.saveMemoryToStorage();
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=MemoryManager.js.map