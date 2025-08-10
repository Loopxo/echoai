import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodeAnalyzer, FunctionInfo, ClassInfo } from '../utils/CodeAnalyzer';

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
    content?: string; // Optional content for security scanning
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

export class CodebaseIndexer {
    private index: Map<string, IndexedFile> = new Map();
    private codeAnalyzer: CodeAnalyzer;
    private isIndexing: boolean = false;
    private indexingProgress: vscode.Progress<{ message?: string; increment?: number }> | null = null;
    private cancellationToken: vscode.CancellationToken | null = null;
    
    // Performance optimization settings
    private readonly MAX_FILE_SIZE = 500000; // 500KB
    private readonly MAX_CONCURRENT_FILES = 10;
    private readonly CHUNK_SIZE = 100;
    private readonly INDEX_CACHE_DURATION = 300000; // 5 minutes
    
    // Exclude patterns for performance
    private readonly EXCLUDE_PATTERNS = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.git/**',
        '**/.vscode/**',
        '**/target/**',
        '**/bin/**',
        '**/obj/**'
    ];

    constructor() {
        this.codeAnalyzer = new CodeAnalyzer();
        this.setupFileWatchers();
    }

    private setupFileWatchers(): void {
        // Watch for file changes and update index incrementally
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,java,cs,cpp,c,go,rs,php,rb}');
        
        watcher.onDidCreate(async (uri) => {
            await this.indexFile(uri, true);
        });

        watcher.onDidChange(async (uri) => {
            await this.indexFile(uri, true);
        });

        watcher.onDidDelete((uri) => {
            this.removeFromIndex(uri);
        });
    }

    async indexWorkspace(): Promise<CodebaseStats> {
        if (this.isIndexing) {
            vscode.window.showWarningMessage('Indexing already in progress');
            return this.getStats();
        }

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Indexing Codebase",
            cancellable: true
        }, async (progress, token) => {
            this.indexingProgress = progress;
            this.cancellationToken = token;
            this.isIndexing = true;

            try {
                const startTime = Date.now();
                const stats = await this.performIndexing(progress, token);
                stats.indexingTime = Date.now() - startTime;
                
                vscode.window.showInformationMessage(
                    `Indexing complete! ${stats.indexedFiles} files indexed in ${(stats.indexingTime / 1000).toFixed(2)}s`
                );

                return stats;
            } finally {
                this.isIndexing = false;
                this.indexingProgress = null;
                this.cancellationToken = null;
            }
        });
    }

    private async performIndexing(
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken
    ): Promise<CodebaseStats> {
        progress.report({ message: "Discovering files..." });

        // Get all files in workspace
        const files = await this.discoverFiles();
        
        if (files.length === 0) {
            return this.getStats();
        }

        progress.report({ message: `Found ${files.length} files. Starting analysis...` });

        // Process files in chunks for better performance
        const chunks = this.chunkArray(files, this.CHUNK_SIZE);
        let processedFiles = 0;

        for (let i = 0; i < chunks.length; i++) {
            if (token.isCancellationRequested) {
                break;
            }

            const chunk = chunks[i];
            progress.report({ 
                message: `Processing chunk ${i + 1}/${chunks.length} (${processedFiles}/${files.length} files)`,
                increment: (this.CHUNK_SIZE / files.length) * 100
            });

            // Process chunk with limited concurrency
            await this.processFileChunk(chunk, token);
            processedFiles += chunk.length;

            // Yield control to prevent blocking the UI
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return this.getStats();
    }

    private async discoverFiles(): Promise<vscode.Uri[]> {
        const includePattern = '**/*.{ts,js,tsx,jsx,py,java,cs,cpp,c,h,hpp,go,rs,php,rb}';
        const excludePattern = `{${this.EXCLUDE_PATTERNS.join(',')}}`;

        try {
            const files = await vscode.workspace.findFiles(includePattern, excludePattern, 10000);
            
            // Filter out overly large files for performance
            const validFiles: vscode.Uri[] = [];
            
            for (const file of files) {
                try {
                    const stat = await vscode.workspace.fs.stat(file);
                    if (stat.size <= this.MAX_FILE_SIZE) {
                        validFiles.push(file);
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                    continue;
                }
            }

            return validFiles;
        } catch (error) {
            console.error('File discovery failed:', error);
            return [];
        }
    }

    private async processFileChunk(
        files: vscode.Uri[], 
        token: vscode.CancellationToken
    ): Promise<void> {
        // Limit concurrency to prevent memory issues
        const semaphore = new Map<number, Promise<void>>();
        
        for (let i = 0; i < files.length; i++) {
            if (token.isCancellationRequested) {
                break;
            }

            const file = files[i];
            const slotIndex = i % this.MAX_CONCURRENT_FILES;

            // Wait for the previous file in this slot to complete
            if (semaphore.has(slotIndex)) {
                await semaphore.get(slotIndex);
            }

            // Process file asynchronously
            const promise = this.indexFile(file, false).catch(error => {
                console.error(`Failed to index ${file.fsPath}:`, error);
            });

            semaphore.set(slotIndex, promise);
        }

        // Wait for all remaining operations to complete
        await Promise.all(Array.from(semaphore.values()));
    }

    private async indexFile(uri: vscode.Uri, isIncremental: boolean = false): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            
            if (content.length > this.MAX_FILE_SIZE) {
                return; // Skip overly large files
            }

            const hash = this.calculateHash(content);
            const existing = this.index.get(uri.toString());

            // Skip if file hasn't changed (for incremental updates)
            if (isIncremental && existing && existing.hash === hash) {
                return;
            }

            const stat = await vscode.workspace.fs.stat(uri);
            const functions = this.codeAnalyzer.extractFunctions(content, document.languageId);
            const classes = this.codeAnalyzer.extractClasses(content, document.languageId);
            const complexity = this.codeAnalyzer.analyzeComplexity(content);
            
            const indexed: IndexedFile = {
                uri,
                lastModified: stat.mtime,
                size: stat.size,
                languageId: document.languageId,
                functions,
                classes,
                imports: this.extractImports(content, document.languageId),
                exports: this.extractExports(content, document.languageId),
                complexity: complexity.cyclomaticComplexity,
                dependencies: this.extractDependencies(content, document.languageId),
                symbols: this.extractSymbols(functions, classes),
                hash
            };

            this.index.set(uri.toString(), indexed);

        } catch (error) {
            console.error(`Failed to index file ${uri.fsPath}:`, error);
        }
    }

    private extractImports(content: string, languageId: string): string[] {
        const imports: string[] = [];
        const lines = content.split('\n');

        for (const line of lines.slice(0, 100)) { // Only check first 100 lines for performance
            let match;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    match = line.match(/import.*from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/);
                    if (match) imports.push(match[1] || match[2]);
                    
                    match = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
                    if (match) imports.push(match[1]);
                    break;

                case 'python':
                    match = line.match(/(?:from\s+(\w+(?:\.\w+)*)\s+import|import\s+(\w+(?:\.\w+)*))/);
                    if (match) imports.push(match[1] || match[2]);
                    break;

                case 'java':
                    match = line.match(/import\s+([a-zA-Z_][a-zA-Z0-9_.]*);/);
                    if (match) imports.push(match[1]);
                    break;

                case 'csharp':
                    match = line.match(/using\s+([a-zA-Z_][a-zA-Z0-9_.]*);/);
                    if (match) imports.push(match[1]);
                    break;
            }
        }

        return [...new Set(imports)].slice(0, 50); // Dedupe and limit for performance
    }

    private extractExports(content: string, languageId: string): string[] {
        const exports: string[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            let match;

            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    match = line.match(/export\s+(?:(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+))/);
                    if (match) {
                        const exported = match[1] || match[2] || match[3] || match[4] || match[5];
                        if (exported) exports.push(exported);
                    }
                    break;

                case 'python':
                    match = line.match(/^(?:def\s+(\w+)|class\s+(\w+))/);
                    if (match && !line.includes('_')) { // Skip private functions
                        const exported = match[1] || match[2];
                        if (exported) exports.push(exported);
                    }
                    break;
            }
        }

        return [...new Set(exports)].slice(0, 100); // Dedupe and limit
    }

    private extractDependencies(content: string, languageId: string): string[] {
        // Extract package.json dependencies for JS/TS projects
        if (languageId === 'json' && content.includes('"dependencies"')) {
            try {
                const packageJson = JSON.parse(content);
                return Object.keys({
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies
                }).slice(0, 100);
            } catch {
                return [];
            }
        }

        // For other languages, use imports as dependencies
        return this.extractImports(content, languageId);
    }

    private extractSymbols(functions: FunctionInfo[], classes: ClassInfo[]): SymbolInfo[] {
        const symbols: SymbolInfo[] = [];

        // Add function symbols
        functions.forEach(func => {
            symbols.push({
                name: func.name,
                kind: 'function',
                line: func.startLine,
                column: 0,
                scope: 'global',
                signature: func.signature,
                references: 0 // Could be calculated with more analysis
            });
        });

        // Add class symbols
        classes.forEach(cls => {
            symbols.push({
                name: cls.name,
                kind: 'class',
                line: cls.startLine,
                column: 0,
                scope: 'global',
                references: 0
            });

            // Add method symbols
            cls.methods.forEach(method => {
                symbols.push({
                    name: method.name,
                    kind: 'function',
                    line: method.startLine,
                    column: 0,
                    scope: cls.name,
                    signature: method.signature,
                    references: 0
                });
            });
        });

        return symbols.slice(0, 200); // Limit for performance
    }

    private calculateHash(content: string): string {
        // Simple hash function for change detection
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private removeFromIndex(uri: vscode.Uri): void {
        this.index.delete(uri.toString());
    }

    // Public query methods for performance-optimized access
    public getFileIndex(uri: vscode.Uri): IndexedFile | undefined {
        return this.index.get(uri.toString());
    }

    public findSymbol(name: string, kind?: SymbolInfo['kind']): SymbolInfo[] {
        const results: SymbolInfo[] = [];
        
        for (const file of this.index.values()) {
            const matchingSymbols = file.symbols.filter(symbol => 
                symbol.name.toLowerCase().includes(name.toLowerCase()) &&
                (!kind || symbol.kind === kind)
            );
            results.push(...matchingSymbols);
        }

        return results.slice(0, 100); // Limit results for performance
    }

    public findFilesByLanguage(languageId: string): IndexedFile[] {
        return Array.from(this.index.values())
            .filter(file => file.languageId === languageId)
            .slice(0, 500); // Limit for performance
    }

    public getStats(): CodebaseStats {
        const files = Array.from(this.index.values());
        const totalLines = files.reduce((sum, file) => sum + (file.size / 50), 0); // Rough estimate
        const languageDistribution = new Map<string, number>();
        
        files.forEach(file => {
            const count = languageDistribution.get(file.languageId) || 0;
            languageDistribution.set(file.languageId, count + 1);
        });

        const complexities = files.map(f => f.complexity).filter(c => c > 0);
        const averageComplexity = complexities.length > 0 
            ? complexities.reduce((a, b) => a + b, 0) / complexities.length 
            : 0;

        // Get largest files
        const largestFiles = files
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);

        // Get most complex functions
        const allFunctions = files.flatMap(f => f.functions);
        const mostComplexFunctions = allFunctions
            .sort((a, b) => (b.parameters?.length || 0) - (a.parameters?.length || 0))
            .slice(0, 10);

        return {
            totalFiles: files.length,
            totalLines: Math.round(totalLines),
            indexedFiles: files.length,
            averageComplexity,
            languageDistribution,
            largestFiles,
            mostComplexFunctions,
            indexingTime: 0,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    private estimateMemoryUsage(): number {
        // Rough estimate of memory usage in MB
        const indexSize = this.index.size;
        const averageFileSize = 10; // KB per indexed file estimate
        return (indexSize * averageFileSize) / 1024; // Convert to MB
    }

    public async refreshIndex(): Promise<void> {
        this.index.clear();
        await this.indexWorkspace();
    }

    public getIndexSize(): number {
        return this.index.size;
    }

    public clearIndex(): void {
        this.index.clear();
    }

    public dispose(): void {
        this.clearIndex();
    }
}