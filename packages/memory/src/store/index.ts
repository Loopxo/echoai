/**
 * Vector Store Implementation
 *
 * File-backed vector storage with cosine similarity and basic text search.
 */

import fs from "node:fs";
import path from "node:path";
import { generateId, resolveStateDir } from "@echoai/core";

// =============================================================================
// Types
// =============================================================================

export interface VectorDocument {
    id: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
    source?: string;
    createdAt: number;
    updatedAt: number;
}

export interface SearchResult {
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
    source?: string;
}

export interface VectorStoreConfig {
    dbPath?: string;
    tableName?: string;
}

interface PersistedState {
    documents: VectorDocument[];
}

// =============================================================================
// Vector Store Implementation
// =============================================================================

export class VectorStore {
    private readonly statePath: string;
    private readonly tableName: string;
    private readonly embeddingCache = new Map<string, number[]>();
    private documents = new Map<string, VectorDocument>();

    constructor(config?: VectorStoreConfig) {
        const stateDir = resolveStateDir();
        if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
        }

        this.tableName = config?.tableName || "documents";
        this.statePath = config?.dbPath || path.join(stateDir, `memory-${this.tableName}.json`);
        this.load();
    }

    /**
     * Add a document to the store.
     */
    add(doc: Omit<VectorDocument, "id" | "createdAt" | "updatedAt">): string {
        const id = generateId();
        const now = Date.now();
        const record: VectorDocument = {
            id,
            content: doc.content,
            embedding: doc.embedding,
            metadata: doc.metadata,
            source: doc.source,
            createdAt: now,
            updatedAt: now,
        };

        this.documents.set(id, record);
        if (record.embedding) {
            this.embeddingCache.set(id, record.embedding);
        }
        this.persist();
        return id;
    }

    /**
     * Add multiple documents in a batch.
     */
    addBatch(
        docs: Array<Omit<VectorDocument, "id" | "createdAt" | "updatedAt">>
    ): string[] {
        const ids: string[] = [];

        for (const doc of docs) {
            ids.push(this.add(doc));
        }

        return ids;
    }

    /**
     * Update a document's embedding.
     */
    updateEmbedding(id: string, embedding: number[]): void {
        const record = this.documents.get(id);
        if (!record) {
            return;
        }

        record.embedding = embedding;
        record.updatedAt = Date.now();
        this.documents.set(id, record);
        this.embeddingCache.set(id, embedding);
        this.persist();
    }

    /**
     * Get a document by ID.
     */
    get(id: string): VectorDocument | null {
        return this.documents.get(id) || null;
    }

    /**
     * Search for similar documents using vector similarity.
     */
    search(queryEmbedding: number[], options?: { limit?: number; threshold?: number }): SearchResult[] {
        const limit = options?.limit ?? 10;
        const threshold = options?.threshold ?? 0.5;
        const results: SearchResult[] = [];

        for (const doc of this.documents.values()) {
            const embedding = doc.embedding || this.embeddingCache.get(doc.id);
            if (!embedding) {
                continue;
            }

            const score = this.cosineSimilarity(queryEmbedding, embedding);
            if (score >= threshold) {
                results.push({
                    id: doc.id,
                    content: doc.content,
                    score,
                    metadata: doc.metadata,
                    source: doc.source,
                });
            }
        }

        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    /**
     * Full-text search.
     */
    textSearch(query: string, options?: { limit?: number }): SearchResult[] {
        const needle = query.trim().toLowerCase();
        const limit = options?.limit ?? 10;

        if (!needle) {
            return [];
        }

        const results: SearchResult[] = [];

        for (const doc of this.documents.values()) {
            const haystack = `${doc.content}\n${JSON.stringify(doc.metadata || {})}`.toLowerCase();
            const occurrences = haystack.split(needle).length - 1;
            if (occurrences <= 0) {
                continue;
            }

            results.push({
                id: doc.id,
                content: doc.content,
                score: Math.min(1, 0.5 + occurrences * 0.1),
                metadata: doc.metadata,
                source: doc.source,
            });
        }

        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    /**
     * Delete a document.
     */
    delete(id: string): void {
        this.documents.delete(id);
        this.embeddingCache.delete(id);
        this.persist();
    }

    /**
     * Delete all documents from a source.
     */
    deleteBySource(source: string): void {
        for (const [id, doc] of this.documents.entries()) {
            if (doc.source === source) {
                this.documents.delete(id);
                this.embeddingCache.delete(id);
            }
        }
        this.persist();
    }

    /**
     * Get document count.
     */
    count(): number {
        return this.documents.size;
    }

    /**
     * Close the store.
     */
    close(): void {
        this.persist();
        this.embeddingCache.clear();
    }

    /**
     * Calculate cosine similarity between two vectors.
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error("Vectors must have the same length");
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        if (magnitude === 0) return 0;

        return dotProduct / magnitude;
    }

    private load(): void {
        if (!fs.existsSync(this.statePath)) {
            return;
        }

        try {
            const state = JSON.parse(fs.readFileSync(this.statePath, "utf8")) as PersistedState;
            for (const doc of state.documents || []) {
                this.documents.set(doc.id, doc);
                if (doc.embedding) {
                    this.embeddingCache.set(doc.id, doc.embedding);
                }
            }
        } catch {
            this.documents.clear();
            this.embeddingCache.clear();
        }
    }

    private persist(): void {
        const state: PersistedState = {
            documents: Array.from(this.documents.values()),
        };
        fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf8");
    }
}

export default VectorStore;
