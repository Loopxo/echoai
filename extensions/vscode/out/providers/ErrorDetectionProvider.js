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
exports.ErrorDetectionProvider = void 0;
const vscode = __importStar(require("vscode"));
class ErrorDetectionProvider {
    echoProvider;
    analysisCache = new Map();
    CACHE_DURATION = 30000; // 30 seconds
    analysisQueue = new Map();
    constructor(echoProvider) {
        this.echoProvider = echoProvider;
    }
    async provideDiagnostics(document) {
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
                }
                catch (error) {
                    console.error('Error analysis failed:', error);
                    resolve([]);
                }
            }, 1000); // 1 second delay
            this.analysisQueue.set(documentKey, timeout);
        });
    }
    async analyzeDocument(document) {
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
            const errors = await this.echoProvider.detectSyntaxErrors(document.getText(), document.languageId);
            const diagnostics = errors.map(error => {
                const line = Math.max(0, Math.min(error.line - 1, document.lineCount - 1));
                const lineText = document.lineAt(line).text;
                const range = new vscode.Range(line, 0, line, lineText.length);
                const severity = error.severity === 'error'
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;
                const diagnostic = new vscode.Diagnostic(range, error.message, severity);
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
        }
        catch (error) {
            console.error('Document analysis error:', error);
            return [];
        }
    }
    cleanupCache() {
        const now = Date.now();
        const entriesToDelete = [];
        this.analysisCache.forEach((value, key) => {
            if (now - value.timestamp > this.CACHE_DURATION * 2) {
                entriesToDelete.push(key);
            }
        });
        entriesToDelete.forEach(key => this.analysisCache.delete(key));
    }
    async provideCodeActions(document, range, context) {
        const actions = [];
        // Filter for Echo AI diagnostics
        const echoAIDiagnostics = context.diagnostics.filter(d => d.source === 'Echo AI');
        if (echoAIDiagnostics.length === 0) {
            return actions;
        }
        // Create quick fix action
        const fixAction = new vscode.CodeAction('Fix with Echo AI', vscode.CodeActionKind.QuickFix);
        fixAction.command = {
            command: 'echo-ai.fixErrors',
            title: 'Fix with Echo AI'
        };
        fixAction.diagnostics = echoAIDiagnostics;
        actions.push(fixAction);
        // Create explain action
        const explainAction = new vscode.CodeAction('Explain Error with Echo AI', vscode.CodeActionKind.QuickFix);
        explainAction.command = {
            command: 'echo-ai.explainError',
            title: 'Explain Error',
            arguments: [echoAIDiagnostics[0]]
        };
        actions.push(explainAction);
        return actions;
    }
    // Advanced error detection patterns for different languages
    getLanguageSpecificPatterns(languageId) {
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
    getSuggestionForError(errorMessage, languageId) {
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
exports.ErrorDetectionProvider = ErrorDetectionProvider;
//# sourceMappingURL=ErrorDetectionProvider.js.map