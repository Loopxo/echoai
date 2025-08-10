import * as vscode from 'vscode';
export interface CodeContext {
    currentFunction?: string;
    currentClass?: string;
    imports: string[];
    variables: string[];
    nearbyCode: string;
    documentType: string;
}
export declare class CodeContextExtractor {
    extractRelevantContext(document: vscode.TextDocument, position: vscode.Position, maxTokens?: number): string;
    private analyzeContext;
    private findCurrentFunction;
    private findCurrentClass;
    private extractImports;
    private extractVariables;
    private extractNearbyCode;
    private trimToLength;
    extractMethodSignatures(document: vscode.TextDocument): string[];
}
//# sourceMappingURL=CodeContextExtractor.d.ts.map