import * as vscode from 'vscode';
import { ConfigurationManager } from '../utils/ConfigurationManager';
export interface AIResponse {
    content: string;
    provider: string;
    model: string;
    tokensUsed?: number;
}
export declare class EchoAIProvider {
    private configManager;
    private providers;
    constructor(configManager: ConfigurationManager);
    private initializeProviders;
    getCompletion(prompt: string, context: string, language: string, maxTokens?: number): Promise<string>;
    explainCode(code: string, language: string): Promise<string>;
    refactorCode(code: string, language: string): Promise<string>;
    generateTests(functions: any[], language: string): Promise<string>;
    fixErrors(code: string, diagnostics: vscode.Diagnostic[], language: string): Promise<string>;
    detectSyntaxErrors(code: string, language: string): Promise<Array<{
        line: number;
        message: string;
        severity: 'error' | 'warning';
    }>>;
    private buildCompletionPrompt;
    private getApiKey;
    private getClaudeCompletion;
    private getOpenAICompletion;
    private getGroqCompletion;
}
//# sourceMappingURL=EchoAIProvider.d.ts.map