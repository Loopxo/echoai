import * as vscode from 'vscode';
import { EchoAIProvider } from './EchoAIProvider';
export declare class CompletionProvider {
    private echoProvider;
    private contextExtractor;
    private completionCache;
    private readonly CACHE_DURATION;
    constructor(echoProvider: EchoAIProvider);
    getInlineCompletion(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem | undefined>;
    getCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]>;
    private extractCompletionContext;
    private generateFunctionCompletion;
    private generateVariableCompletion;
    private generateImportCompletion;
    private shouldSuggestFunction;
    private shouldSuggestVariable;
    private shouldSuggestImport;
    private getPrecedingLines;
    private getFollowingLines;
    private generateCacheKey;
}
//# sourceMappingURL=CompletionProvider.d.ts.map