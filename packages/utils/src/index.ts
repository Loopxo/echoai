/**
 * EchoAI Utils - Common Utilities
 */
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Async utilities
export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export async function retry<T>(fn: () => Promise<T>, { attempts = 3, delayMs = 1000, backoff = 2 } = {}): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < attempts; i++) {
        try { return await fn(); }
        catch (e) { lastError = e as Error; await sleep(delayMs * Math.pow(backoff, i)); }
    }
    throw lastError;
}

export function timeout<T>(promise: Promise<T>, ms: number, msg = "Timeout"): Promise<T> {
    return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
    let timer: NodeJS.Timeout;
    return ((...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T;
}

export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
    let last = 0;
    return ((...args) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } }) as T;
}

// String utilities
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const camelCase = (s: string): string => s.replace(/[-_\s]+(.)?/g, (_, c) => c?.toUpperCase() || "");
export const snakeCase = (s: string): string => s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
export const kebabCase = (s: string): string => snakeCase(s).replace(/_/g, "-");
export const truncate = (s: string, len: number, suffix = "..."): string => s.length <= len ? s : s.slice(0, len - suffix.length) + suffix;

// Crypto utilities
export const randomId = (len = 16): string => randomBytes(len).toString("hex").slice(0, len);
export const hash = (data: string, algo = "sha256"): string => createHash(algo).update(data).digest("hex");

// Object utilities
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    return keys.reduce((acc, key) => { if (key in obj) acc[key] = obj[key]; return acc; }, {} as Pick<T, K>);
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) delete result[key];
    return result;
}

export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
    for (const source of sources) {
        for (const key in source) {
            const val = source[key];
            if (val && typeof val === "object" && !Array.isArray(val)) {
                (target as Record<string, unknown>)[key] = deepMerge((target as Record<string, unknown>)[key] as object || {}, val as object);
            } else {
                (target as Record<string, unknown>)[key] = val;
            }
        }
    }
    return target;
}

// Array utilities
export const chunk = <T>(arr: T[], size: number): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
export const unique = <T>(arr: T[]): T[] => [...new Set(arr)];
export const shuffle = <T>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);
export const sample = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];

// File utilities
export async function ensureDir(dir: string): Promise<void> { await fs.mkdir(dir, { recursive: true }); }
export async function fileExists(filePath: string): Promise<boolean> { try { await fs.access(filePath); return true; } catch { return false; } }
export async function readJson<T>(filePath: string): Promise<T | null> { try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return null; } }
export async function writeJson(filePath: string, data: unknown): Promise<void> { await ensureDir(path.dirname(filePath)); await fs.writeFile(filePath, JSON.stringify(data, null, 2)); }

// Validation
export const isValidEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const isValidUrl = (s: string): boolean => { try { new URL(s); return true; } catch { return false; } };
export const isValidPhone = (s: string): boolean => /^\+?[\d\s\-()]{10,}$/.test(s);
