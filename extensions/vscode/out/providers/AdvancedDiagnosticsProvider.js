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
exports.AdvancedDiagnosticsProvider = void 0;
const vscode = __importStar(require("vscode"));
const CodeAnalyzer_1 = require("../utils/CodeAnalyzer");
class AdvancedDiagnosticsProvider {
    echoProvider;
    codeAnalyzer;
    diagnosticsCache = new Map();
    CACHE_DURATION = 45000; // 45 seconds
    analysisQueue = new Map();
    constructor(echoProvider) {
        this.echoProvider = echoProvider;
        this.codeAnalyzer = new CodeAnalyzer_1.CodeAnalyzer();
    }
    async analyzeCode(document) {
        const documentKey = `${document.uri.toString()}-${document.version}`;
        // Debounce analysis
        const existingTimeout = this.analysisQueue.get(documentKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        return new Promise((resolve) => {
            const timeout = setTimeout(async () => {
                try {
                    const diagnostics = await this.performAdvancedAnalysis(document);
                    this.analysisQueue.delete(documentKey);
                    resolve(diagnostics);
                }
                catch (error) {
                    console.error('Advanced analysis failed:', error);
                    resolve([]);
                }
            }, 1500); // Longer delay for deep analysis
            this.analysisQueue.set(documentKey, timeout);
        });
    }
    async performAdvancedAnalysis(document) {
        const documentKey = `${document.uri.toString()}-${document.version}`;
        // Check cache
        const cached = this.diagnosticsCache.get(documentKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return this.convertToDiagnostics(cached.issues, document);
        }
        // Skip very large files
        if (document.getText().length > 100000) {
            return [];
        }
        const code = document.getText();
        const issues = [];
        // Run multiple analysis types in parallel
        const analysisPromises = [
            this.performSemanticAnalysis(code, document.languageId),
            this.performLogicAnalysis(code, document.languageId),
            this.performPerformanceAnalysis(code, document.languageId),
            this.performSecurityAnalysis(code, document.languageId),
            this.performMaintainabilityAnalysis(code, document.languageId)
        ];
        try {
            const results = await Promise.allSettled(analysisPromises);
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    issues.push(...result.value);
                }
            });
            // Cache results
            this.diagnosticsCache.set(documentKey, {
                issues,
                timestamp: Date.now()
            });
            // Cleanup old cache entries
            this.cleanupCache();
            return this.convertToDiagnostics(issues, document);
        }
        catch (error) {
            console.error('Analysis pipeline error:', error);
            return [];
        }
    }
    async performSemanticAnalysis(code, languageId) {
        const prompt = `Analyze this ${languageId} code for semantic issues. Focus on:
1. Undefined variables or functions
2. Type mismatches and compatibility issues
3. Scope and closure problems
4. Memory leaks and resource management
5. Async/await and Promise handling errors

Code:
\`\`\`${languageId}
${code}
\`\`\`

Return JSON array of issues:
[{"type": "semantic", "severity": "error", "message": "Description", "line": 1, "suggestion": "Fix suggestion", "fixable": true, "confidence": 85}]

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', languageId, 800);
            return this.parseAnalysisResponse(response, 'semantic');
        }
        catch (error) {
            return [];
        }
    }
    async performLogicAnalysis(code, languageId) {
        const prompt = `Analyze this ${languageId} code for logic errors and potential bugs:
1. Unreachable code
2. Infinite loops or recursion
3. Off-by-one errors in loops and arrays
4. Null pointer dereferences
5. Race conditions and concurrency issues
6. Incorrect conditional logic

Code:
\`\`\`${languageId}
${code}
\`\`\`

Return JSON array of issues:
[{"type": "logic", "severity": "error", "message": "Description", "line": 1, "suggestion": "Fix suggestion", "fixable": true, "confidence": 90}]

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', languageId, 600);
            return this.parseAnalysisResponse(response, 'logic');
        }
        catch (error) {
            return [];
        }
    }
    async performPerformanceAnalysis(code, languageId) {
        const complexity = this.codeAnalyzer.analyzeComplexity(code);
        const issues = [];
        // High complexity warning
        if (complexity.cyclomaticComplexity > 10) {
            issues.push({
                type: 'performance',
                severity: 'warning',
                message: `High cyclomatic complexity (${complexity.cyclomaticComplexity}). Consider breaking into smaller functions.`,
                line: 1,
                suggestion: 'Refactor into smaller, focused functions',
                fixable: false,
                confidence: 95
            });
        }
        // Cognitive complexity warning
        if (complexity.cognitiveComplexity > 15) {
            issues.push({
                type: 'performance',
                severity: 'warning',
                message: `High cognitive complexity (${complexity.cognitiveComplexity}). Code may be hard to understand.`,
                line: 1,
                suggestion: 'Simplify logic and reduce nesting',
                fixable: false,
                confidence: 90
            });
        }
        // AI-powered performance analysis
        if (code.length > 1000) {
            const prompt = `Analyze this ${languageId} code for performance issues:
1. Inefficient algorithms or data structures
2. Unnecessary loops or computations
3. Memory allocation problems
4. I/O operations that could be optimized
5. Blocking operations in async contexts

Code:
\`\`\`${languageId}
${code}
\`\`\`

Return JSON array of issues:
[{"type": "performance", "severity": "warning", "message": "Description", "line": 1, "suggestion": "Optimization suggestion", "fixable": false, "confidence": 75}]

Only return JSON, no other text.`;
            try {
                const response = await this.echoProvider.getCompletion(prompt, '', languageId, 500);
                const aiIssues = this.parseAnalysisResponse(response, 'performance');
                issues.push(...aiIssues);
            }
            catch (error) {
                // Fallback to static analysis only
            }
        }
        return issues;
    }
    async performSecurityAnalysis(code, languageId) {
        const issues = [];
        // Static security pattern detection
        const securityPatterns = this.getSecurityPatterns(languageId);
        const lines = code.split('\n');
        lines.forEach((line, index) => {
            securityPatterns.forEach(pattern => {
                if (pattern.regex.test(line)) {
                    issues.push({
                        type: 'security',
                        severity: pattern.severity,
                        message: pattern.message,
                        line: index + 1,
                        suggestion: pattern.suggestion,
                        fixable: pattern.fixable,
                        confidence: pattern.confidence
                    });
                }
            });
        });
        // AI-powered security analysis for complex cases
        if (code.includes('password') || code.includes('token') || code.includes('secret') ||
            code.includes('sql') || code.includes('eval') || code.includes('exec')) {
            const prompt = `Analyze this ${languageId} code for security vulnerabilities:
1. SQL injection risks
2. XSS vulnerabilities
3. Insecure direct object references
4. Hardcoded credentials
5. Insecure cryptographic practices
6. Path traversal vulnerabilities

Code:
\`\`\`${languageId}
${code}
\`\`\`

Return JSON array of issues:
[{"type": "security", "severity": "error", "message": "Security issue description", "line": 1, "suggestion": "Security fix", "fixable": true, "confidence": 80}]

Only return JSON, no other text.`;
            try {
                const response = await this.echoProvider.getCompletion(prompt, '', languageId, 600);
                const aiIssues = this.parseAnalysisResponse(response, 'security');
                issues.push(...aiIssues);
            }
            catch (error) {
                // Continue with static analysis results
            }
        }
        return issues;
    }
    async performMaintainabilityAnalysis(code, languageId) {
        const prompt = `Analyze this ${languageId} code for maintainability issues:
1. Code duplication
2. Long functions or classes
3. Poor naming conventions
4. Missing or inadequate comments
5. Tight coupling between components
6. Violations of SOLID principles

Code:
\`\`\`${languageId}
${code}
\`\`\`

Return JSON array of issues:
[{"type": "maintainability", "severity": "info", "message": "Maintainability issue", "line": 1, "suggestion": "Improvement suggestion", "fixable": false, "confidence": 70}]

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', languageId, 500);
            return this.parseAnalysisResponse(response, 'maintainability');
        }
        catch (error) {
            return [];
        }
    }
    parseAnalysisResponse(response, expectedType) {
        try {
            const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const issues = JSON.parse(cleaned);
            return Array.isArray(issues) ? issues.filter(issue => issue.type === expectedType &&
                issue.line &&
                issue.message &&
                issue.severity) : [];
        }
        catch (error) {
            console.error('Failed to parse analysis response:', error);
            return [];
        }
    }
    getSecurityPatterns(languageId) {
        const patterns = [
            {
                regex: /password\s*=\s*["'][^"']+["']/i,
                severity: 'error',
                message: 'Hardcoded password detected',
                suggestion: 'Use environment variables or secure configuration',
                fixable: true,
                confidence: 95
            },
            {
                regex: /api[_-]?key\s*=\s*["'][^"']+["']/i,
                severity: 'error',
                message: 'Hardcoded API key detected',
                suggestion: 'Use environment variables or secure storage',
                fixable: true,
                confidence: 95
            },
            {
                regex: /eval\s*\(/i,
                severity: 'warning',
                message: 'Use of eval() detected - potential security risk',
                suggestion: 'Avoid eval(), use safer alternatives',
                fixable: false,
                confidence: 85
            }
        ];
        // Language-specific patterns
        if (languageId === 'javascript' || languageId === 'typescript') {
            patterns.push({
                regex: /innerHTML\s*=.*\+/,
                severity: 'warning',
                message: 'Potential XSS vulnerability with innerHTML',
                suggestion: 'Use textContent or sanitize input',
                fixable: true,
                confidence: 80
            }, {
                regex: /document\.write\s*\(/,
                severity: 'warning',
                message: 'document.write() can be dangerous',
                suggestion: 'Use safer DOM manipulation methods',
                fixable: true,
                confidence: 75
            });
        }
        if (languageId === 'python') {
            patterns.push({
                regex: /exec\s*\(/,
                severity: 'error',
                message: 'Use of exec() detected - major security risk',
                suggestion: 'Avoid exec(), find safer alternatives',
                fixable: false,
                confidence: 95
            }, {
                regex: /pickle\.loads?\s*\(/,
                severity: 'warning',
                message: 'Pickle deserialization can be unsafe',
                suggestion: 'Use JSON or validate pickle sources',
                fixable: false,
                confidence: 80
            });
        }
        return patterns;
    }
    convertToDiagnostics(issues, document) {
        return issues.map(issue => {
            const line = Math.max(0, Math.min(issue.line - 1, document.lineCount - 1));
            const lineText = document.lineAt(line).text;
            let range;
            if (issue.column) {
                const char = Math.max(0, Math.min(issue.column, lineText.length));
                range = new vscode.Range(line, char, line, char + 10);
            }
            else {
                range = new vscode.Range(line, 0, line, lineText.length);
            }
            const severity = this.mapSeverity(issue.severity);
            const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
            diagnostic.source = 'Echo AI Advanced';
            diagnostic.code = `echo-ai-${issue.type}`;
            // Add tags for better categorization
            if (issue.type === 'security') {
                diagnostic.tags = [vscode.DiagnosticTag.Deprecated]; // Use as security indicator
            }
            if (issue.severity === 'hint') {
                diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
            }
            return diagnostic;
        });
    }
    mapSeverity(severity) {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
            default: return vscode.DiagnosticSeverity.Warning;
        }
    }
    cleanupCache() {
        const now = Date.now();
        const entriesToDelete = [];
        this.diagnosticsCache.forEach((value, key) => {
            if (now - value.timestamp > this.CACHE_DURATION * 2) {
                entriesToDelete.push(key);
            }
        });
        entriesToDelete.forEach(key => this.diagnosticsCache.delete(key));
    }
    // Provide enhanced code actions for advanced diagnostics
    async provideAdvancedCodeActions(document, range, diagnostics) {
        const actions = [];
        const advancedDiagnostics = diagnostics.filter(d => d.source === 'Echo AI Advanced');
        if (advancedDiagnostics.length === 0) {
            return actions;
        }
        // Auto-fix action for fixable issues
        const fixableDiagnostics = advancedDiagnostics.filter(d => d.code && (d.code.toString().includes('security') ||
            d.code.toString().includes('performance')));
        if (fixableDiagnostics.length > 0) {
            const autoFixAction = new vscode.CodeAction('Auto-fix with Echo AI', vscode.CodeActionKind.QuickFix);
            autoFixAction.command = {
                command: 'echo-ai.autoFixAdvanced',
                title: 'Auto-fix Advanced Issues',
                arguments: [fixableDiagnostics, document.uri]
            };
            actions.push(autoFixAction);
        }
        // Explain advanced issue
        const explainAction = new vscode.CodeAction('Explain Advanced Issue', vscode.CodeActionKind.QuickFix);
        explainAction.command = {
            command: 'echo-ai.explainAdvancedIssue',
            title: 'Explain Advanced Issue',
            arguments: [advancedDiagnostics[0]]
        };
        actions.push(explainAction);
        // Show security recommendations for security issues
        const securityDiagnostics = advancedDiagnostics.filter(d => d.code && d.code.toString().includes('security'));
        if (securityDiagnostics.length > 0) {
            const securityAction = new vscode.CodeAction('Show Security Recommendations', vscode.CodeActionKind.QuickFix);
            securityAction.command = {
                command: 'echo-ai.showSecurityRecommendations',
                title: 'Security Recommendations',
                arguments: [securityDiagnostics]
            };
            actions.push(securityAction);
        }
        return actions;
    }
}
exports.AdvancedDiagnosticsProvider = AdvancedDiagnosticsProvider;
//# sourceMappingURL=AdvancedDiagnosticsProvider.js.map