import * as vscode from 'vscode';
import { EchoAIProvider } from './EchoAIProvider';
export declare class ErrorDetectionProvider {
    private echoProvider;
    private analysisCache;
    private readonly CACHE_DURATION;
    private analysisQueue;
    constructor(echoProvider: EchoAIProvider);
    provideDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]>;
    private analyzeDocument;
    private cleanupCache;
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): Promise<vscode.CodeAction[]>;
    private getLanguageSpecificPatterns;
    private getSuggestionForError;
}
//# sourceMappingURL=ErrorDetectionProvider.d.ts.map