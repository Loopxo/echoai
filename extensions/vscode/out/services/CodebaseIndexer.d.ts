import * as vscode from 'vscode';
import { FunctionInfo, ClassInfo } from '../utils/CodeAnalyzer';
export interface IndexedFile {
    uri: vscode.Uri;
    lastModified: number;
    size: number;
    languageId: string;
    functions: FunctionInfo[];
    classes: ClassInfo[];
    imports: string[];
    exports: string[];
    complexity: number;
    dependencies: string[];
    symbols: SymbolInfo[];
    hash: string;
}
export interface SymbolInfo {
    name: string;
    kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'constant';
    line: number;
    column: number;
    scope: string;
    signature?: string;
    references: number;
}
export interface CodebaseStats {
    totalFiles: number;
    totalLines: number;
    indexedFiles: number;
    averageComplexity: number;
    languageDistribution: Map<string, number>;
    largestFiles: IndexedFile[];
    mostComplexFunctions: FunctionInfo[];
    indexingTime: number;
    memoryUsage: number;
}
export declare class CodebaseIndexer {
    private index;
    private codeAnalyzer;
    private isIndexing;
    private indexingProgress;
    private cancellationToken;
    private readonly MAX_FILE_SIZE;
    private readonly MAX_CONCURRENT_FILES;
    private readonly CHUNK_SIZE;
    private readonly INDEX_CACHE_DURATION;
    private readonly EXCLUDE_PATTERNS;
    constructor();
    private setupFileWatchers;
    indexWorkspace(): Promise<CodebaseStats>;
    private performIndexing;
    private discoverFiles;
    private processFileChunk;
    private indexFile;
    private extractImports;
    private extractExports;
    private extractDependencies;
    private extractSymbols;
    private calculateHash;
    private chunkArray;
    private removeFromIndex;
    getFileIndex(uri: vscode.Uri): IndexedFile | undefined;
    findSymbol(name: string, kind?: SymbolInfo['kind']): SymbolInfo[];
    findFilesByLanguage(languageId: string): IndexedFile[];
    getStats(): CodebaseStats;
    private estimateMemoryUsage;
    refreshIndex(): Promise<void>;
    getIndexSize(): number;
    clearIndex(): void;
    dispose(): void;
}
//# sourceMappingURL=CodebaseIndexer.d.ts.map