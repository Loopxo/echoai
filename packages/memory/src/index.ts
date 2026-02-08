/**
 * Memory Search Tool
 *
 * High-level interface for semantic memory search.
 * Indexes documents and provides the memory_search tool for agents.
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createEmbeddingProvider, type EmbeddingProvider } from "./embeddings/index.js";
import { VectorStore, type SearchResult } from "./store/index.js";

// =============================================================================
// Types
// =============================================================================

export interface MemorySearchOptions {
    limit?: number;
    threshold?: number;
    sources?: string[];
    hybridSearch?: boolean; // Combine vector + text search
}

export interface MemoryIndexOptions {
    source: string;
    chunkSize?: number;
    chunkOverlap?: number;
}

// =============================================================================
// Memory Search Implementation
// =============================================================================

export class MemorySearch {
    private embeddings: EmbeddingProvider;
    private store: VectorStore;

    constructor(options?: { embeddings?: EmbeddingProvider; store?: VectorStore }) {
        this.embeddings = options?.embeddings || createEmbeddingProvider();
        this.store = options?.store || new VectorStore();
    }

    /**
     * Search for relevant memories using semantic similarity.
     */
    async search(query: string, options?: MemorySearchOptions): Promise<SearchResult[]> {
        const queryEmbedding = await this.embeddings.embedSingle(query);

        let vectorResults = this.store.search(queryEmbedding, {
            limit: options?.limit ?? 10,
            threshold: options?.threshold ?? 0.5,
        });

        // Filter by sources if specified
        if (options?.sources?.length) {
            vectorResults = vectorResults.filter(
                (r) => r.source && options.sources!.includes(r.source)
            );
        }

        // Hybrid search: combine with text search
        if (options?.hybridSearch) {
            const textResults = this.store.textSearch(query, {
                limit: options?.limit ?? 10,
            });

            // Merge results, preferring vector matches
            const merged = new Map<string, SearchResult>();

            for (const result of vectorResults) {
                merged.set(result.id, result);
            }

            for (const result of textResults) {
                if (!merged.has(result.id)) {
                    // Boost text match scores slightly lower than vector matches
                    merged.set(result.id, { ...result, score: result.score * 0.8 });
                }
            }

            return Array.from(merged.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, options?.limit ?? 10);
        }

        return vectorResults;
    }

    /**
     * Index a file or directory into memory.
     */
    async indexPath(filePath: string, options?: MemoryIndexOptions): Promise<number> {
        const resolvedPath = filePath.startsWith("~")
            ? path.join(os.homedir(), filePath.slice(1))
            : path.resolve(filePath);

        const stat = fs.statSync(resolvedPath);

        if (stat.isDirectory()) {
            return this.indexDirectory(resolvedPath, options);
        } else {
            return this.indexFile(resolvedPath, options);
        }
    }

    /**
     * Index a single file.
     */
    private async indexFile(filePath: string, options?: MemoryIndexOptions): Promise<number> {
        const content = fs.readFileSync(filePath, "utf-8");
        const source = options?.source || filePath;

        // Split into chunks
        const chunks = this.chunkText(content, {
            chunkSize: options?.chunkSize ?? 1000,
            chunkOverlap: options?.chunkOverlap ?? 200,
        });

        // Generate embeddings for all chunks
        const embeddings = await this.embeddings.embed(chunks);

        // Store all chunks
        for (let i = 0; i < chunks.length; i++) {
            this.store.add({
                content: chunks[i],
                embedding: embeddings[i],
                source,
                metadata: {
                    filePath,
                    chunkIndex: i,
                    totalChunks: chunks.length,
                },
            });
        }

        return chunks.length;
    }

    /**
     * Index a directory recursively.
     */
    private async indexDirectory(
        dirPath: string,
        options?: MemoryIndexOptions
    ): Promise<number> {
        let totalChunks = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            // Skip hidden files and common non-text directories
            if (entry.name.startsWith(".") || entry.name === "node_modules") {
                continue;
            }

            if (entry.isDirectory()) {
                totalChunks += await this.indexDirectory(fullPath, options);
            } else if (this.isTextFile(entry.name)) {
                totalChunks += await this.indexFile(fullPath, options);
            }
        }

        return totalChunks;
    }

    /**
     * Add a memory directly.
     */
    async addMemory(content: string, source?: string): Promise<string> {
        const embedding = await this.embeddings.embedSingle(content);
        return this.store.add({
            content,
            embedding,
            source: source || "user",
        });
    }

    /**
     * Get memory statistics.
     */
    getStats(): { count: number } {
        return {
            count: this.store.count(),
        };
    }

    /**
     * Clear all memories from a source.
     */
    clearSource(source: string): void {
        this.store.deleteBySource(source);
    }

    /**
     * Close the memory store.
     */
    close(): void {
        this.store.close();
    }

    /**
     * Split text into overlapping chunks.
     */
    private chunkText(
        text: string,
        options: { chunkSize: number; chunkOverlap: number }
    ): string[] {
        const { chunkSize, chunkOverlap } = options;
        const chunks: string[] = [];

        // Split by paragraphs first
        const paragraphs = text.split(/\n\n+/);
        let currentChunk = "";

        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length <= chunkSize) {
                currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = paragraph;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        // If we have overlapping chunks, add overlap
        if (chunkOverlap > 0 && chunks.length > 1) {
            const overlappedChunks: string[] = [];

            for (let i = 0; i < chunks.length; i++) {
                let chunk = chunks[i];

                // Add overlap from previous chunk
                if (i > 0) {
                    const prevChunk = chunks[i - 1];
                    const overlap = prevChunk.slice(-chunkOverlap);
                    chunk = overlap + "\n\n" + chunk;
                }

                overlappedChunks.push(chunk);
            }

            return overlappedChunks;
        }

        return chunks;
    }

    /**
     * Check if a file is a text file based on extension.
     */
    private isTextFile(filename: string): boolean {
        const textExtensions = [
            ".md",
            ".txt",
            ".json",
            ".yaml",
            ".yml",
            ".ts",
            ".js",
            ".tsx",
            ".jsx",
            ".py",
            ".go",
            ".rs",
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".hpp",
            ".css",
            ".html",
            ".xml",
            ".toml",
            ".ini",
            ".cfg",
            ".conf",
        ];

        const ext = path.extname(filename).toLowerCase();
        return textExtensions.includes(ext);
    }
}

// =============================================================================
// Memory Search Tool for Agents
// =============================================================================

export function createMemorySearchTool(memorySearch: MemorySearch) {
    return {
        name: "memory_search",
        description:
            "Search your personal knowledge base for relevant information. Use this when you need to recall facts, context, or previous conversations.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query to find relevant memories",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results to return (default: 5)",
                },
            },
            required: ["query"],
        },
        execute: async (params: { query: string; limit?: number }) => {
            const results = await memorySearch.search(params.query, {
                limit: params.limit ?? 5,
                hybridSearch: true,
            });

            if (results.length === 0) {
                return "No relevant memories found.";
            }

            return results
                .map(
                    (r, i) =>
                        `[${i + 1}] (score: ${r.score.toFixed(2)}) ${r.content.slice(0, 500)}${r.content.length > 500 ? "..." : ""
                        }`
                )
                .join("\n\n");
        },
    };
}

export default MemorySearch;
