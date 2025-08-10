import * as vscode from 'vscode';
import { CodebaseIndexer } from './CodebaseIndexer';
import { EchoAIProvider } from '../providers/EchoAIProvider';
export interface AnalysisTask {
    id: string;
    uri: vscode.Uri;
    priority: 'high' | 'medium' | 'low';
    analysisTypes: string[];
    timestamp: number;
    dependencies: string[];
    estimatedTime: number;
}
export interface AnalysisResult {
    taskId: string;
    uri: vscode.Uri;
    diagnostics: vscode.Diagnostic[];
    performance: {
        analysisTime: number;
        cacheHits: number;
        cacheMisses: number;
    };
    confidence: number;
    needsReanalysis: boolean;
}
export interface DependencyGraph {
    file: string;
    dependencies: string[];
    dependents: string[];
    analysisOrder: number;
}
export declare class IncrementalAnalyzer {
    private codebaseIndexer;
    private advancedDiagnostics;
    private analysisQueue;
    private isProcessing;
    private dependencyGraph;
    private analysisCache;
    private activeAnalyses;
    private readonly MAX_CONCURRENT_ANALYSES;
    private readonly ANALYSIS_TIMEOUT;
    private readonly CACHE_DURATION;
    private readonly DEPENDENCY_DEPTH;
    private readonly BATCH_SIZE;
    private performanceProfile;
    constructor(codebaseIndexer: CodebaseIndexer, echoProvider: EchoAIProvider);
    analyzeFile(uri: vscode.Uri, priority?: AnalysisTask['priority'], analysisTypes?: string[]): Promise<void>;
    analyzeWorkspace(): Promise<void>;
    private prioritizeFiles;
    private calculateFileScore;
    private calculatePriority;
    private selectAnalysisTypes;
    private buildDependencyGraph;
    private resolveImportPath;
    private findDependents;
    private calculateAnalysisOrder;
    private enqueueTask;
    private getTaskPriority;
    private startProcessingLoop;
    private processTask;
    private calculateConfidence;
    private analyzeAffectedFiles;
    private cacheResult;
    private getCachedResult;
    private needsReanalysis;
    private getDependenciesFromGraph;
    private cleanupCache;
    private estimateAnalysisTime;
    private updatePerformanceMetrics;
    private setupPerformanceMonitoring;
    private generateTaskId;
    getQueueStatus(): {
        size: number;
        processing: boolean;
        activeCount: number;
    };
    getPerformanceMetrics(): {
        averageAnalysisTime: number;
        successRate: number;
        cacheHitRate: number;
        adaptiveDelay: number;
    };
    clearCache(): void;
    dispose(): void;
}
//# sourceMappingURL=IncrementalAnalyzer.d.ts.map