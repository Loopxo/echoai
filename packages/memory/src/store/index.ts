/**
 * Vector Store Implementation
 *
 * SQLite-based vector storage with cosine similarity search.
 * Uses native SQLite for storage with in-memory vector operations.
 */

import Database, { Database as DatabaseType } from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { generateId } from "@echoai/core";

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

// =============================================================================
// Vector Store Implementation
// =============================================================================

export class VectorStore {
    private db: DatabaseType;
    private tableName: string;
    private embeddingCache = new Map<string, number[]>();

    constructor(config?: VectorStoreConfig) {
        const stateDir = path.join(os.homedir(), ".echoai");
        if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
        }

        const dbPath = config?.dbPath || path.join(stateDir, "memory.db");
        this.tableName = config?.tableName || "documents";

        this.db = new Database(dbPath);
        this.initializeSchema();
    }

    private initializeSchema(): void {
        // Create documents table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT,
        source TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

        // Create index on source
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source
      ON ${this.tableName}(source)
    `);

        // Create FTS table for text search
        this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${this.tableName}_fts
      USING fts5(content, content='${this.tableName}', content_rowid='rowid')
    `);
    }

    /**
     * Add a document to the store.
     */
    add(doc: Omit<VectorDocument, "id" | "createdAt" | "updatedAt">): string {
        const id = generateId();
        const now = Date.now();

        const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (id, content, embedding, metadata, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const embeddingBlob = doc.embedding
            ? Buffer.from(new Float32Array(doc.embedding).buffer)
            : null;

        stmt.run(
            id,
            doc.content,
            embeddingBlob,
            doc.metadata ? JSON.stringify(doc.metadata) : null,
            doc.source || null,
            now,
            now
        );

        // Cache embedding
        if (doc.embedding) {
            this.embeddingCache.set(id, doc.embedding);
        }

        return id;
    }

    /**
     * Add multiple documents in a batch.
     */
    addBatch(
        docs: Array<Omit<VectorDocument, "id" | "createdAt" | "updatedAt">>
    ): string[] {
        const ids: string[] = [];
        const now = Date.now();

        const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (id, content, embedding, metadata, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const transaction = this.db.transaction(() => {
            for (const doc of docs) {
                const id = generateId();
                ids.push(id);

                const embeddingBlob = doc.embedding
                    ? Buffer.from(new Float32Array(doc.embedding).buffer)
                    : null;

                stmt.run(
                    id,
                    doc.content,
                    embeddingBlob,
                    doc.metadata ? JSON.stringify(doc.metadata) : null,
                    doc.source || null,
                    now,
                    now
                );

                if (doc.embedding) {
                    this.embeddingCache.set(id, doc.embedding);
                }
            }
        });

        transaction();
        return ids;
    }

    /**
     * Update a document's embedding.
     */
    updateEmbedding(id: string, embedding: number[]): void {
        const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

        const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET embedding = ?, updated_at = ?
      WHERE id = ?
    `);

        stmt.run(embeddingBlob, Date.now(), id);
        this.embeddingCache.set(id, embedding);
    }

    /**
     * Get a document by ID.
     */
    get(id: string): VectorDocument | null {
        const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName} WHERE id = ?
    `);

        const row = stmt.get(id) as {
            id: string;
            content: string;
            embedding: Buffer | null;
            metadata: string | null;
            source: string | null;
            created_at: number;
            updated_at: number;
        } | undefined;

        if (!row) return null;

        return {
            id: row.id,
            content: row.content,
            embedding: row.embedding
                ? Array.from(new Float32Array(row.embedding.buffer))
                : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            source: row.source || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Search for similar documents using vector similarity.
     */
    search(queryEmbedding: number[], options?: { limit?: number; threshold?: number }): SearchResult[] {
        const limit = options?.limit ?? 10;
        const threshold = options?.threshold ?? 0.5;

        // Get all documents with embeddings
        const stmt = this.db.prepare(`
      SELECT id, content, embedding, metadata, source
      FROM ${this.tableName}
      WHERE embedding IS NOT NULL
    `);

        const rows = stmt.all() as Array<{
            id: string;
            content: string;
            embedding: Buffer;
            metadata: string | null;
            source: string | null;
        }>;

        // Calculate cosine similarity for each document
        const results: SearchResult[] = [];

        for (const row of rows) {
            // Get embedding from cache or parse from blob
            let embedding = this.embeddingCache.get(row.id);
            if (!embedding) {
                embedding = Array.from(new Float32Array(row.embedding.buffer));
                this.embeddingCache.set(row.id, embedding);
            }

            const score = this.cosineSimilarity(queryEmbedding, embedding);

            if (score >= threshold) {
                results.push({
                    id: row.id,
                    content: row.content,
                    score,
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                    source: row.source || undefined,
                });
            }
        }

        // Sort by score descending and limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Full-text search.
     */
    textSearch(query: string, options?: { limit?: number }): SearchResult[] {
        const limit = options?.limit ?? 10;

        const stmt = this.db.prepare(`
      SELECT d.id, d.content, d.metadata, d.source
      FROM ${this.tableName} d
      JOIN ${this.tableName}_fts fts ON d.rowid = fts.rowid
      WHERE fts.content MATCH ?
      LIMIT ?
    `);

        const rows = stmt.all(query, limit) as Array<{
            id: string;
            content: string;
            metadata: string | null;
            source: string | null;
        }>;

        return rows.map((row) => ({
            id: row.id,
            content: row.content,
            score: 1.0, // FTS doesn't provide scores easily
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            source: row.source || undefined,
        }));
    }

    /**
     * Delete a document.
     */
    delete(id: string): void {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        stmt.run(id);
        this.embeddingCache.delete(id);
    }

    /**
     * Delete all documents from a source.
     */
    deleteBySource(source: string): void {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE source = ?`);
        stmt.run(source);

        // Clear cache for these documents
        for (const [id] of this.embeddingCache) {
            const doc = this.get(id);
            if (doc?.source === source) {
                this.embeddingCache.delete(id);
            }
        }
    }

    /**
     * Get document count.
     */
    count(): number {
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
        const row = stmt.get() as { count: number };
        return row.count;
    }

    /**
     * Close the database connection.
     */
    close(): void {
        this.db.close();
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
}

export default VectorStore;
