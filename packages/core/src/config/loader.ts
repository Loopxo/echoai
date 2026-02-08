/**
 * Configuration Loader
 *
 * Loads, validates, and manages EchoAI configuration from disk.
 * Supports hot-reloading and environment variable substitution.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EchoAIConfigSchema, type EchoAIConfig } from "./schema.js";

const CONFIG_FILENAME = "echoai.json";
const STATE_DIR_NAME = ".echoai";

let cachedConfig: EchoAIConfig | null = null;
let configPath: string | null = null;

/**
 * Resolves the state directory for EchoAI data.
 * Defaults to ~/.echoai unless ECHOAI_STATE_DIR is set.
 */
export function resolveStateDir(): string {
    const envDir = process.env.ECHOAI_STATE_DIR;
    if (envDir && envDir.trim()) {
        return path.resolve(envDir.trim());
    }
    return path.join(os.homedir(), STATE_DIR_NAME);
}

/**
 * Resolves the path to the configuration file.
 */
export function resolveConfigPath(): string {
    if (configPath) {
        return configPath;
    }
    const stateDir = resolveStateDir();
    configPath = path.join(stateDir, CONFIG_FILENAME);
    return configPath;
}

/**
 * Ensures the state directory exists.
 */
export function ensureStateDir(): void {
    const stateDir = resolveStateDir();
    if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
    }
}

/**
 * Substitutes environment variables in string values.
 * Supports ${VAR} and $VAR syntax.
 */
function substituteEnvVars(value: unknown): unknown {
    if (typeof value === "string") {
        return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/gi, (_, braced, bare) => {
            const varName = braced || bare;
            return process.env[varName] ?? "";
        });
    }
    if (Array.isArray(value)) {
        return value.map(substituteEnvVars);
    }
    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = substituteEnvVars(val);
        }
        return result;
    }
    return value;
}

/**
 * Reads and parses the configuration file.
 */
export function readConfigFile(): { exists: boolean; raw: unknown; path: string } {
    const cfgPath = resolveConfigPath();
    if (!fs.existsSync(cfgPath)) {
        return { exists: false, raw: {}, path: cfgPath };
    }
    try {
        const content = fs.readFileSync(cfgPath, "utf-8");
        const raw = JSON.parse(content);
        return { exists: true, raw, path: cfgPath };
    } catch {
        return { exists: true, raw: {}, path: cfgPath };
    }
}

/**
 * Loads and validates the configuration.
 * Returns cached config if available and skipCache is false.
 */
export function loadConfig(options?: { skipCache?: boolean }): EchoAIConfig {
    if (cachedConfig && !options?.skipCache) {
        return cachedConfig;
    }

    const { raw } = readConfigFile();
    const substituted = substituteEnvVars(raw);
    const parsed = EchoAIConfigSchema.safeParse(substituted);

    if (!parsed.success) {
        console.warn("[echoai] Configuration validation warnings:", parsed.error.format());
        // Return a partial config with defaults
        cachedConfig = substituted as EchoAIConfig;
    } else {
        cachedConfig = parsed.data;
    }

    return cachedConfig;
}

/**
 * Writes the configuration to disk.
 */
export function writeConfig(config: EchoAIConfig): void {
    ensureStateDir();
    const cfgPath = resolveConfigPath();
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(cfgPath, content, "utf-8");
    cachedConfig = config;
}

/**
 * Reloads the configuration from disk, clearing the cache.
 */
export function reloadConfig(): EchoAIConfig {
    cachedConfig = null;
    return loadConfig({ skipCache: true });
}

/**
 * Gets a default configuration object.
 */
export function getDefaultConfig(): EchoAIConfig {
    return {
        meta: {
            version: "1.0.0",
        },
        gateway: {
            port: 18789,
            bind: "loopback",
        },
        agents: {
            defaults: {
                workspace: path.join(os.homedir(), "workspace"),
            },
            list: [
                {
                    id: "default",
                    default: true,
                },
            ],
        },
    };
}
