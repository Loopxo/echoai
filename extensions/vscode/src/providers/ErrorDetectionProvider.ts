import * as vscode from 'vscode';
import { EchoAIProvider } from './EchoAIProvider';

export class ErrorDetectionProvider {
    private echoProvider: EchoAIProvider;
    private analysisCache: Map<string, { diagnostics: vscode.Diagnostic[], timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 30000; // 30 seconds
    private analysisQueue: Map<string, NodeJS.Timeout> = new Map();

    constructor(echoProvider: EchoAIProvider) {
        this.echoProvider = echoProvider;
    }

    async provideDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        // Debounce analysis to avoid too frequent API calls
        const documentKey = document.uri.toString();
        
        // Clear existing timeout
        const existingTimeout = this.analysisQueue.get(documentKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(async () => {
                try {
                    const diagnostics = await this.analyzeDocument(document);
                    this.analysisQueue.delete(documentKey);
                    resolve(diagnostics);
                } catch (error) {
                    console.error('Error analysis failed:', error);
                    resolve([]);
                }
            }, 1000); // 1 second delay

            this.analysisQueue.set(documentKey, timeout);
        });
    }

    private async analyzeDocument(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const documentKey = `${document.uri.toString()}-${document.version}`;
        
        // Check cache
        const cached = this.analysisCache.get(documentKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.diagnostics;
        }

        // Skip analysis for very large files to avoid performance issues
        if (document.getText().length > 50000) {
            return [];
        }

        try {
            const errors = await this.echoProvider.detectSyntaxErrors(
                document.getText(),
                document.languageId
            );

            const diagnostics = errors.map(error => {
                const line = Math.max(0, Math.min(error.line - 1, document.lineCount - 1));
                const lineText = document.lineAt(line).text;
                const range = new vscode.Range(
                    line, 0,
                    line, lineText.length
                );

                const severity = error.severity === 'error' 
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;

                const diagnostic = new vscode.Diagnostic(
                    range,
                    error.message,
                    severity
                );

                diagnostic.source = 'Echo AI';
                diagnostic.code = 'echo-ai-analysis';
                
                return diagnostic;
            });

            // Cache the result
            this.analysisCache.set(documentKey, {
                diagnostics,
                timestamp: Date.now()
            });

            // Clean up old cache entries
            this.cleanupCache();

            return diagnostics;
        } catch (error) {
            console.error('Document analysis error:', error);
            return [];
        }
    }

    private cleanupCache(): void {
        const now = Date.now();
        const entriesToDelete: string[] = [];

        this.analysisCache.forEach((value, key) => {
            if (now - value.timestamp > this.CACHE_DURATION * 2) {
                entriesToDelete.push(key);
            }
        });

        entriesToDelete.forEach(key => this.analysisCache.delete(key));
    }

    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): Promise<vscode.CodeAction[]> {
        const actions: vscode.CodeAction[] = [];

        // Filter for Echo AI diagnostics
        const echoAIDiagnostics = context.diagnostics.filter(
            d => d.source === 'Echo AI'
        );

        if (echoAIDiagnostics.length === 0) {
            return actions;
        }

        // Create quick fix action
        const fixAction = new vscode.CodeAction(
            'Fix with Echo AI',
            vscode.CodeActionKind.QuickFix
        );

        fixAction.command = {
            command: 'echo-ai.fixErrors',
            title: 'Fix with Echo AI'
        };

        fixAction.diagnostics = echoAIDiagnostics;
        actions.push(fixAction);

        // Create explain action
        const explainAction = new vscode.CodeAction(
            'Explain Error with Echo AI',
            vscode.CodeActionKind.QuickFix
        );

        explainAction.command = {
            command: 'echo-ai.explainError',
            title: 'Explain Error',
            arguments: [echoAIDiagnostics[0]]
        };

        actions.push(explainAction);

        return actions;
    }

    // Advanced error detection patterns for different languages
    private getLanguageSpecificPatterns(languageId: string): RegExp[] {
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                return [
                    /undefined|null reference/i,
                    /cannot read property/i,
                    /unexpected token/i,
                    /missing semicolon/i,
                    /unreachable code/i
                ];
            
            case 'python':
                return [
                    /indentation error/i,
                    /syntax error/i,
                    /name .* is not defined/i,
                    /invalid syntax/i
                ];
            
            case 'java':
                return [
                    /cannot find symbol/i,
                    /incompatible types/i,
                    /missing return statement/i,
                    /unreachable statement/i
                ];
                
            default:
                return [
                    /error/i,
                    /warning/i,
                    /exception/i
                ];
        }
    }

    // Provide suggestions for common error patterns
    private getSuggestionForError(errorMessage: string, languageId: string): string {
        const message = errorMessage.toLowerCase();
        
        if (message.includes('undefined') || message.includes('null')) {
            return 'Consider adding null checks or optional chaining';
        }
        
        if (message.includes('missing semicolon')) {
            return 'Add a semicolon at the end of the statement';
        }
        
        if (message.includes('indentation')) {
            return 'Check your indentation - Python requires consistent spacing';
        }
        
        if (message.includes('cannot find symbol') && languageId === 'java') {
            return 'Ensure the variable or method is declared and imported';
        }
        
        return 'Review the syntax and logic in this area';
    }
}