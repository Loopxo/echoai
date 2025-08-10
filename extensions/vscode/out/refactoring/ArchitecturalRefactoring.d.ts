import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { CodebaseIndexer } from '../services/CodebaseIndexer';
import { RefactoringEngine } from './RefactoringEngine';
export interface ArchitecturalPattern {
    name: string;
    type: 'mvc' | 'mvp' | 'mvvm' | 'clean' | 'hexagonal' | 'layered' | 'microservices' | 'component' | 'modules';
    description: string;
    benefits: string[];
    complexity: 'simple' | 'medium' | 'complex';
    applicability: string[];
    implementation: {
        files: string[];
        directories: string[];
        dependencies: string[];
    };
}
export interface ArchitecturalAnalysis {
    currentPattern: string | null;
    issues: ArchitecturalIssue[];
    suggestions: ArchitecturalSuggestion[];
    metrics: {
        coupling: number;
        cohesion: number;
        complexity: number;
        maintainability: number;
        testability: number;
    };
    codeSmells: string[];
}
export interface ArchitecturalIssue {
    type: 'coupling' | 'cohesion' | 'separation' | 'dependency' | 'complexity' | 'responsibility';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location: {
        files: string[];
        classes: string[];
        methods: string[];
    };
    impact: string;
    effort: 'low' | 'medium' | 'high';
}
export interface ArchitecturalSuggestion {
    pattern: ArchitecturalPattern;
    confidence: number;
    benefits: string[];
    migrationSteps: MigrationStep[];
    estimatedTime: number;
    riskLevel: 'low' | 'medium' | 'high';
}
export interface MigrationStep {
    id: string;
    name: string;
    description: string;
    type: 'create' | 'move' | 'refactor' | 'delete' | 'configure';
    order: number;
    dependencies: string[];
    estimatedTime: number;
    files: string[];
    automated: boolean;
}
export declare class ArchitecturalRefactoring {
    private echoProvider;
    private codebaseIndexer;
    private refactoringEngine;
    private patterns;
    private analysisCache;
    private readonly CACHE_DURATION;
    constructor(echoProvider: EchoAIProvider, codebaseIndexer: CodebaseIndexer, refactoringEngine: RefactoringEngine);
    analyzeArchitecture(workspaceFolder?: vscode.WorkspaceFolder): Promise<ArchitecturalAnalysis>;
    suggestArchitecturalRefactoring(analysis: ArchitecturalAnalysis): Promise<ArchitecturalSuggestion[]>;
    executeMigrationPlan(suggestion: ArchitecturalSuggestion): Promise<vscode.WorkspaceEdit>;
    private detectCurrentPattern;
    private analyzeCoupling;
    private analyzeCohesion;
    private analyzeComplexity;
    private analyzeDependencies;
    private detectCodeSmells;
    private identifyArchitecturalIssues;
    private generateArchitecturalSuggestions;
    private calculateMaintainabilityScore;
    private calculateTestabilityScore;
    private analyzeFileStructure;
    private analyzeProjectCharacteristics;
    private calculatePatternConfidence;
    private generateMigrationPlan;
    private calculateBenefits;
    private assessRiskLevel;
    private executeMigrationStep;
    private createDirectories;
    private moveFiles;
    private refactorFiles;
    private initializePatterns;
    private isCacheValid;
    getAvailablePatterns(): ArchitecturalPattern[];
    clearCache(): void;
}
//# sourceMappingURL=ArchitecturalRefactoring.d.ts.map