import * as vscode from 'vscode';
import { EchoAIProvider } from '../providers/EchoAIProvider';
import { CodebaseIndexer, IndexedFile } from '../services/CodebaseIndexer';
import { RefactoringEngine, RefactoringOperation } from './RefactoringEngine';

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

export class ArchitecturalRefactoring {
    private echoProvider: EchoAIProvider;
    private codebaseIndexer: CodebaseIndexer;
    private refactoringEngine: RefactoringEngine;
    
    // Known architectural patterns
    private patterns: Map<string, ArchitecturalPattern> = new Map();
    
    // Analysis cache
    private analysisCache: Map<string, ArchitecturalAnalysis> = new Map();
    private readonly CACHE_DURATION = 600000; // 10 minutes

    constructor(echoProvider: EchoAIProvider, codebaseIndexer: CodebaseIndexer, refactoringEngine: RefactoringEngine) {
        this.echoProvider = echoProvider;
        this.codebaseIndexer = codebaseIndexer;
        this.refactoringEngine = refactoringEngine;
        
        this.initializePatterns();
    }

    async analyzeArchitecture(workspaceFolder?: vscode.WorkspaceFolder): Promise<ArchitecturalAnalysis> {
        const cacheKey = workspaceFolder?.uri.toString() || 'workspace';
        
        // Check cache
        const cached = this.analysisCache.get(cacheKey);
        if (cached && this.isCacheValid(cacheKey)) {
            return cached;
        }

        try {
            const stats = this.codebaseIndexer.getStats();
            
            // Parallel analysis of different architectural aspects
            const [
                currentPattern,
                couplingAnalysis,
                cohesionAnalysis,
                complexityAnalysis,
                dependencyAnalysis,
                codeSmells
            ] = await Promise.allSettled([
                this.detectCurrentPattern(),
                this.analyzeCoupling(),
                this.analyzeCohesion(),
                this.analyzeComplexity(),
                this.analyzeDependencies(),
                this.detectCodeSmells()
            ]);

            const analysis: ArchitecturalAnalysis = {
                currentPattern: currentPattern.status === 'fulfilled' ? currentPattern.value : null,
                issues: await this.identifyArchitecturalIssues(),
                suggestions: await this.generateArchitecturalSuggestions(),
                metrics: {
                    coupling: couplingAnalysis.status === 'fulfilled' ? couplingAnalysis.value : 0,
                    cohesion: cohesionAnalysis.status === 'fulfilled' ? cohesionAnalysis.value : 0,
                    complexity: complexityAnalysis.status === 'fulfilled' ? complexityAnalysis.value : stats.averageComplexity,
                    maintainability: this.calculateMaintainabilityScore(),
                    testability: this.calculateTestabilityScore()
                },
                codeSmells: codeSmells.status === 'fulfilled' ? codeSmells.value : []
            };

            // Cache the result
            this.analysisCache.set(cacheKey, analysis);
            
            return analysis;

        } catch (error) {
            console.error('Architectural analysis failed:', error);
            
            // Return minimal analysis
            return {
                currentPattern: null,
                issues: [],
                suggestions: [],
                metrics: { coupling: 0, cohesion: 0, complexity: 0, maintainability: 0, testability: 0 },
                codeSmells: []
            };
        }
    }

    async suggestArchitecturalRefactoring(analysis: ArchitecturalAnalysis): Promise<ArchitecturalSuggestion[]> {
        const suggestions: ArchitecturalSuggestion[] = [];
        
        // Analyze project characteristics
        const projectCharacteristics = await this.analyzeProjectCharacteristics();
        
        // Generate suggestions based on issues and project type
        for (const [patternName, pattern] of this.patterns) {
            const confidence = this.calculatePatternConfidence(pattern, analysis, projectCharacteristics);
            
            if (confidence > 60) { // Only suggest patterns with good confidence
                const migrationSteps = await this.generateMigrationPlan(pattern, analysis);
                
                suggestions.push({
                    pattern,
                    confidence,
                    benefits: this.calculateBenefits(pattern, analysis),
                    migrationSteps,
                    estimatedTime: migrationSteps.reduce((total, step) => total + step.estimatedTime, 0),
                    riskLevel: this.assessRiskLevel(pattern, analysis, migrationSteps)
                });
            }
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    async executeMigrationPlan(suggestion: ArchitecturalSuggestion): Promise<vscode.WorkspaceEdit> {
        const workspaceEdit = new vscode.WorkspaceEdit();
        
        // Execute migration steps in order
        const sortedSteps = suggestion.migrationSteps.sort((a, b) => a.order - b.order);
        
        for (const step of sortedSteps) {
            try {
                await this.executeMigrationStep(step, workspaceEdit);
            } catch (error) {
                console.error(`Migration step ${step.name} failed:`, error);
                // Continue with other steps or abort based on severity
            }
        }

        return workspaceEdit;
    }

    private async detectCurrentPattern(): Promise<string | null> {
        const stats = this.codebaseIndexer.getStats();
        
        // Analyze file structure and naming patterns
        const fileStructure = await this.analyzeFileStructure();
        
        const prompt = `Analyze this project structure and identify the architectural pattern:

File structure:
${JSON.stringify(fileStructure, null, 2)}

Project stats:
- Total files: ${stats.totalFiles}
- Languages: ${Array.from(stats.languageDistribution.keys()).join(', ')}
- Average complexity: ${stats.averageComplexity.toFixed(2)}

Common patterns to consider:
- MVC (Model-View-Controller)
- MVP (Model-View-Presenter)
- MVVM (Model-View-ViewModel)
- Clean Architecture
- Hexagonal Architecture
- Layered Architecture
- Component-based
- Module-based

Return the most likely architectural pattern name or "mixed/unclear" if no clear pattern.`;

        try {
            const response = await this.echoProvider.getCompletion(prompt, '', 'analysis', 500);
            return response.trim().toLowerCase();
        } catch (error) {
            return null;
        }
    }

    private async analyzeCoupling(): Promise<number> {
        // Analyze coupling between modules/classes
        const stats = this.codebaseIndexer.getStats();
        
        let totalDependencies = 0;
        let fileCount = 0;
        
        // Simplified coupling analysis based on imports
        for (let i = 0; i < Math.min(stats.indexedFiles, 100); i++) {
            // In real implementation, iterate through indexed files
            // For now, use average estimate
            totalDependencies += 5; // Average dependencies per file
            fileCount++;
        }
        
        // Coupling score: lower is better (0-100 scale)
        const averageDependencies = fileCount > 0 ? totalDependencies / fileCount : 0;
        return Math.min(100, averageDependencies * 10);
    }

    private async analyzeCohesion(): Promise<number> {
        // Analyze cohesion within modules/classes
        const stats = this.codebaseIndexer.getStats();
        
        // Simplified cohesion analysis
        // In real implementation, would analyze method relationships within classes
        const avgFunctionsPerFile = stats.totalFiles > 0 ? 
            stats.mostComplexFunctions.length / Math.min(stats.totalFiles, 100) : 0;
        
        // Cohesion score: higher is better (0-100 scale)
        return Math.max(0, Math.min(100, 100 - (avgFunctionsPerFile * 5)));
    }

    private async analyzeComplexity(): Promise<number> {
        const stats = this.codebaseIndexer.getStats();
        return stats.averageComplexity;
    }

    private async analyzeDependencies(): Promise<void> {
        // Analyze dependency structure
        // Implementation would analyze import/export relationships
    }

    private async detectCodeSmells(): Promise<string[]> {
        const smells: string[] = [];
        const stats = this.codebaseIndexer.getStats();
        
        // God Object detection
        if (stats.largestFiles.length > 0) {
            const largestFile = stats.largestFiles[0];
            if (largestFile.size > 50000) { // 50KB+ files
                smells.push('God Object: Very large files detected');
            }
        }
        
        // Feature Envy detection through AI analysis
        try {
            const prompt = `Analyze this codebase for architectural code smells:

Stats:
- Total files: ${stats.totalFiles}
- Average complexity: ${stats.averageComplexity}
- Largest files: ${stats.largestFiles.slice(0, 3).map(f => f.uri.fsPath).join(', ')}

Identify these code smells:
1. God Object
2. Feature Envy
3. Inappropriate Intimacy
4. Large Class
5. Long Method
6. Duplicate Code
7. Dead Code
8. Spaghetti Code

Return a JSON array of detected smells with descriptions:
[{"smell": "smell name", "description": "description of the issue"}]

Only return JSON, no other text.`;

            const response = await this.echoProvider.getCompletion(prompt, '', 'analysis', 600);
            const aiSmells = JSON.parse(response);
            
            aiSmells.forEach((smell: any) => {
                smells.push(`${smell.smell}: ${smell.description}`);
            });
        } catch (error) {
            // Continue with static analysis results
        }
        
        return smells;
    }

    private async identifyArchitecturalIssues(): Promise<ArchitecturalIssue[]> {
        const issues: ArchitecturalIssue[] = [];
        const stats = this.codebaseIndexer.getStats();
        
        // High coupling issue
        const couplingScore = await this.analyzeCoupling();
        if (couplingScore > 70) {
            issues.push({
                type: 'coupling',
                severity: 'high',
                description: 'High coupling detected between modules. Classes are too dependent on each other.',
                location: {
                    files: stats.largestFiles.slice(0, 5).map(f => f.uri.fsPath),
                    classes: [],
                    methods: []
                },
                impact: 'Reduced maintainability and testability',
                effort: 'high'
            });
        }
        
        // Low cohesion issue
        const cohesionScore = await this.analyzeCohesion();
        if (cohesionScore < 30) {
            issues.push({
                type: 'cohesion',
                severity: 'medium',
                description: 'Low cohesion detected within modules. Classes may have multiple responsibilities.',
                location: {
                    files: [],
                    classes: [],
                    methods: []
                },
                impact: 'Code is harder to understand and maintain',
                effort: 'medium'
            });
        }
        
        // Complexity issue
        if (stats.averageComplexity > 15) {
            issues.push({
                type: 'complexity',
                severity: 'high',
                description: `High average complexity (${stats.averageComplexity.toFixed(1)}). Code is difficult to understand and test.`,
                location: {
                    files: stats.largestFiles.slice(0, 3).map(f => f.uri.fsPath),
                    classes: [],
                    methods: stats.mostComplexFunctions.slice(0, 5).map(f => f.name)
                },
                impact: 'Increased bug risk and maintenance cost',
                effort: 'high'
            });
        }

        return issues;
    }

    private async generateArchitecturalSuggestions(): Promise<ArchitecturalSuggestion[]> {
        // Generate suggestions based on analysis
        return [];
    }

    private calculateMaintainabilityScore(): number {
        // Calculate maintainability index
        return 75; // Placeholder
    }

    private calculateTestabilityScore(): number {
        // Calculate testability score
        return 60; // Placeholder
    }

    private async analyzeFileStructure(): Promise<any> {
        const stats = this.codebaseIndexer.getStats();
        
        // Build file structure representation
        const structure = {
            totalFiles: stats.totalFiles,
            languages: Array.from(stats.languageDistribution.entries()),
            directories: [], // Would analyze directory structure
            patterns: [] // Would detect naming patterns
        };
        
        return structure;
    }

    private async analyzeProjectCharacteristics(): Promise<any> {
        const stats = this.codebaseIndexer.getStats();
        
        return {
            size: stats.totalFiles < 50 ? 'small' : stats.totalFiles < 200 ? 'medium' : 'large',
            complexity: stats.averageComplexity < 5 ? 'low' : stats.averageComplexity < 10 ? 'medium' : 'high',
            languages: Array.from(stats.languageDistribution.keys()),
            domain: 'web' // Would detect based on dependencies and file patterns
        };
    }

    private calculatePatternConfidence(
        pattern: ArchitecturalPattern, 
        analysis: ArchitecturalAnalysis, 
        characteristics: any
    ): number {
        let confidence = 50; // Base confidence
        
        // Adjust based on project size
        if (characteristics.size === 'large' && pattern.complexity === 'complex') {
            confidence += 20;
        } else if (characteristics.size === 'small' && pattern.complexity === 'simple') {
            confidence += 20;
        }
        
        // Adjust based on current issues
        if (analysis.metrics.coupling > 70 && pattern.benefits.includes('Reduced coupling')) {
            confidence += 15;
        }
        
        if (analysis.metrics.complexity > 15 && pattern.benefits.includes('Simplified architecture')) {
            confidence += 15;
        }
        
        // Adjust based on language
        if (characteristics.languages.includes('typescript') && pattern.applicability.includes('typescript')) {
            confidence += 10;
        }
        
        return Math.min(100, Math.max(0, confidence));
    }

    private async generateMigrationPlan(pattern: ArchitecturalPattern, analysis: ArchitecturalAnalysis): Promise<MigrationStep[]> {
        const steps: MigrationStep[] = [];
        
        // Generate migration steps based on pattern
        switch (pattern.type) {
            case 'mvc':
                steps.push(
                    {
                        id: 'create_mvc_structure',
                        name: 'Create MVC Directory Structure',
                        description: 'Create models, views, and controllers directories',
                        type: 'create',
                        order: 1,
                        dependencies: [],
                        estimatedTime: 30000,
                        files: ['models/', 'views/', 'controllers/'],
                        automated: true
                    },
                    {
                        id: 'extract_models',
                        name: 'Extract Models',
                        description: 'Move data-related classes to models directory',
                        type: 'move',
                        order: 2,
                        dependencies: ['create_mvc_structure'],
                        estimatedTime: 120000,
                        files: [],
                        automated: false
                    }
                );
                break;
                
            case 'clean':
                steps.push(
                    {
                        id: 'create_clean_layers',
                        name: 'Create Clean Architecture Layers',
                        description: 'Create domain, application, infrastructure, and presentation layers',
                        type: 'create',
                        order: 1,
                        dependencies: [],
                        estimatedTime: 60000,
                        files: ['domain/', 'application/', 'infrastructure/', 'presentation/'],
                        automated: true
                    }
                );
                break;
        }
        
        return steps;
    }

    private calculateBenefits(pattern: ArchitecturalPattern, analysis: ArchitecturalAnalysis): string[] {
        const benefits = [...pattern.benefits];
        
        // Add specific benefits based on current issues
        if (analysis.metrics.coupling > 70) {
            benefits.push('Significant reduction in coupling');
        }
        
        if (analysis.metrics.testability < 50) {
            benefits.push('Improved testability');
        }
        
        return benefits;
    }

    private assessRiskLevel(
        pattern: ArchitecturalPattern, 
        analysis: ArchitecturalAnalysis, 
        steps: MigrationStep[]
    ): 'low' | 'medium' | 'high' {
        let riskScore = 0;
        
        // Risk based on pattern complexity
        switch (pattern.complexity) {
            case 'simple': riskScore += 1; break;
            case 'medium': riskScore += 2; break;
            case 'complex': riskScore += 3; break;
        }
        
        // Risk based on number of files to change
        const filesToChange = steps.reduce((total, step) => total + step.files.length, 0);
        if (filesToChange > 50) riskScore += 2;
        else if (filesToChange > 20) riskScore += 1;
        
        // Risk based on non-automated steps
        const manualSteps = steps.filter(step => !step.automated).length;
        riskScore += manualSteps;
        
        if (riskScore <= 2) return 'low';
        if (riskScore <= 4) return 'medium';
        return 'high';
    }

    private async executeMigrationStep(step: MigrationStep, workspaceEdit: vscode.WorkspaceEdit): Promise<void> {
        switch (step.type) {
            case 'create':
                await this.createDirectories(step.files, workspaceEdit);
                break;
            case 'move':
                await this.moveFiles(step.files, workspaceEdit);
                break;
            case 'refactor':
                await this.refactorFiles(step.files, workspaceEdit);
                break;
            // Add more step types as needed
        }
    }

    private async createDirectories(paths: string[], workspaceEdit: vscode.WorkspaceEdit): Promise<void> {
        // Implementation for creating directories
    }

    private async moveFiles(files: string[], workspaceEdit: vscode.WorkspaceEdit): Promise<void> {
        // Implementation for moving files
    }

    private async refactorFiles(files: string[], workspaceEdit: vscode.WorkspaceEdit): Promise<void> {
        // Implementation for refactoring files
    }

    private initializePatterns(): void {
        // MVC Pattern
        this.patterns.set('mvc', {
            name: 'Model-View-Controller (MVC)',
            type: 'mvc',
            description: 'Separates application logic into three interconnected components',
            benefits: [
                'Clear separation of concerns',
                'Improved maintainability',
                'Better testability',
                'Reusable components'
            ],
            complexity: 'medium',
            applicability: ['web applications', 'desktop applications', 'typescript', 'javascript'],
            implementation: {
                files: ['models/', 'views/', 'controllers/'],
                directories: ['src/models', 'src/views', 'src/controllers'],
                dependencies: []
            }
        });

        // Clean Architecture
        this.patterns.set('clean', {
            name: 'Clean Architecture',
            type: 'clean',
            description: 'Organizes code into concentric layers with dependency inversion',
            benefits: [
                'Framework independence',
                'Testable architecture',
                'UI independence',
                'Database independence',
                'Dependency rule enforcement'
            ],
            complexity: 'complex',
            applicability: ['large applications', 'enterprise systems', 'typescript', 'java'],
            implementation: {
                files: ['domain/', 'application/', 'infrastructure/', 'presentation/'],
                directories: ['src/domain', 'src/application', 'src/infrastructure', 'src/presentation'],
                dependencies: ['dependency injection']
            }
        });

        // Component-based Architecture
        this.patterns.set('component', {
            name: 'Component-based Architecture',
            type: 'component',
            description: 'Organizes code into reusable, self-contained components',
            benefits: [
                'High reusability',
                'Modular design',
                'Easy maintenance',
                'Parallel development'
            ],
            complexity: 'simple',
            applicability: ['React', 'Vue', 'Angular', 'web components'],
            implementation: {
                files: ['components/', 'hooks/', 'services/'],
                directories: ['src/components', 'src/hooks', 'src/services'],
                dependencies: []
            }
        });
    }

    private isCacheValid(cacheKey: string): boolean {
        // Implementation for cache validation
        return false; // Simplified
    }

    // Public methods
    public getAvailablePatterns(): ArchitecturalPattern[] {
        return Array.from(this.patterns.values());
    }

    public clearCache(): void {
        this.analysisCache.clear();
    }
}