/**
 * Embedding Provider Interface and Implementations
 *
 * Abstracts the generation of vector embeddings from text.
 * Supports multiple providers: OpenAI, Google, Voyage, and local models.
 */

import { loadConfig } from "@echoai/core";

// =============================================================================
// Types
// =============================================================================

export type EmbeddingProviderId = "openai" | "google" | "voyage" | "local";

export interface EmbeddingProviderConfig {
    provider: EmbeddingProviderId;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    dimensions?: number;
}

export interface EmbeddingProvider {
    id: EmbeddingProviderId;
    dimensions: number;
    embed(texts: string[]): Promise<number[][]>;
    embedSingle(text: string): Promise<number[]>;
}

// =============================================================================
// OpenAI Embeddings
// =============================================================================

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
    readonly id: EmbeddingProviderId = "openai";
    readonly dimensions: number;
    private readonly model: string;
    private readonly apiKey: string;
    private readonly baseUrl: string;

    constructor(config: EmbeddingProviderConfig) {
        this.model = config.model || "text-embedding-3-small";
        this.dimensions = config.dimensions || 1536;
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
        this.baseUrl = config.baseUrl || "https://api.openai.com/v1";

        if (!this.apiKey) {
            throw new Error("OpenAI API key is required for embeddings");
        }
    }

    async embed(texts: string[]): Promise<number[][]> {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: texts,
                dimensions: this.dimensions,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI embedding error: ${error}`);
        }

        const data = (await response.json()) as {
            data: Array<{ embedding: number[]; index: number }>;
        };

        // Sort by index to ensure correct order
        return data.data
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);
    }

    async embedSingle(text: string): Promise<number[]> {
        const result = await this.embed([text]);
        return result[0];
    }
}

// =============================================================================
// Google Gemini Embeddings
// =============================================================================

export class GoogleEmbeddingProvider implements EmbeddingProvider {
    readonly id: EmbeddingProviderId = "google";
    readonly dimensions: number;
    private readonly model: string;
    private readonly apiKey: string;

    constructor(config: EmbeddingProviderConfig) {
        this.model = config.model || "text-embedding-004";
        this.dimensions = config.dimensions || 768;
        this.apiKey = config.apiKey || process.env.GOOGLE_API_KEY || "";

        if (!this.apiKey) {
            throw new Error("Google API key is required for embeddings");
        }
    }

    async embed(texts: string[]): Promise<number[][]> {
        const results: number[][] = [];

        // Google's API handles batch differently
        for (const text of texts) {
            const result = await this.embedSingle(text);
            results.push(result);
        }

        return results;
    }

    async embedSingle(text: string): Promise<number[]> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: `models/${this.model}`,
                content: {
                    parts: [{ text }],
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google embedding error: ${error}`);
        }

        const data = (await response.json()) as {
            embedding: { values: number[] };
        };

        return data.embedding.values;
    }
}

// =============================================================================
// Voyage AI Embeddings
// =============================================================================

export class VoyageEmbeddingProvider implements EmbeddingProvider {
    readonly id: EmbeddingProviderId = "voyage";
    readonly dimensions: number;
    private readonly model: string;
    private readonly apiKey: string;

    constructor(config: EmbeddingProviderConfig) {
        this.model = config.model || "voyage-3-lite";
        this.dimensions = config.dimensions || 1024;
        this.apiKey = config.apiKey || process.env.VOYAGE_API_KEY || "";

        if (!this.apiKey) {
            throw new Error("Voyage API key is required for embeddings");
        }
    }

    async embed(texts: string[]): Promise<number[][]> {
        const response = await fetch("https://api.voyageai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: texts,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Voyage embedding error: ${error}`);
        }

        const data = (await response.json()) as {
            data: Array<{ embedding: number[]; index: number }>;
        };

        return data.data
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);
    }

    async embedSingle(text: string): Promise<number[]> {
        const result = await this.embed([text]);
        return result[0];
    }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createEmbeddingProvider(
    config?: Partial<EmbeddingProviderConfig>
): EmbeddingProvider {
    const appConfig = loadConfig();
    const memoryConfig = appConfig.memory;

    // Map gemini to google for embedding provider
    let provider: EmbeddingProviderId = "openai";
    const configProvider = config?.provider || memoryConfig?.provider;
    if (configProvider === "google" || configProvider === "gemini") {
        provider = "google";
    } else if (configProvider === "voyage") {
        provider = "voyage";
    } else if (configProvider === "local") {
        provider = "local";
    } else if (configProvider === "openai") {
        provider = "openai";
    }

    const providerConfig: EmbeddingProviderConfig = {
        provider,
        model: config?.model || memoryConfig?.model,
        apiKey: config?.apiKey,
        dimensions: config?.dimensions,
    };

    switch (providerConfig.provider) {
        case "google":
            return new GoogleEmbeddingProvider(providerConfig);

        case "voyage":
            return new VoyageEmbeddingProvider(providerConfig);

        case "openai":
        default:
            return new OpenAIEmbeddingProvider(providerConfig);
    }
}
