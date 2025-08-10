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
exports.IncrementalAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const AdvancedDiagnosticsProvider_1 = require("../providers/AdvancedDiagnosticsProvider");
class IncrementalAnalyzer {
    codebaseIndexer;
    advancedDiagnostics;
    analysisQueue = [];
    isProcessing = false;
    dependencyGraph = new Map();
    analysisCache = new Map();
    activeAnalyses = new Set();
    // Performance optimization settings
    MAX_CONCURRENT_ANALYSES = 3;
    ANALYSIS_TIMEOUT = 30000; // 30 seconds
    CACHE_DURATION = 600000; // 10 minutes
    DEPENDENCY_DEPTH = 5;
    BATCH_SIZE = 10;
    // Adaptive analysis settings
    performanceProfile = {
        averageAnalysisTime: 2000,
        successRate: 0.95,
        cacheHitRate: 0.7,
        adaptiveDelay: 1000
    };
    constructor(codebaseIndexer, echoProvider) {
        this.codebaseIndexer = codebaseIndexer;
        this.advancedDiagnostics = new AdvancedDiagnosticsProvider_1.AdvancedDiagnosticsProvider(echoProvider);
        this.startProcessingLoop();
        this.setupPerformanceMonitoring();
    }
    async analyzeFile(uri, priority = 'medium', analysisTypes = ['syntax', 'semantic', 'security', 'performance']) {
        const fileKey = uri.toString();
        // Check if already being analyzed
        if (this.activeAnalyses.has(fileKey)) {
            return;
        }
        // Check cache first
        const cached = this.getCachedResult(fileKey);
        if (cached && !this.needsReanalysis(uri, cached)) {
            this.updatePerformanceMetrics(0, true, false);
            return;
        }
        // Build dependency graph for intelligent ordering
        await this.buildDependencyGraph(uri);
        // Calculate dependencies that might need reanalysis
        const dependencies = this.getDependenciesFromGraph(fileKey);
        const task = {
            id: this.generateTaskId(),
            uri,
            priority,
            analysisTypes,
            timestamp: Date.now(),
            dependencies,
            estimatedTime: this.estimateAnalysisTime(uri, analysisTypes)
        };
        this.enqueueTask(task);
    }
    async analyzeWorkspace() {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Incremental Analysis",
            cancellable: true
        }, async (progress, token) => {
            const stats = this.codebaseIndexer.getStats();
            progress.report({ message: `Analyzing ${stats.indexedFiles} files...` });
            // Get all indexed files and prioritize them
            const files = await this.prioritizeFiles();
            let processed = 0;
            // Process in adaptive batches
            for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
                if (token.isCancellationRequested) {
                    break;
                }
                const batch = files.slice(i, i + this.BATCH_SIZE);
                progress.report({
                    message: `Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(files.length / this.BATCH_SIZE)}`,
                    increment: (this.BATCH_SIZE / files.length) * 100
                });
                // Analyze batch with controlled concurrency
                const promises = batch.map(file => this.analyzeFile(file.uri, this.calculatePriority(file), this.selectAnalysisTypes(file)));
                await Promise.all(promises);
                processed += batch.length;
                // Adaptive delay based on performance
                await new Promise(resolve => setTimeout(resolve, this.performanceProfile.adaptiveDelay));
            }
            vscode.window.showInformationMessage(`Incremental analysis complete! Processed ${processed} files with ${this.performanceProfile.cacheHitRate.toFixed(2)} cache hit rate.`);
        });
    }
    async prioritizeFiles() {
        const stats = this.codebaseIndexer.getStats();
        const allFiles = [];
        // Get files by language (prioritize TypeScript/JavaScript)
        const priorityLanguages = ['typescript', 'javascript', 'python', 'java'];
        for (const lang of priorityLanguages) {
            const files = this.codebaseIndexer.findFilesByLanguage(lang);
            allFiles.push(...files);
        }
        // Add remaining files - simplified approach
        // In a real implementation, we'd get all indexed files from the indexer
        const remainingFiles = [];
        // Sort by priority factors
        return allFiles.sort((a, b) => {
            const scoreA = this.calculateFileScore(a);
            const scoreB = this.calculateFileScore(b);
            return scoreB - scoreA;
        });
    }
    calculateFileScore(file) {
        let score = 0;
        // Size factor (smaller files get higher priority for faster feedback)
        score += Math.max(0, 100 - (file.size / 1000));
        // Complexity factor (complex files get medium priority)
        score += file.complexity * 2;
        // Language priority
        const langPriority = {
            'typescript': 50,
            'javascript': 45,
            'python': 40,
            'java': 35,
            'csharp': 30
        };
        score += langPriority[file.languageId] || 20;
        // Function count (more functions = higher priority)
        score += file.functions.length * 3;
        // Recent modification (more recent = higher priority)
        const daysSinceModified = (Date.now() - file.lastModified) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - daysSinceModified);
        return score;
    }
    calculatePriority(file) {
        const score = this.calculateFileScore(file);
        if (score > 150)
            return 'high';
        if (score > 100)
            return 'medium';
        return 'low';
    }
    selectAnalysisTypes(file) {
        const types = ['syntax']; // Always include syntax
        // Add semantic analysis for complex files
        if (file.complexity > 5 || file.functions.length > 5) {
            types.push('semantic', 'logic');
        }
        // Add security analysis for certain file types
        if (['typescript', 'javascript', 'python'].includes(file.languageId)) {
            types.push('security');
        }
        // Add performance analysis for large files
        if (file.size > 10000) {
            types.push('performance');
        }
        return types;
    }
    async buildDependencyGraph(uri) {
        const fileKey = uri.toString();
        const indexed = this.codebaseIndexer.getFileIndex(uri);
        if (!indexed)
            return;
        const dependencies = indexed.imports
            .map(imp => this.resolveImportPath(imp, uri))
            .filter(Boolean);
        const dependents = this.findDependents(fileKey);
        this.dependencyGraph.set(fileKey, {
            file: fileKey,
            dependencies: dependencies.slice(0, this.DEPENDENCY_DEPTH),
            dependents: dependents.slice(0, this.DEPENDENCY_DEPTH),
            analysisOrder: this.calculateAnalysisOrder(dependencies, dependents)
        });
    }
    resolveImportPath(importPath, fromUri) {
        // Simplified import resolution - in practice, this would be more sophisticated
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const fromDir = vscode.Uri.joinPath(fromUri, '..').fsPath;
            const resolvedPath = vscode.Uri.file(require('path').resolve(fromDir, importPath + '.ts')).toString();
            return resolvedPath;
        }
        // For node_modules imports, we might skip them or handle differently
        return null;
    }
    findDependents(fileKey) {
        const dependents = [];
        // Search through all indexed files to find those that import this file
        const stats = this.codebaseIndexer.getStats();
        // This is simplified - in practice we'd iterate through all indexed files
        for (let i = 0; i < Math.min(stats.indexedFiles, 100); i++) {
            // Check if file imports the target file
            // Implementation would check actual imports
        }
        return dependents;
    }
    calculateAnalysisOrder(dependencies, dependents) {
        // Files with fewer dependencies and more dependents should be analyzed first
        return Math.max(0, 100 - dependencies.length + dependents.length);
    }
    enqueueTask(task) {
        // Remove any existing task for the same file
        this.analysisQueue = this.analysisQueue.filter(t => t.uri.toString() !== task.uri.toString());
        // Insert task in priority order
        const insertIndex = this.analysisQueue.findIndex(t => this.getTaskPriority(task) > this.getTaskPriority(t));
        if (insertIndex === -1) {
            this.analysisQueue.push(task);
        }
        else {
            this.analysisQueue.splice(insertIndex, 0, task);
        }
    }
    getTaskPriority(task) {
        const priorityValues = { high: 100, medium: 50, low: 10 };
        const baseScore = priorityValues[task.priority];
        // Adjust based on age (older tasks get higher priority)
        const ageBonus = Math.min(50, (Date.now() - task.timestamp) / 1000);
        // Adjust based on dependencies (fewer dependencies = higher priority)
        const depPenalty = task.dependencies.length * 2;
        return baseScore + ageBonus - depPenalty;
    }
    startProcessingLoop() {
        const processNext = async () => {
            if (this.isProcessing || this.analysisQueue.length === 0) {
                setTimeout(processNext, 1000);
                return;
            }
            this.isProcessing = true;
            try {
                // Process up to MAX_CONCURRENT_ANALYSES tasks
                const activeTasks = Math.min(this.MAX_CONCURRENT_ANALYSES, this.analysisQueue.length);
                const tasks = this.analysisQueue.splice(0, activeTasks);
                const promises = tasks.map(task => this.processTask(task));
                await Promise.allSettled(promises);
            }
            catch (error) {
                console.error('Analysis processing error:', error);
            }
            finally {
                this.isProcessing = false;
                setTimeout(processNext, this.performanceProfile.adaptiveDelay);
            }
        };
        processNext();
    }
    async processTask(task) {
        const startTime = Date.now();
        const fileKey = task.uri.toString();
        this.activeAnalyses.add(fileKey);
        try {
            const document = await vscode.workspace.openTextDocument(task.uri);
            // Perform analysis with timeout
            const analysisPromise = this.advancedDiagnostics.analyzeCode(document);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timeout')), this.ANALYSIS_TIMEOUT));
            const diagnostics = await Promise.race([analysisPromise, timeoutPromise]);
            const analysisTime = Date.now() - startTime;
            const result = {
                taskId: task.id,
                uri: task.uri,
                diagnostics,
                performance: {
                    analysisTime,
                    cacheHits: 0, // Would track actual cache hits
                    cacheMisses: 1
                },
                confidence: this.calculateConfidence(diagnostics, analysisTime),
                needsReanalysis: false
            };
            // Cache the result
            this.cacheResult(fileKey, result);
            // Update performance metrics
            this.updatePerformanceMetrics(analysisTime, false, true);
            // Trigger dependent file analysis if needed
            await this.analyzeAffectedFiles(fileKey);
        }
        catch (error) {
            console.error(`Task ${task.id} failed:`, error);
            this.updatePerformanceMetrics(Date.now() - startTime, false, false);
        }
        finally {
            this.activeAnalyses.delete(fileKey);
        }
    }
    calculateConfidence(diagnostics, analysisTime) {
        let confidence = 100;
        // Reduce confidence for very fast analysis (might be incomplete)
        if (analysisTime < 500) {
            confidence -= 20;
        }
        // Reduce confidence for very slow analysis (might have timed out)
        if (analysisTime > 20000) {
            confidence -= 30;
        }
        // Adjust based on number of diagnostics (reasonable number = higher confidence)
        const diagnosticCount = diagnostics.length;
        if (diagnosticCount === 0) {
            confidence -= 10; // Might have missed issues
        }
        else if (diagnosticCount > 50) {
            confidence -= 20; // Might have false positives
        }
        return Math.max(0, Math.min(100, confidence));
    }
    async analyzeAffectedFiles(changedFile) {
        const dependencyNode = this.dependencyGraph.get(changedFile);
        if (!dependencyNode)
            return;
        // Analyze dependents with lower priority
        for (const dependent of dependencyNode.dependents) {
            const dependentUri = vscode.Uri.parse(dependent);
            await this.analyzeFile(dependentUri, 'low', ['syntax', 'semantic']);
        }
    }
    cacheResult(fileKey, result) {
        this.analysisCache.set(fileKey, {
            result,
            expiry: Date.now() + this.CACHE_DURATION
        });
        // Cleanup expired cache entries
        this.cleanupCache();
    }
    getCachedResult(fileKey) {
        const cached = this.analysisCache.get(fileKey);
        if (!cached || Date.now() > cached.expiry) {
            this.analysisCache.delete(fileKey);
            return null;
        }
        return cached.result;
    }
    needsReanalysis(uri, previousResult) {
        const indexed = this.codebaseIndexer.getFileIndex(uri);
        if (!indexed)
            return true;
        // Check if file has been modified since last analysis
        const resultAge = Date.now() - previousResult.performance.analysisTime;
        return resultAge > this.CACHE_DURATION || previousResult.needsReanalysis;
    }
    getDependenciesFromGraph(fileKey) {
        const dependencyNode = this.dependencyGraph.get(fileKey);
        return dependencyNode ? dependencyNode.dependencies : [];
    }
    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.analysisCache.entries()) {
            if (now > cached.expiry) {
                this.analysisCache.delete(key);
            }
        }
    }
    estimateAnalysisTime(uri, analysisTypes) {
        const indexed = this.codebaseIndexer.getFileIndex(uri);
        if (!indexed)
            return this.performanceProfile.averageAnalysisTime;
        let estimatedTime = 500; // Base time
        // Adjust for file size
        estimatedTime += (indexed.size / 1000) * 50;
        // Adjust for complexity
        estimatedTime += indexed.complexity * 100;
        // Adjust for analysis types
        estimatedTime += analysisTypes.length * 200;
        // Adjust for number of functions
        estimatedTime += indexed.functions.length * 50;
        return Math.min(estimatedTime, this.ANALYSIS_TIMEOUT);
    }
    updatePerformanceMetrics(analysisTime, cacheHit, success) {
        // Update running averages
        this.performanceProfile.averageAnalysisTime =
            (this.performanceProfile.averageAnalysisTime * 0.9) + (analysisTime * 0.1);
        if (cacheHit) {
            this.performanceProfile.cacheHitRate =
                (this.performanceProfile.cacheHitRate * 0.95) + (1 * 0.05);
        }
        else {
            this.performanceProfile.cacheHitRate =
                (this.performanceProfile.cacheHitRate * 0.95) + (0 * 0.05);
        }
        if (success) {
            this.performanceProfile.successRate =
                (this.performanceProfile.successRate * 0.95) + (1 * 0.05);
        }
        else {
            this.performanceProfile.successRate =
                (this.performanceProfile.successRate * 0.95) + (0 * 0.05);
        }
        // Adapt delay based on performance
        if (this.performanceProfile.successRate > 0.9 && this.performanceProfile.averageAnalysisTime < 2000) {
            this.performanceProfile.adaptiveDelay = Math.max(100, this.performanceProfile.adaptiveDelay - 100);
        }
        else if (this.performanceProfile.successRate < 0.8 || this.performanceProfile.averageAnalysisTime > 5000) {
            this.performanceProfile.adaptiveDelay = Math.min(5000, this.performanceProfile.adaptiveDelay + 200);
        }
    }
    setupPerformanceMonitoring() {
        // Log performance metrics every 5 minutes
        setInterval(() => {
            console.log('Incremental Analyzer Performance:', {
                queueSize: this.analysisQueue.length,
                activeAnalyses: this.activeAnalyses.size,
                cacheSize: this.analysisCache.size,
                averageTime: Math.round(this.performanceProfile.averageAnalysisTime),
                cacheHitRate: (this.performanceProfile.cacheHitRate * 100).toFixed(1) + '%',
                successRate: (this.performanceProfile.successRate * 100).toFixed(1) + '%',
                adaptiveDelay: this.performanceProfile.adaptiveDelay
            });
        }, 300000); // 5 minutes
    }
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Public methods for external access
    getQueueStatus() {
        return {
            size: this.analysisQueue.length,
            processing: this.isProcessing,
            activeCount: this.activeAnalyses.size
        };
    }
    getPerformanceMetrics() {
        return { ...this.performanceProfile };
    }
    clearCache() {
        this.analysisCache.clear();
    }
    dispose() {
        this.analysisQueue = [];
        this.activeAnalyses.clear();
        this.analysisCache.clear();
        this.dependencyGraph.clear();
    }
}
exports.IncrementalAnalyzer = IncrementalAnalyzer;
//# sourceMappingURL=IncrementalAnalyzer.js.map