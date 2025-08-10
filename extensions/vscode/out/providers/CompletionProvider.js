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
exports.CompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const CodeContextExtractor_1 = require("../utils/CodeContextExtractor");
class CompletionProvider {
    echoProvider;
    contextExtractor;
    completionCache = new Map();
    CACHE_DURATION = 60000; // 1 minute
    constructor(echoProvider) {
        this.echoProvider = echoProvider;
        this.contextExtractor = new CodeContextExtractor_1.CodeContextExtractor();
    }
    async getInlineCompletion(document, position, context, token) {
        // Don't trigger on every keystroke - add debouncing
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
            const config = vscode.workspace.getConfiguration('echoAI');
            const delay = config.get('completionDelay', 500);
            await new Promise(resolve => setTimeout(resolve, delay));
            if (token.isCancellationRequested) {
                return undefined;
            }
        }
        try {
            const context = this.extractCompletionContext(document, position);
            const cacheKey = this.generateCacheKey(document, position, context);
            // Check cache
            const cached = this.completionCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return new vscode.InlineCompletionItem(cached.completion);
            }
            const completion = await this.echoProvider.getCompletion(context.currentLine, context.relevantCode, document.languageId, 150 // Shorter for inline completions
            );
            if (completion.trim()) {
                // Cache the result
                this.completionCache.set(cacheKey, {
                    completion,
                    timestamp: Date.now()
                });
                return new vscode.InlineCompletionItem(completion, new vscode.Range(position, position));
            }
        }
        catch (error) {
            console.error('Inline completion error:', error);
        }
        return undefined;
    }
    async getCompletionItems(document, position, token) {
        try {
            const context = this.extractCompletionContext(document, position);
            // Generate multiple completion suggestions
            const completions = await Promise.allSettled([
                this.generateFunctionCompletion(context, document.languageId),
                this.generateVariableCompletion(context, document.languageId),
                this.generateImportCompletion(context, document.languageId)
            ]);
            const items = [];
            completions.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const item = new vscode.CompletionItem(result.value.label, result.value.kind);
                    item.insertText = new vscode.SnippetString(result.value.insertText);
                    item.documentation = new vscode.MarkdownString(result.value.documentation);
                    item.detail = 'Echo AI';
                    item.sortText = `000${index}`; // Prioritize our completions
                    items.push(item);
                }
            });
            return items;
        }
        catch (error) {
            console.error('Completion items error:', error);
            return [];
        }
    }
    extractCompletionContext(document, position) {
        const currentLine = document.lineAt(position).text.substring(0, position.character);
        const precedingLines = this.getPrecedingLines(document, position, 20);
        const followingLines = this.getFollowingLines(document, position, 5);
        // Extract relevant context using the context extractor
        const relevantCode = this.contextExtractor.extractRelevantContext(document, position, 500 // tokens
        );
        return {
            currentLine,
            precedingLines,
            followingLines,
            relevantCode,
            languageId: document.languageId,
            fileName: document.fileName
        };
    }
    async generateFunctionCompletion(context, languageId) {
        if (!this.shouldSuggestFunction(context.currentLine)) {
            return null;
        }
        const prompt = `Generate a ${languageId} function based on this context:

Current line: ${context.currentLine}
Context: ${context.relevantCode}

Provide a complete function with:
1. Appropriate name based on context
2. Proper parameters
3. Implementation
4. JSDoc/documentation comments if applicable

Return only the function code.`;
        try {
            const completion = await this.echoProvider.getCompletion(prompt, context.relevantCode, languageId, 300);
            return {
                label: 'Generate Function',
                kind: vscode.CompletionItemKind.Function,
                insertText: completion,
                documentation: 'AI-generated function based on context'
            };
        }
        catch (error) {
            return null;
        }
    }
    async generateVariableCompletion(context, languageId) {
        if (!this.shouldSuggestVariable(context.currentLine)) {
            return null;
        }
        const prompt = `Suggest ${languageId} variable declarations/assignments for:

Current line: ${context.currentLine}
Context: ${context.relevantCode}

Provide appropriate variable name and initialization based on context.`;
        try {
            const completion = await this.echoProvider.getCompletion(prompt, context.relevantCode, languageId, 100);
            return {
                label: 'Generate Variable',
                kind: vscode.CompletionItemKind.Variable,
                insertText: completion,
                documentation: 'AI-suggested variable declaration'
            };
        }
        catch (error) {
            return null;
        }
    }
    async generateImportCompletion(context, languageId) {
        if (!this.shouldSuggestImport(context.currentLine)) {
            return null;
        }
        const prompt = `Suggest ${languageId} import statements for:

Current line: ${context.currentLine}
Context: ${context.relevantCode}

Provide the most likely import statement based on usage patterns.`;
        try {
            const completion = await this.echoProvider.getCompletion(prompt, context.relevantCode, languageId, 50);
            return {
                label: 'Generate Import',
                kind: vscode.CompletionItemKind.Module,
                insertText: completion,
                documentation: 'AI-suggested import statement'
            };
        }
        catch (error) {
            return null;
        }
    }
    shouldSuggestFunction(currentLine) {
        return /^\s*(function|def|fn|func|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)/.test(currentLine);
    }
    shouldSuggestVariable(currentLine) {
        return /^\s*(const|let|var|val)\s/.test(currentLine);
    }
    shouldSuggestImport(currentLine) {
        return /^\s*(import|from|require|#include|use)/.test(currentLine);
    }
    getPrecedingLines(document, position, count) {
        const startLine = Math.max(0, position.line - count);
        const lines = [];
        for (let i = startLine; i < position.line; i++) {
            lines.push(document.lineAt(i).text);
        }
        return lines.join('\n');
    }
    getFollowingLines(document, position, count) {
        const endLine = Math.min(document.lineCount - 1, position.line + count);
        const lines = [];
        for (let i = position.line + 1; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
        }
        return lines.join('\n');
    }
    generateCacheKey(document, position, context) {
        return `${document.uri.toString()}-${position.line}-${position.character}-${context.currentLine.trim()}`;
    }
}
exports.CompletionProvider = CompletionProvider;
//# sourceMappingURL=CompletionProvider.js.map