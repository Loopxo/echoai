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
exports.ArchitecturalRefactoring = void 0;
const vscode = __importStar(require("vscode"));
class ArchitecturalRefactoring {
    echoProvider;
    codebaseIndexer;
    refactoringEngine;
    // Known architectural patterns
    patterns = new Map();
    // Analysis cache
    analysisCache = new Map();
    CACHE_DURATION = 600000; // 10 minutes
    constructor(echoProvider, codebaseIndexer, refactoringEngine) {
        this.echoProvider = echoProvider;
        this.codebaseIndexer = codebaseIndexer;
        this.refactoringEngine = refactoringEngine;
        this.initializePatterns();
    }
    async analyzeArchitecture(workspaceFolder) {
        const cacheKey = workspaceFolder?.uri.toString() || 'workspace';
        // Check cache
        const cached = this.analysisCache.get(cacheKey);
        if (cached && this.isCacheValid(cacheKey)) {
            return cached;
        }
        try {
            const stats = this.codebaseIndexer.getStats();
            // Parallel analysis of different architectural aspects
            const [currentPattern, couplingAnalysis, cohesionAnalysis, complexityAnalysis, dependencyAnalysis, codeSmells] = await Promise.allSettled([
                this.detectCurrentPattern(),
                this.analyzeCoupling(),
                this.analyzeCohesion(),
                this.analyzeComplexity(),
                this.analyzeDependencies(),
                this.detectCodeSmells()
            ]);
            const analysis = {
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
        }
        catch (error) {
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
    async suggestArchitecturalRefactoring(analysis) {
        const suggestions = [];
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
    async executeMigrationPlan(suggestion) {
        const workspaceEdit = new vscode.WorkspaceEdit();
        // Execute migration steps in order
        const sortedSteps = suggestion.migrationSteps.sort((a, b) => a.order - b.order);
        for (const step of sortedSteps) {
            try {
                await this.executeMigrationStep(step, workspaceEdit);
            }
            catch (error) {
                console.error(`Migration step ${step.name} failed:`, error);
                // Continue with other steps or abort based on severity
            }
        }
        return workspaceEdit;
    }
    async detectCurrentPattern() {
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
        }
        catch (error) {
            return null;
        }
    }
    async analyzeCoupling() {
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
    async analyzeCohesion() {
        // Analyze cohesion within modules/classes
        const stats = this.codebaseIndexer.getStats();
        // Simplified cohesion analysis
        // In real implementation, would analyze method relationships within classes
        const avgFunctionsPerFile = stats.totalFiles > 0 ?
            stats.mostComplexFunctions.length / Math.min(stats.totalFiles, 100) : 0;
        // Cohesion score: higher is better (0-100 scale)
        return Math.max(0, Math.min(100, 100 - (avgFunctionsPerFile * 5)));
    }
    async analyzeComplexity() {
        const stats = this.codebaseIndexer.getStats();
        return stats.averageComplexity;
    }
    async analyzeDependencies() {
        // Analyze dependency structure
        // Implementation would analyze import/export relationships
    }
    async detectCodeSmells() {
        const smells = [];
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
            aiSmells.forEach((smell) => {
                smells.push(`${smell.smell}: ${smell.description}`);
            });
        }
        catch (error) {
            // Continue with static analysis results
        }
        return smells;
    }
    async identifyArchitecturalIssues() {
        const issues = [];
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
    async generateArchitecturalSuggestions() {
        // Generate suggestions based on analysis
        return [];
    }
    calculateMaintainabilityScore() {
        // Calculate maintainability index
        return 75; // Placeholder
    }
    calculateTestabilityScore() {
        // Calculate testability score
        return 60; // Placeholder
    }
    async analyzeFileStructure() {
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
    async analyzeProjectCharacteristics() {
        const stats = this.codebaseIndexer.getStats();
        return {
            size: stats.totalFiles < 50 ? 'small' : stats.totalFiles < 200 ? 'medium' : 'large',
            complexity: stats.averageComplexity < 5 ? 'low' : stats.averageComplexity < 10 ? 'medium' : 'high',
            languages: Array.from(stats.languageDistribution.keys()),
            domain: 'web' // Would detect based on dependencies and file patterns
        };
    }
    calculatePatternConfidence(pattern, analysis, characteristics) {
        let confidence = 50; // Base confidence
        // Adjust based on project size
        if (characteristics.size === 'large' && pattern.complexity === 'complex') {
            confidence += 20;
        }
        else if (characteristics.size === 'small' && pattern.complexity === 'simple') {
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
    async generateMigrationPlan(pattern, analysis) {
        const steps = [];
        // Generate migration steps based on pattern
        switch (pattern.type) {
            case 'mvc':
                steps.push({
                    id: 'create_mvc_structure',
                    name: 'Create MVC Directory Structure',
                    description: 'Create models, views, and controllers directories',
                    type: 'create',
                    order: 1,
                    dependencies: [],
                    estimatedTime: 30000,
                    files: ['models/', 'views/', 'controllers/'],
                    automated: true
                }, {
                    id: 'extract_models',
                    name: 'Extract Models',
                    description: 'Move data-related classes to models directory',
                    type: 'move',
                    order: 2,
                    dependencies: ['create_mvc_structure'],
                    estimatedTime: 120000,
                    files: [],
                    automated: false
                });
                break;
            case 'clean':
                steps.push({
                    id: 'create_clean_layers',
                    name: 'Create Clean Architecture Layers',
                    description: 'Create domain, application, infrastructure, and presentation layers',
                    type: 'create',
                    order: 1,
                    dependencies: [],
                    estimatedTime: 60000,
                    files: ['domain/', 'application/', 'infrastructure/', 'presentation/'],
                    automated: true
                });
                break;
        }
        return steps;
    }
    calculateBenefits(pattern, analysis) {
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
    assessRiskLevel(pattern, analysis, steps) {
        let riskScore = 0;
        // Risk based on pattern complexity
        switch (pattern.complexity) {
            case 'simple':
                riskScore += 1;
                break;
            case 'medium':
                riskScore += 2;
                break;
            case 'complex':
                riskScore += 3;
                break;
        }
        // Risk based on number of files to change
        const filesToChange = steps.reduce((total, step) => total + step.files.length, 0);
        if (filesToChange > 50)
            riskScore += 2;
        else if (filesToChange > 20)
            riskScore += 1;
        // Risk based on non-automated steps
        const manualSteps = steps.filter(step => !step.automated).length;
        riskScore += manualSteps;
        if (riskScore <= 2)
            return 'low';
        if (riskScore <= 4)
            return 'medium';
        return 'high';
    }
    async executeMigrationStep(step, workspaceEdit) {
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
    async createDirectories(paths, workspaceEdit) {
        // Implementation for creating directories
    }
    async moveFiles(files, workspaceEdit) {
        // Implementation for moving files
    }
    async refactorFiles(files, workspaceEdit) {
        // Implementation for refactoring files
    }
    initializePatterns() {
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
    isCacheValid(cacheKey) {
        // Implementation for cache validation
        return false; // Simplified
    }
    // Public methods
    getAvailablePatterns() {
        return Array.from(this.patterns.values());
    }
    clearCache() {
        this.analysisCache.clear();
    }
}
exports.ArchitecturalRefactoring = ArchitecturalRefactoring;
//# sourceMappingURL=ArchitecturalRefactoring.js.map