/**
 * EchoAI Config - Configuration Management
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const CONFIG_FILE = path.join(STATE_DIR, "config.json");
const ENV_PREFIX = "ECHOAI_";

export interface ConfigSchema {
    [key: string]: { type: "string" | "number" | "boolean" | "array" | "object"; default?: unknown; required?: boolean; env?: string };
}

export class Config<T extends Record<string, unknown> = Record<string, unknown>> {
    private data: T;
    private schema: ConfigSchema;
    private filePath: string;

    constructor(schema: ConfigSchema = {}, filePath = CONFIG_FILE) {
        this.schema = schema;
        this.filePath = filePath;
        this.data = {} as T;
    }

    async load(): Promise<void> {
        // Load from file
        try {
            const content = await fs.readFile(this.filePath, "utf8");
            this.data = JSON.parse(content);
        } catch { /* No file */ }

        // Override with env vars
        for (const [key, def] of Object.entries(this.schema)) {
            const envKey = def.env || `${ENV_PREFIX}${key.toUpperCase()}`;
            const envVal = process.env[envKey];
            if (envVal !== undefined) {
                (this.data as Record<string, unknown>)[key] = this.coerce(envVal, def.type);
            } else if (def.default !== undefined && (this.data as Record<string, unknown>)[key] === undefined) {
                (this.data as Record<string, unknown>)[key] = def.default;
            }
        }
    }

    async save(): Promise<void> {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
    }

    get<K extends keyof T>(key: K): T[K] { return this.data[key]; }
    set<K extends keyof T>(key: K, value: T[K]): void { this.data[key] = value; }
    getAll(): T { return { ...this.data }; }
    has(key: keyof T): boolean { return key in this.data; }
    delete(key: keyof T): void { delete this.data[key]; }

    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        for (const [key, def] of Object.entries(this.schema)) {
            if (def.required && (this.data as Record<string, unknown>)[key] === undefined) {
                errors.push(`Missing required config: ${key}`);
            }
        }
        return { valid: errors.length === 0, errors };
    }

    private coerce(value: string, type: string): unknown {
        switch (type) {
            case "number": return parseFloat(value);
            case "boolean": return value === "true" || value === "1";
            case "array": case "object": try { return JSON.parse(value); } catch { return value; }
            default: return value;
        }
    }
}

export const defaultSchema: ConfigSchema = {
    provider: { type: "string", default: "anthropic", env: "ECHOAI_PROVIDER" },
    apiKey: { type: "string", env: "ECHOAI_API_KEY" },
    model: { type: "string", env: "ECHOAI_MODEL" },
    channels: { type: "array", default: [], env: "ECHOAI_CHANNELS" },
    debug: { type: "boolean", default: false, env: "ECHOAI_DEBUG" },
};

export async function loadConfig<T extends Record<string, unknown>>(schema = defaultSchema): Promise<Config<T>> {
    const config = new Config<T>(schema);
    await config.load();
    return config;
}
