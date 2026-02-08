/**
 * EchoAI Providers
 *
 * Multi-provider AI API integrations:
 * - Anthropic Claude
 * - OpenAI GPT
 * - Google Gemini
 * - AWS Bedrock
 * - Ollama (local)
 * - OpenRouter
 *
 * Features:
 * - Unified message interface
 * - Streaming support
 * - Tool/function calling
 * - Model fallback
 * - Rate limiting
 */

// =============================================================================
// Types
// =============================================================================

export type ProviderType =
    | "anthropic"
    | "openai"
    | "google"
    | "bedrock"
    | "ollama"
    | "openrouter"
    | "azure"
    | "groq"
    | "together"
    | "mistral";

export interface ProviderConfig {
    type: ProviderType;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    headers?: Record<string, string>;
}

export interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentBlock[];
    name?: string;
    toolCallId?: string;
    toolCalls?: ToolCall[];
}

export interface ContentBlock {
    type: "text" | "image" | "audio" | "tool_use" | "tool_result";
    text?: string;
    source?: ImageSource;
    toolUseId?: string;
    name?: string;
    input?: unknown;
    content?: string;
}

export interface ImageSource {
    type: "base64" | "url";
    mediaType: string;
    data?: string;
    url?: string;
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface Tool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

export interface CompletionRequest {
    messages: Message[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: Tool[];
    stream?: boolean;
    systemPrompt?: string;
}

export interface CompletionResponse {
    id: string;
    content: string;
    toolCalls?: ToolCall[];
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    stopReason?: string;
    model?: string;
}

export interface StreamEvent {
    type: "text_delta" | "tool_use" | "message_start" | "message_end" | "error";
    text?: string;
    toolCall?: ToolCall;
    error?: string;
}

export type StreamCallback = (event: StreamEvent) => void;

// =============================================================================
// Provider Interface
// =============================================================================

export interface Provider {
    readonly type: ProviderType;
    complete(request: CompletionRequest): Promise<CompletionResponse>;
    stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse>;
    listModels(): Promise<string[]>;
}

// =============================================================================
// Base Provider
// =============================================================================

abstract class BaseProvider implements Provider {
    abstract readonly type: ProviderType;
    protected config: ProviderConfig;

    constructor(config: ProviderConfig) {
        this.config = config;
    }

    abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
    abstract stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse>;
    abstract listModels(): Promise<string[]>;

    protected async fetch(
        url: string,
        options: RequestInit
    ): Promise<Response> {
        const timeout = this.config.timeout || 120000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    ...this.config.headers,
                    ...options.headers,
                },
            });
            return response;
        } finally {
            clearTimeout(timer);
        }
    }

    protected generateId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
}

// =============================================================================
// Anthropic Provider
// =============================================================================

export class AnthropicProvider extends BaseProvider {
    readonly type = "anthropic" as const;

    constructor(config: Omit<ProviderConfig, "type">) {
        super({ ...config, type: "anthropic" });
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const url = this.config.baseUrl || "https://api.anthropic.com/v1/messages";
        const body = this.buildRequestBody(request);

        const response = await this.fetch(url, {
            method: "POST",
            headers: {
                "x-api-key": this.config.apiKey || "",
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as Record<string, unknown>;
        return this.parseResponse(data);
    }

    async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
        const url = this.config.baseUrl || "https://api.anthropic.com/v1/messages";
        const body = this.buildRequestBody({ ...request, stream: true });

        const response = await this.fetch(url, {
            method: "POST",
            headers: {
                "x-api-key": this.config.apiKey || "",
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        let fullContent = "";
        const toolCalls: ToolCall[] = [];
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                    const event = JSON.parse(data) as Record<string, unknown>;
                    if (event.type === "content_block_delta") {
                        const delta = event.delta as Record<string, unknown>;
                        if (delta.type === "text_delta") {
                            const text = delta.text as string;
                            fullContent += text;
                            callback({ type: "text_delta", text });
                        }
                    }
                } catch {
                    // Skip malformed events
                }
            }
        }

        callback({ type: "message_end" });

        return {
            id: this.generateId(),
            content: fullContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
    }

    async listModels(): Promise<string[]> {
        return [
            "claude-sonnet-4-20250514",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ];
    }

    private buildRequestBody(request: CompletionRequest): Record<string, unknown> {
        const messages = request.messages.filter(m => m.role !== "system");
        const systemPrompt = request.systemPrompt ||
            request.messages.find(m => m.role === "system")?.content;

        const body: Record<string, unknown> = {
            model: request.model || this.config.model || "claude-sonnet-4-20250514",
            max_tokens: request.maxTokens || this.config.maxTokens || 4096,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        };

        if (systemPrompt) {
            body.system = systemPrompt;
        }

        if (request.temperature !== undefined) {
            body.temperature = request.temperature;
        }

        if (request.tools?.length) {
            body.tools = request.tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
            }));
        }

        if (request.stream) {
            body.stream = true;
        }

        return body;
    }

    private parseResponse(data: Record<string, unknown>): CompletionResponse {
        const content = data.content as Array<Record<string, unknown>>;
        let text = "";
        const toolCalls: ToolCall[] = [];

        for (const block of content) {
            if (block.type === "text") {
                text += block.text as string;
            } else if (block.type === "tool_use") {
                toolCalls.push({
                    id: block.id as string,
                    type: "function",
                    function: {
                        name: block.name as string,
                        arguments: JSON.stringify(block.input),
                    },
                });
            }
        }

        const usage = data.usage as Record<string, number> | undefined;

        return {
            id: data.id as string,
            content: text,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: usage ? {
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
            } : undefined,
            stopReason: data.stop_reason as string | undefined,
            model: data.model as string | undefined,
        };
    }
}

// =============================================================================
// OpenAI Provider
// =============================================================================

export class OpenAIProvider extends BaseProvider {
    readonly type = "openai" as const;

    constructor(config: Omit<ProviderConfig, "type">) {
        super({ ...config, type: "openai" });
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const url = `${this.config.baseUrl || "https://api.openai.com/v1"}/chat/completions`;
        const body = this.buildRequestBody(request);

        const response = await this.fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.config.apiKey || ""}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as Record<string, unknown>;
        return this.parseResponse(data);
    }

    async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
        const url = `${this.config.baseUrl || "https://api.openai.com/v1"}/chat/completions`;
        const body = this.buildRequestBody({ ...request, stream: true });

        const response = await this.fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.config.apiKey || ""}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        let fullContent = "";
        const toolCalls: ToolCall[] = [];
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                    const event = JSON.parse(data) as Record<string, unknown>;
                    const choices = event.choices as Array<Record<string, unknown>>;
                    if (choices?.[0]) {
                        const delta = choices[0].delta as Record<string, unknown>;
                        if (delta?.content) {
                            const text = delta.content as string;
                            fullContent += text;
                            callback({ type: "text_delta", text });
                        }
                    }
                } catch {
                    // Skip malformed events
                }
            }
        }

        callback({ type: "message_end" });

        return {
            id: this.generateId(),
            content: fullContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
    }

    async listModels(): Promise<string[]> {
        return [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
            "o1-preview",
            "o1-mini",
        ];
    }

    private buildRequestBody(request: CompletionRequest): Record<string, unknown> {
        const messages = request.messages.map(m => {
            if (m.role === "system" && request.systemPrompt) {
                return { role: "system", content: request.systemPrompt };
            }
            return { role: m.role, content: m.content };
        });

        const body: Record<string, unknown> = {
            model: request.model || this.config.model || "gpt-4o",
            messages,
            max_tokens: request.maxTokens || this.config.maxTokens || 4096,
        };

        if (request.temperature !== undefined) {
            body.temperature = request.temperature;
        }

        if (request.tools?.length) {
            body.tools = request.tools.map(t => ({
                type: "function",
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema,
                },
            }));
        }

        if (request.stream) {
            body.stream = true;
        }

        return body;
    }

    private parseResponse(data: Record<string, unknown>): CompletionResponse {
        const choices = data.choices as Array<Record<string, unknown>>;
        const choice = choices[0];
        const message = choice.message as Record<string, unknown>;

        const toolCalls: ToolCall[] = [];
        const rawToolCalls = message.tool_calls as Array<Record<string, unknown>> | undefined;

        if (rawToolCalls) {
            for (const tc of rawToolCalls) {
                const fn = tc.function as Record<string, unknown>;
                toolCalls.push({
                    id: tc.id as string,
                    type: "function",
                    function: {
                        name: fn.name as string,
                        arguments: fn.arguments as string,
                    },
                });
            }
        }

        const usage = data.usage as Record<string, number> | undefined;

        return {
            id: data.id as string,
            content: message.content as string || "",
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: usage ? {
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
            } : undefined,
            stopReason: choice.finish_reason as string | undefined,
            model: data.model as string | undefined,
        };
    }
}

// =============================================================================
// Google Gemini Provider
// =============================================================================

export class GeminiProvider extends BaseProvider {
    readonly type = "google" as const;

    constructor(config: Omit<ProviderConfig, "type">) {
        super({ ...config, type: "google" });
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const model = request.model || this.config.model || "gemini-2.5-flash";
        const url = `${this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"}/models/${model}:generateContent?key=${this.config.apiKey}`;
        const body = this.buildRequestBody(request);

        const response = await this.fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as Record<string, unknown>;
        return this.parseResponse(data);
    }

    async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
        const model = request.model || this.config.model || "gemini-2.5-flash";
        const url = `${this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"}/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;
        const body = this.buildRequestBody(request);

        const response = await this.fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        let fullContent = "";
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);

                try {
                    const event = JSON.parse(data) as Record<string, unknown>;
                    const candidates = event.candidates as Array<Record<string, unknown>>;
                    if (candidates?.[0]) {
                        const content = candidates[0].content as Record<string, unknown>;
                        const parts = content.parts as Array<Record<string, unknown>>;
                        if (parts?.[0]?.text) {
                            const text = parts[0].text as string;
                            fullContent += text;
                            callback({ type: "text_delta", text });
                        }
                    }
                } catch {
                    // Skip malformed events
                }
            }
        }

        callback({ type: "message_end" });

        return {
            id: this.generateId(),
            content: fullContent,
        };
    }

    async listModels(): Promise<string[]> {
        return [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ];
    }

    private buildRequestBody(request: CompletionRequest): Record<string, unknown> {
        const contents = request.messages
            .filter(m => m.role !== "system")
            .map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: typeof m.content === "string" ? m.content : "" }],
            }));

        const systemPrompt = request.systemPrompt ||
            request.messages.find(m => m.role === "system")?.content;

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                maxOutputTokens: request.maxTokens || this.config.maxTokens || 4096,
            },
        };

        if (systemPrompt) {
            body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        if (request.temperature !== undefined) {
            (body.generationConfig as Record<string, unknown>).temperature = request.temperature;
        }

        return body;
    }

    private parseResponse(data: Record<string, unknown>): CompletionResponse {
        const candidates = data.candidates as Array<Record<string, unknown>>;
        const candidate = candidates?.[0];
        const content = candidate?.content as Record<string, unknown>;
        const parts = content?.parts as Array<Record<string, unknown>>;
        const text = parts?.[0]?.text as string || "";

        const usage = data.usageMetadata as Record<string, number> | undefined;

        return {
            id: this.generateId(),
            content: text,
            usage: usage ? {
                inputTokens: usage.promptTokenCount,
                outputTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount,
            } : undefined,
            stopReason: candidate?.finishReason as string | undefined,
        };
    }
}

// =============================================================================
// Ollama Provider (Local)
// =============================================================================

export class OllamaProvider extends BaseProvider {
    readonly type = "ollama" as const;

    constructor(config: Omit<ProviderConfig, "type">) {
        super({ ...config, type: "ollama" });
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const url = `${this.config.baseUrl || "http://localhost:11434"}/api/chat`;
        const body = this.buildRequestBody(request);

        const response = await this.fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as Record<string, unknown>;
        return this.parseResponse(data);
    }

    async stream(request: CompletionRequest, callback: StreamCallback): Promise<CompletionResponse> {
        const url = `${this.config.baseUrl || "http://localhost:11434"}/api/chat`;
        const body = this.buildRequestBody({ ...request, stream: true });

        const response = await this.fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        let fullContent = "";
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const event = JSON.parse(line) as Record<string, unknown>;
                    const message = event.message as Record<string, unknown>;
                    if (message?.content) {
                        const text = message.content as string;
                        fullContent += text;
                        callback({ type: "text_delta", text });
                    }
                } catch {
                    // Skip malformed events
                }
            }
        }

        callback({ type: "message_end" });

        return {
            id: this.generateId(),
            content: fullContent,
        };
    }

    async listModels(): Promise<string[]> {
        const url = `${this.config.baseUrl || "http://localhost:11434"}/api/tags`;
        try {
            const response = await this.fetch(url, { method: "GET" });
            if (!response.ok) return [];
            const data = await response.json() as { models?: Array<{ name: string }> };
            return data.models?.map(m => m.name) || [];
        } catch {
            return [];
        }
    }

    private buildRequestBody(request: CompletionRequest): Record<string, unknown> {
        return {
            model: request.model || this.config.model || "llama3.2",
            messages: request.messages.map(m => ({
                role: m.role,
                content: typeof m.content === "string" ? m.content : "",
            })),
            stream: request.stream || false,
            options: {
                num_predict: request.maxTokens || this.config.maxTokens || 4096,
                temperature: request.temperature,
            },
        };
    }

    private parseResponse(data: Record<string, unknown>): CompletionResponse {
        const message = data.message as Record<string, unknown>;

        return {
            id: this.generateId(),
            content: message?.content as string || "",
            usage: data.eval_count ? {
                inputTokens: (data.prompt_eval_count as number) || 0,
                outputTokens: (data.eval_count as number) || 0,
                totalTokens: ((data.prompt_eval_count as number) || 0) + ((data.eval_count as number) || 0),
            } : undefined,
        };
    }
}

// =============================================================================
// Provider Factory
// =============================================================================

export function createProvider(config: ProviderConfig): Provider {
    switch (config.type) {
        case "anthropic":
            return new AnthropicProvider(config);
        case "openai":
            return new OpenAIProvider(config);
        case "google":
            return new GeminiProvider(config);
        case "ollama":
            return new OllamaProvider(config);
        default:
            throw new Error(`Unknown provider type: ${config.type}`);
    }
}

// =============================================================================
// Multi-Provider Manager
// =============================================================================

export class ProviderManager {
    private providers: Map<string, Provider> = new Map();
    private defaultProvider?: string;

    addProvider(name: string, provider: Provider): void {
        this.providers.set(name, provider);
        if (!this.defaultProvider) {
            this.defaultProvider = name;
        }
    }

    setDefault(name: string): void {
        if (!this.providers.has(name)) {
            throw new Error(`Provider ${name} not found`);
        }
        this.defaultProvider = name;
    }

    getProvider(name?: string): Provider {
        const key = name || this.defaultProvider;
        if (!key) {
            throw new Error("No provider specified and no default set");
        }
        const provider = this.providers.get(key);
        if (!provider) {
            throw new Error(`Provider ${key} not found`);
        }
        return provider;
    }

    async complete(request: CompletionRequest, providerName?: string): Promise<CompletionResponse> {
        return this.getProvider(providerName).complete(request);
    }

    async stream(
        request: CompletionRequest,
        callback: StreamCallback,
        providerName?: string
    ): Promise<CompletionResponse> {
        return this.getProvider(providerName).stream(request, callback);
    }

    listProviders(): string[] {
        return Array.from(this.providers.keys());
    }
}

// =============================================================================
// Exports
// =============================================================================

export {
    BaseProvider,
};
