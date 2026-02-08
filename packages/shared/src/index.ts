/**
 * EchoAI Shared - Shared Helpers and Constants
 */
import path from "node:path";
import os from "node:os";

// =============================================================================
// Constants
// =============================================================================

export const APP_NAME = "EchoAI";
export const VERSION = "1.0.0";
export const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
export const DEBUG = process.env.ECHOAI_DEBUG === "1" || process.env.DEBUG?.includes("echoai");

export const SUPPORTED_CHANNELS = ["discord", "telegram", "slack", "whatsapp", "signal", "imessage", "line", "web"] as const;
export const SUPPORTED_PROVIDERS = ["anthropic", "openai", "google", "ollama", "bedrock", "azure", "groq", "mistral"] as const;
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";
export const MAX_TOKENS = 4096;
export const TIMEOUT_MS = 60000;

// =============================================================================
// Error Classes
// =============================================================================

export class EchoAIError extends Error { constructor(message: string, public code: string) { super(message); this.name = "EchoAIError"; } }
export class ConfigError extends EchoAIError { constructor(message: string) { super(message, "CONFIG_ERROR"); } }
export class ChannelError extends EchoAIError { constructor(message: string) { super(message, "CHANNEL_ERROR"); } }
export class ProviderError extends EchoAIError { constructor(message: string) { super(message, "PROVIDER_ERROR"); } }
export class ValidationError extends EchoAIError { constructor(message: string) { super(message, "VALIDATION_ERROR"); } }

// =============================================================================
// Result Type
// =============================================================================

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
export function unwrap<T>(result: Result<T>): T { if (result.ok) return result.value; throw result.error; }

// =============================================================================
// Environment
// =============================================================================

export function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined && defaultValue === undefined) throw new ConfigError(`Missing env: ${key}`);
    return value ?? defaultValue!;
}

export function requireEnv(key: string): string { return getEnv(key); }
export function getEnvBool(key: string, defaultValue = false): boolean { const v = process.env[key]; return v === undefined ? defaultValue : v === "true" || v === "1"; }
export function getEnvInt(key: string, defaultValue = 0): number { const v = process.env[key]; return v === undefined ? defaultValue : parseInt(v, 10); }

// =============================================================================
// Misc Helpers
// =============================================================================

export const noop = (): void => { };
export const identity = <T>(x: T): T => x;
export const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
export const now = (): number => Date.now();
export const timestamp = (): string => new Date().toISOString();

export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
    if (!condition) throw new Error(message);
}

export function assertNever(x: never): never { throw new Error(`Unexpected: ${x}`); }

// =============================================================================
// Version
// =============================================================================

export function getVersion(): string { return VERSION; }
export function getUserAgent(): string { return `${APP_NAME}/${VERSION} (Node.js ${process.version})`; }
