import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { CodebaseIndexer, SymbolInfo } from '../services/CodebaseIndexer';
import { FunctionInfo, ClassInfo } from '../utils/CodeAnalyzer';
export interface RefactoringOperation {
    id: string;
    type: RefactoringType;
    name: string;
    description: string;
    scope: 'selection' | 'function' | 'class' | 'file' | 'project';
    complexity: 'simple' | 'medium' | 'complex';
    estimatedTime: number;
    riskLevel: 'low' | 'medium' | 'high';
    prerequisites: string[];
    impacts: string[];
    preview: boolean;
}
export type RefactoringType = 'extract_method' | 'extract_variable' | 'extract_class' | 'inline_method' | 'inline_variable' | 'rename_symbol' | 'move_method' | 'move_class' | 'introduce_parameter' | 'remove_parameter' | 'change_method_signature' | 'extract_interface' | 'push_down_method' | 'pull_up_method' | 'replace_conditional_with_polymorphism' | 'decompose_conditional' | 'consolidate_conditional' | 'replace_magic_numbers' | 'encapsulate_field' | 'replace_inheritance_with_delegation' | 'replace_delegation_with_inheritance' | 'introduce_design_pattern' | 'modernize_syntax' | 'optimize_performance' | 'improve_readability';
export interface RefactoringResult {
    operation: RefactoringOperation;
    success: boolean;
    changes: vscode.WorkspaceEdit;
    affectedFiles: vscode.Uri[];
    warnings: string[];
    errors: string[];
    previewHtml?: string;
    confidence: number;
    executionTime: number;
}
export interface RefactoringContext {
    document: vscode.TextDocument;
    selection: vscode.Range;
    cursorPosition: vscode.Position;
    selectedText: string;
    surroundingCode: string;
    symbols: SymbolInfo[];
    functions: FunctionInfo[];
    classes: ClassInfo[];
    languageId: string;
    projectInfo: {
        framework?: string;
        version?: string;
        dependencies?: string[];
    };
}
export declare class RefactoringEngine {
    private echoProvider;
    private codebaseIndexer;
    private codeAnalyzer;
    private operationHistory;
    private patterns;
    private analysisCache;
    private readonly CACHE_DURATION;
    constructor(echoProvider: EchoAIProvider, codebaseIndexer: CodebaseIndexer);
    analyzeRefactoringOpportunities(document: vscode.TextDocument): Promise<RefactoringOperation[]>;
    executeRefactoring(operation: RefactoringOperation, context: RefactoringContext): Promise<RefactoringResult>;
    buildRefactoringContext(document: vscode.TextDocument): Promise<RefactoringContext>;
    private analyzeExtractMethodOpportunities;
    private analyzeExtractVariableOpportunities;
    private analyzeExtractClassOpportunities;
    private analyzeDesignPatternOpportunities;
    private analyzePerformanceOptimizations;
    private analyzeCodeSmellFixes;
    private analyzeModernizationOpportunities;
    private executeSpecificRefactoring;
    private executeExtractMethod;
    private executeExtractVariable;
    private executeExtractClass;
    private executeIntroduceDesignPattern;
    private executePerformanceOptimization;
    private executeReplaceMagicNumbers;
    private executeModernizeSyntax;
    private initializePatterns;
    private calculateOpportunityScore;
    private getSurroundingCode;
    private detectProjectInfo;
    private findRepeatedExpressions;
    private findRelatedMethods;
    private analyzeConditionalComplexity;
    private analyzeConstructorComplexity;
    private findMagicNumbers;
    private findJavaScriptModernizationOpportunities;
    private validatePrerequisites;
    private getAIExtractMethodSuggestions;
    getOperationHistory(): RefactoringResult[];
    clearHistory(): void;
    getSupportedRefactorings(): RefactoringType[];
}
//# sourceMappingURL=RefactoringEngine.d.ts.map