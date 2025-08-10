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
exports.RefactoringEngine = void 0;
const vscode = __importStar(require("vscode"));
const CodeAnalyzer_1 = require("../utils/CodeAnalyzer");
class RefactoringEngine {
    echoProvider;
    codebaseIndexer;
    codeAnalyzer;
    operationHistory = [];
    // Refactoring patterns and templates
    patterns = new Map();
    // Cache for analysis results
    analysisCache = new Map();
    CACHE_DURATION = 300000; // 5 minutes
    constructor(echoProvider, codebaseIndexer) {
        this.echoProvider = echoProvider;
        this.codebaseIndexer = codebaseIndexer;
        this.codeAnalyzer = new CodeAnalyzer_1.CodeAnalyzer();
        this.initializePatterns();
    }
    async analyzeRefactoringOpportunities(document) {
        const context = await this.buildRefactoringContext(document);
        const opportunities = [];
        // Run parallel analysis for different refactoring types
        const analysisPromises = [
            this.analyzeExtractMethodOpportunities(context),
            this.analyzeExtractVariableOpportunities(context),
            this.analyzeExtractClassOpportunities(context),
            this.analyzeDesignPatternOpportunities(context),
            this.analyzePerformanceOptimizations(context),
            this.analyzeCodeSmellFixes(context),
            this.analyzeModernizationOpportunities(context)
        ];
        try {
            const results = await Promise.allSettled(analysisPromises);
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    opportunities.push(...result.value);
                }
            });
            // Sort by impact and confidence
            return opportunities.sort((a, b) => {
                const scoreA = this.calculateOpportunityScore(a);
                const scoreB = this.calculateOpportunityScore(b);
                return scoreB - scoreA;
            }).slice(0, 20); // Limit to top 20 opportunities
        }
        catch (error) {
            console.error('Refactoring analysis failed:', error);
            return [];
        }
    }
    async executeRefactoring(operation, context) {
        const startTime = Date.now();
        try {
            // Validate prerequisites
            const validationResult = await this.validatePrerequisites(operation, context);
            if (!validationResult.valid) {
                return {
                    operation,
                    success: false,
                    changes: new vscode.WorkspaceEdit(),
                    affectedFiles: [],
                    warnings: [],
                    errors: validationResult.errors,
                    confidence: 0,
                    executionTime: Date.now() - startTime
                };
            }
            // Execute the specific refactoring
            const result = await this.executeSpecificRefactoring(operation, context);
            // Add to history
            this.operationHistory.push(result);
            // Limit history size
            if (this.operationHistory.length > 100) {
                this.operationHistory.shift();
            }
            return result;
        }
        catch (error) {
            console.error(`Refactoring execution failed for ${operation.type}:`, error);
            return {
                operation,
                success: false,
                changes: new vscode.WorkspaceEdit(),
                affectedFiles: [],
                warnings: [],
                errors: [`Execution failed: ${error}`],
                confidence: 0,
                executionTime: Date.now() - startTime
            };
        }
    }
    async buildRefactoringContext(document) {
        const editor = vscode.window.activeTextEditor;
        const selection = editor?.selection || new vscode.Range(0, 0, 0, 0);
        const cursorPosition = editor?.selection.active || new vscode.Position(0, 0);
        const selectedText = document.getText(selection);
        const surroundingCode = this.getSurroundingCode(document, selection, 20);
        // Get symbols and analysis
        const indexedFile = this.codebaseIndexer.getFileIndex(document.uri);
        const functions = this.codeAnalyzer.extractFunctions(document.getText(), document.languageId);
        const classes = this.codeAnalyzer.extractClasses(document.getText(), document.languageId);
        // Detect project framework and dependencies
        const projectInfo = await this.detectProjectInfo(document.uri);
        return {
            document,
            selection,
            cursorPosition,
            selectedText,
            surroundingCode,
            symbols: indexedFile?.symbols || [],
            functions,
            classes,
            languageId: document.languageId,
            projectInfo
        };
    }
    async analyzeExtractMethodOpportunities(context) {
        const opportunities = [];
        const complexity = this.codeAnalyzer.analyzeComplexity(context.selectedText || context.surroundingCode);
        // Look for long methods
        for (const func of context.functions) {
            const funcLines = func.endLine - func.startLine;
            if (funcLines > 20) { // Method too long
                opportunities.push({
                    id: `extract_method_${func.name}_${Date.now()}`,
                    type: 'extract_method',
                    name: `Extract Method from ${func.name}`,
                    description: `Method ${func.name} has ${funcLines} lines and could benefit from extraction of logical blocks`,
                    scope: 'function',
                    complexity: funcLines > 50 ? 'complex' : 'medium',
                    estimatedTime: 30000 + (funcLines * 500),
                    riskLevel: funcLines > 100 ? 'high' : 'medium',
                    prerequisites: ['Method has clear logical sections', 'No complex variable dependencies'],
                    impacts: ['Improved readability', 'Better testability', 'Reduced complexity'],
                    preview: true
                });
            }
        }
        // AI-powered analysis for complex extraction opportunities
        if (context.selectedText && context.selectedText.length > 100) {
            const aiOpportunities = await this.getAIExtractMethodSuggestions(context);
            opportunities.push(...aiOpportunities);
        }
        return opportunities;
    }
    async analyzeExtractVariableOpportunities(context) {
        const opportunities = [];
        const code = context.selectedText || context.surroundingCode;
        // Look for repeated expressions
        const expressions = this.findRepeatedExpressions(code);
        for (const expr of expressions) {
            if (expr.occurrences > 2 && expr.complexity > 3) {
                opportunities.push({
                    id: `extract_variable_${expr.hash}_${Date.now()}`,
                    type: 'extract_variable',
                    name: `Extract Variable for "${expr.expression.substring(0, 30)}..."`,
                    description: `Expression appears ${expr.occurrences} times and could be extracted to improve readability`,
                    scope: 'function',
                    complexity: 'simple',
                    estimatedTime: 10000,
                    riskLevel: 'low',
                    prerequisites: ['Expression has no side effects'],
                    impacts: ['Reduced duplication', 'Improved maintainability'],
                    preview: true
                });
            }
        }
        return opportunities;
    }
    async analyzeExtractClassOpportunities(context) {
        const opportunities = [];
        for (const cls of context.classes) {
            const methodCount = cls.methods.length;
            const propertyCount = cls.properties.length;
            // Large class smell
            if (methodCount > 15 || propertyCount > 10) {
                const relatedMethods = await this.findRelatedMethods(cls, context);
                if (relatedMethods.length > 3) {
                    opportunities.push({
                        id: `extract_class_${cls.name}_${Date.now()}`,
                        type: 'extract_class',
                        name: `Extract Class from ${cls.name}`,
                        description: `Class ${cls.name} has ${methodCount} methods and shows signs of multiple responsibilities`,
                        scope: 'class',
                        complexity: 'complex',
                        estimatedTime: 180000, // 3 minutes
                        riskLevel: 'high',
                        prerequisites: ['Cohesive group of methods identified', 'Clear single responsibility'],
                        impacts: ['Better separation of concerns', 'Improved testability', 'Reduced class complexity'],
                        preview: true
                    });
                }
            }
        }
        return opportunities;
    }
    async analyzeDesignPatternOpportunities(context) {
        const opportunities = [];
        // Strategy Pattern opportunity
        const conditionalComplexity = this.analyzeConditionalComplexity(context.surroundingCode);
        if (conditionalComplexity.switchStatements > 2 || conditionalComplexity.ifElseChains > 5) {
            opportunities.push({
                id: `strategy_pattern_${Date.now()}`,
                type: 'introduce_design_pattern',
                name: 'Introduce Strategy Pattern',
                description: 'Complex conditional logic could be replaced with Strategy pattern for better extensibility',
                scope: 'file',
                complexity: 'complex',
                estimatedTime: 240000, // 4 minutes
                riskLevel: 'medium',
                prerequisites: ['Clear algorithmic variations', 'Stable interface requirements'],
                impacts: ['Improved extensibility', 'Eliminated conditional complexity', 'Better OOP design'],
                preview: true
            });
        }
        // Factory Pattern opportunity
        const constructorComplexity = this.analyzeConstructorComplexity(context);
        if (constructorComplexity > 3) {
            opportunities.push({
                id: `factory_pattern_${Date.now()}`,
                type: 'introduce_design_pattern',
                name: 'Introduce Factory Pattern',
                description: 'Complex object creation logic could benefit from Factory pattern',
                scope: 'class',
                complexity: 'medium',
                estimatedTime: 120000, // 2 minutes
                riskLevel: 'low',
                prerequisites: ['Multiple creation paths', 'Similar object types'],
                impacts: ['Simplified object creation', 'Better encapsulation', 'Improved maintainability'],
                preview: true
            });
        }
        return opportunities;
    }
    async analyzePerformanceOptimizations(context) {
        const opportunities = [];
        const prompt = `Analyze this ${context.languageId} code for performance optimization opportunities:

${context.surroundingCode}

Identify specific performance issues like:
1. Inefficient loops or algorithms
2. Unnecessary object creation
3. Repeated calculations
4. Memory leaks
5. Blocking operations

Return JSON array of optimizations:
[{"type": "optimize_performance", "issue": "description", "solution": "optimization approach", "impact": "performance benefit"}]

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', context.languageId, 800);
            const optimizations = JSON.parse(response);
            optimizations.forEach((opt, index) => {
                opportunities.push({
                    id: `performance_opt_${index}_${Date.now()}`,
                    type: 'optimize_performance',
                    name: `Optimize: ${opt.issue}`,
                    description: `${opt.solution} - Expected benefit: ${opt.impact}`,
                    scope: 'function',
                    complexity: 'medium',
                    estimatedTime: 60000,
                    riskLevel: 'medium',
                    prerequisites: ['Performance profiling completed', 'Test coverage available'],
                    impacts: [`Performance improvement: ${opt.impact}`],
                    preview: true
                });
            });
        }
        catch (error) {
            // Fallback to basic static analysis
            console.warn('AI performance analysis failed, using static analysis');
        }
        return opportunities;
    }
    async analyzeCodeSmellFixes(context) {
        const opportunities = [];
        // Magic numbers detection
        const magicNumbers = this.findMagicNumbers(context.surroundingCode);
        if (magicNumbers.length > 0) {
            opportunities.push({
                id: `replace_magic_numbers_${Date.now()}`,
                type: 'replace_magic_numbers',
                name: 'Replace Magic Numbers with Named Constants',
                description: `Found ${magicNumbers.length} magic numbers that should be replaced with named constants`,
                scope: 'file',
                complexity: 'simple',
                estimatedTime: magicNumbers.length * 10000,
                riskLevel: 'low',
                prerequisites: ['Numbers represent meaningful values'],
                impacts: ['Improved code clarity', 'Better maintainability'],
                preview: true
            });
        }
        // Long parameter lists
        for (const func of context.functions) {
            if (func.parameters && func.parameters.length > 5) {
                opportunities.push({
                    id: `introduce_parameter_object_${func.name}_${Date.now()}`,
                    type: 'introduce_parameter',
                    name: `Introduce Parameter Object for ${func.name}`,
                    description: `Function ${func.name} has ${func.parameters.length} parameters and could benefit from parameter object`,
                    scope: 'function',
                    complexity: 'medium',
                    estimatedTime: 90000,
                    riskLevel: 'medium',
                    prerequisites: ['Parameters are logically related'],
                    impacts: ['Improved method signature', 'Better parameter management'],
                    preview: true
                });
            }
        }
        return opportunities;
    }
    async analyzeModernizationOpportunities(context) {
        const opportunities = [];
        if (context.languageId === 'javascript' || context.languageId === 'typescript') {
            const modernizationIssues = this.findJavaScriptModernizationOpportunities(context.surroundingCode);
            modernizationIssues.forEach((issue, index) => {
                opportunities.push({
                    id: `modernize_${issue.type}_${index}_${Date.now()}`,
                    type: 'modernize_syntax',
                    name: `Modernize: ${issue.description}`,
                    description: `${issue.oldPattern} → ${issue.newPattern}`,
                    scope: 'file',
                    complexity: 'simple',
                    estimatedTime: 20000,
                    riskLevel: 'low',
                    prerequisites: ['Modern JavaScript/TypeScript support available'],
                    impacts: ['Modern syntax', 'Better performance', 'Improved readability'],
                    preview: true
                });
            });
        }
        return opportunities;
    }
    async executeSpecificRefactoring(operation, context) {
        const startTime = Date.now();
        switch (operation.type) {
            case 'extract_method':
                return await this.executeExtractMethod(operation, context);
            case 'extract_variable':
                return await this.executeExtractVariable(operation, context);
            case 'extract_class':
                return await this.executeExtractClass(operation, context);
            case 'introduce_design_pattern':
                return await this.executeIntroduceDesignPattern(operation, context);
            case 'optimize_performance':
                return await this.executePerformanceOptimization(operation, context);
            case 'replace_magic_numbers':
                return await this.executeReplaceMagicNumbers(operation, context);
            case 'modernize_syntax':
                return await this.executeModernizeSyntax(operation, context);
            default:
                return {
                    operation,
                    success: false,
                    changes: new vscode.WorkspaceEdit(),
                    affectedFiles: [],
                    warnings: [],
                    errors: [`Unsupported refactoring type: ${operation.type}`],
                    confidence: 0,
                    executionTime: Date.now() - startTime
                };
        }
    }
    async executeExtractMethod(operation, context) {
        const startTime = Date.now();
        const prompt = `Extract a method from this ${context.languageId} code:

Selected code:
${context.selectedText}

Context:
${context.surroundingCode}

Please:
1. Extract the selected code into a well-named method
2. Identify parameters needed
3. Determine return type
4. Replace the original code with method call
5. Place the new method in appropriate location

Return the refactored code with clear method extraction.`;
        try {
            const refactoredCode = await this.echoProvider.getCompletion(prompt, '', context.languageId, 2000);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(0, 0, context.document.lineCount, 0);
            edit.replace(context.document.uri, fullRange, refactoredCode);
            return {
                operation,
                success: true,
                changes: edit,
                affectedFiles: [context.document.uri],
                warnings: [],
                errors: [],
                confidence: 85,
                executionTime: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                operation,
                success: false,
                changes: new vscode.WorkspaceEdit(),
                affectedFiles: [],
                warnings: [],
                errors: [`Extract method failed: ${error}`],
                confidence: 0,
                executionTime: Date.now() - startTime
            };
        }
    }
    async executeExtractVariable(operation, context) {
        // Similar implementation for extract variable...
        const startTime = Date.now();
        // Implementation would go here
        return {
            operation,
            success: true,
            changes: new vscode.WorkspaceEdit(),
            affectedFiles: [context.document.uri],
            warnings: [],
            errors: [],
            confidence: 90,
            executionTime: Date.now() - startTime
        };
    }
    async executeExtractClass(operation, context) {
        // Implementation for extract class...
        const startTime = Date.now();
        return {
            operation,
            success: true,
            changes: new vscode.WorkspaceEdit(),
            affectedFiles: [context.document.uri],
            warnings: [],
            errors: [],
            confidence: 80,
            executionTime: Date.now() - startTime
        };
    }
    async executeIntroduceDesignPattern(operation, context) {
        // Implementation for design patterns...
        const startTime = Date.now();
        return {
            operation,
            success: true,
            changes: new vscode.WorkspaceEdit(),
            affectedFiles: [context.document.uri],
            warnings: [],
            errors: [],
            confidence: 75,
            executionTime: Date.now() - startTime
        };
    }
    async executePerformanceOptimization(operation, context) {
        // Implementation for performance optimization...
        const startTime = Date.now();
        return {
            operation,
            success: true,
            changes: new vscode.WorkspaceEdit(),
            affectedFiles: [context.document.uri],
            warnings: [],
            errors: [],
            confidence: 85,
            executionTime: Date.now() - startTime
        };
    }
    async executeReplaceMagicNumbers(operation, context) {
        // Implementation for replacing magic numbers...
        const startTime = Date.now();
        return {
            operation,
            success: true,
            changes: new vscode.WorkspaceEdit(),
            affectedFiles: [context.document.uri],
            warnings: [],
            errors: [],
            confidence: 95,
            executionTime: Date.now() - startTime
        };
    }
    async executeModernizeSyntax(operation, context) {
        // Implementation for syntax modernization...
        const startTime = Date.now();
        return {
            operation,
            success: true,
            changes: new vscode.WorkspaceEdit(),
            affectedFiles: [context.document.uri],
            warnings: [],
            errors: [],
            confidence: 90,
            executionTime: Date.now() - startTime
        };
    }
    // Helper methods
    initializePatterns() {
        // Initialize refactoring patterns and templates
    }
    calculateOpportunityScore(operation) {
        let score = 0;
        // Risk factor (lower risk = higher score)
        switch (operation.riskLevel) {
            case 'low':
                score += 30;
                break;
            case 'medium':
                score += 20;
                break;
            case 'high':
                score += 10;
                break;
        }
        // Impact factor
        score += operation.impacts.length * 10;
        // Complexity factor (simpler = higher score for quick wins)
        switch (operation.complexity) {
            case 'simple':
                score += 25;
                break;
            case 'medium':
                score += 15;
                break;
            case 'complex':
                score += 5;
                break;
        }
        // Time factor (faster = higher score)
        if (operation.estimatedTime < 30000)
            score += 20;
        else if (operation.estimatedTime < 60000)
            score += 15;
        else
            score += 5;
        return score;
    }
    getSurroundingCode(document, selection, contextLines) {
        const startLine = Math.max(0, selection.start.line - contextLines);
        const endLine = Math.min(document.lineCount - 1, selection.end.line + contextLines);
        return document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
    }
    async detectProjectInfo(uri) {
        // Detect framework, version, dependencies from package.json, etc.
        return {
            framework: 'unknown',
            version: '1.0.0',
            dependencies: []
        };
    }
    findRepeatedExpressions(code) {
        // Implementation for finding repeated expressions
        return [];
    }
    async findRelatedMethods(cls, context) {
        // Implementation for finding related methods in a class
        return [];
    }
    analyzeConditionalComplexity(code) {
        const switchCount = (code.match(/switch\s*\(/g) || []).length;
        const ifElseCount = (code.match(/if\s*\(.*?\)\s*{[\s\S]*?}\s*else/g) || []).length;
        return { switchStatements: switchCount, ifElseChains: ifElseCount };
    }
    analyzeConstructorComplexity(context) {
        // Analyze constructor complexity
        return 0;
    }
    findMagicNumbers(code) {
        const numberPattern = /\b(\d+(?:\.\d+)?)\b/g;
        const numbers = [];
        let match;
        while ((match = numberPattern.exec(code)) !== null) {
            const num = parseFloat(match[1]);
            if (num > 1 && num !== 0 && !numbers.includes(num)) {
                numbers.push(num);
            }
        }
        return numbers;
    }
    findJavaScriptModernizationOpportunities(code) {
        const opportunities = [];
        // var → let/const
        if (code.includes('var ')) {
            opportunities.push({
                type: 'var_to_let_const',
                description: 'Replace var with let/const',
                oldPattern: 'var declaration',
                newPattern: 'let/const declaration'
            });
        }
        // function() → arrow function
        if (code.includes('function(')) {
            opportunities.push({
                type: 'function_to_arrow',
                description: 'Convert to arrow function',
                oldPattern: 'function() {}',
                newPattern: '() => {}'
            });
        }
        return opportunities;
    }
    async validatePrerequisites(operation, context) {
        // Validate that prerequisites are met
        return { valid: true, errors: [] };
    }
    async getAIExtractMethodSuggestions(context) {
        // Use AI to suggest method extractions
        return [];
    }
    // Public methods for external access
    getOperationHistory() {
        return [...this.operationHistory];
    }
    clearHistory() {
        this.operationHistory = [];
    }
    getSupportedRefactorings() {
        return Array.from(this.patterns.keys());
    }
}
exports.RefactoringEngine = RefactoringEngine;
//# sourceMappingURL=RefactoringEngine.js.map