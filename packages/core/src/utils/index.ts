/**
 * Core Utilities for EchoAI
 *
 * Shared utility functions used across all packages.
 */

import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generates a unique ID using crypto.randomUUID.
 */
export function generateId(): string {
    return crypto.randomUUID();
}

/**
 * Generates a short ID (8 characters).
 */
export function generateShortId(): string {
    return crypto.randomBytes(4).toString("hex");
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Resolves a path that may start with ~ to the user's home directory.
 */
export function resolveUserPath(inputPath: string): string {
    if (inputPath.startsWith("~")) {
        return path.join(os.homedir(), inputPath.slice(1));
    }
    return path.resolve(inputPath);
}

/**
 * Returns the platform-specific state directory.
 */
export function getStateDir(): string {
    const envDir = process.env.ECHOAI_STATE_DIR;
    if (envDir) {
        return resolveUserPath(envDir);
    }
    return path.join(os.homedir(), ".echoai");
}

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
        return str;
    }
    return str.slice(0, maxLength - 3) + "...";
}

/**
 * Normalizes whitespace in a string.
 */
export function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, " ").trim();
}

/**
 * Safely parses JSON, returning undefined on failure.
 */
export function safeJsonParse<T>(str: string): T | undefined {
    try {
        return JSON.parse(str) as T;
    } catch {
        return undefined;
    }
}

// =============================================================================
// Async Utilities
// =============================================================================

/**
 * Waits for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff.
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options?: { maxAttempts?: number; delayMs?: number; backoffMultiplier?: number }
): Promise<T> {
    const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2 } = options ?? {};
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxAttempts) {
                const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Creates a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delayMs: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | undefined;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => fn(...args), delayMs);
    };
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Checks if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks if a value is a valid positive integer.
 */
export function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Checks if a value is truthy (for env vars).
 */
export function isTruthy(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const lower = value.toLowerCase().trim();
        return lower === "true" || lower === "1" || lower === "yes";
    }
    return Boolean(value);
}
