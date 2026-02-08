/**
 * EchoAI Voice Wake
 *
 * Wake word detection and configuration management.
 * Integrates with native apps (macOS, iOS, Android) for
 * always-on voice activation.
 *
 * Features:
 * - Configurable wake/trigger words
 * - Persistent settings storage
 * - Gateway integration for sync
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// =============================================================================
// Types
// =============================================================================

export interface VoiceWakeConfig {
    /** List of trigger words that activate the assistant */
    triggers: string[];
    /** Timestamp of last update */
    updatedAtMs: number;
    /** Whether voice wake is enabled */
    enabled: boolean;
    /** Sensitivity level (0.0 - 1.0) */
    sensitivity: number;
    /** Audio input device (null = default) */
    inputDevice: string | null;
}

export interface VoiceWakeEvent {
    type: "wake" | "command" | "cancel" | "timeout";
    trigger?: string;
    transcript?: string;
    confidence?: number;
    timestamp: number;
}

export interface VoiceWakeListenerOptions {
    onWake?: (event: VoiceWakeEvent) => void;
    onCommand?: (event: VoiceWakeEvent) => void;
    onError?: (error: Error) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TRIGGERS = ["echo", "hey echo", "computer"];
const DEFAULT_SENSITIVITY = 0.5;
const CONFIG_FILENAME = "voicewake.json";

// =============================================================================
// State Directory
// =============================================================================

function resolveStateDir(): string {
    return process.env.ECHOAI_STATE_DIR?.trim() ||
        path.join(process.env.HOME || "~", ".echoai");
}

function resolvePath(baseDir?: string): string {
    const root = baseDir ?? resolveStateDir();
    return path.join(root, "settings", CONFIG_FILENAME);
}

// =============================================================================
// File Utilities
// =============================================================================

async function readJSON<T>(filePath: string): Promise<T | null> {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function writeJSONAtomic(filePath: string, value: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(tmp, filePath);
}

// =============================================================================
// Lock Mechanism
// =============================================================================

let lock: Promise<void> = Promise.resolve();

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = lock;
    let release: (() => void) | undefined;
    lock = new Promise<void>((resolve) => {
        release = resolve;
    });
    await prev;
    try {
        return await fn();
    } finally {
        release?.();
    }
}

// =============================================================================
// Trigger Validation
// =============================================================================

function sanitizeTriggers(triggers: string[] | undefined | null): string[] {
    const cleaned = (triggers ?? [])
        .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
        .filter((w) => w.length > 0 && w.length <= 50);
    return cleaned.length > 0 ? [...new Set(cleaned)] : [...DEFAULT_TRIGGERS];
}

function normalizeVoiceWakeTriggers(triggers: unknown[]): string[] {
    return triggers
        .filter((item): item is string => typeof item === "string")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && s.length <= 50)
        .slice(0, 20);
}

// =============================================================================
// Configuration Management
// =============================================================================

export function defaultVoiceWakeTriggers(): string[] {
    return [...DEFAULT_TRIGGERS];
}

export function defaultVoiceWakeConfig(): VoiceWakeConfig {
    return {
        triggers: defaultVoiceWakeTriggers(),
        updatedAtMs: 0,
        enabled: false,
        sensitivity: DEFAULT_SENSITIVITY,
        inputDevice: null,
    };
}

export async function loadVoiceWakeConfig(baseDir?: string): Promise<VoiceWakeConfig> {
    const filePath = resolvePath(baseDir);
    const existing = await readJSON<Partial<VoiceWakeConfig>>(filePath);

    if (!existing) {
        return defaultVoiceWakeConfig();
    }

    return {
        triggers: sanitizeTriggers(existing.triggers),
        updatedAtMs:
            typeof existing.updatedAtMs === "number" && existing.updatedAtMs > 0
                ? existing.updatedAtMs
                : 0,
        enabled: existing.enabled === true,
        sensitivity:
            typeof existing.sensitivity === "number" &&
                existing.sensitivity >= 0 &&
                existing.sensitivity <= 1
                ? existing.sensitivity
                : DEFAULT_SENSITIVITY,
        inputDevice:
            typeof existing.inputDevice === "string" && existing.inputDevice.trim()
                ? existing.inputDevice.trim()
                : null,
    };
}

export async function saveVoiceWakeConfig(
    config: Partial<VoiceWakeConfig>,
    baseDir?: string
): Promise<VoiceWakeConfig> {
    const filePath = resolvePath(baseDir);

    return await withLock(async () => {
        const current = await loadVoiceWakeConfig(baseDir);
        const next: VoiceWakeConfig = {
            triggers: config.triggers !== undefined
                ? sanitizeTriggers(config.triggers)
                : current.triggers,
            updatedAtMs: Date.now(),
            enabled: config.enabled !== undefined ? config.enabled : current.enabled,
            sensitivity: config.sensitivity !== undefined
                ? Math.max(0, Math.min(1, config.sensitivity))
                : current.sensitivity,
            inputDevice: config.inputDevice !== undefined
                ? (config.inputDevice?.trim() || null)
                : current.inputDevice,
        };
        await writeJSONAtomic(filePath, next);
        return next;
    });
}

export async function setVoiceWakeTriggers(
    triggers: string[],
    baseDir?: string
): Promise<VoiceWakeConfig> {
    return saveVoiceWakeConfig({ triggers }, baseDir);
}

export async function setVoiceWakeEnabled(
    enabled: boolean,
    baseDir?: string
): Promise<VoiceWakeConfig> {
    return saveVoiceWakeConfig({ enabled }, baseDir);
}

export async function setVoiceWakeSensitivity(
    sensitivity: number,
    baseDir?: string
): Promise<VoiceWakeConfig> {
    return saveVoiceWakeConfig({ sensitivity }, baseDir);
}

// =============================================================================
// Gateway Request Handlers
// =============================================================================

export interface VoiceWakeHandlerContext {
    broadcastVoiceWakeChanged: (triggers: string[]) => void;
}

export interface VoiceWakeHandlerParams {
    respond: (success: boolean, data?: unknown, error?: unknown) => void;
    params: Record<string, unknown>;
    context: VoiceWakeHandlerContext;
}

export const voicewakeHandlers = {
    "voicewake.get": async ({ respond }: VoiceWakeHandlerParams): Promise<void> => {
        try {
            const cfg = await loadVoiceWakeConfig();
            respond(true, {
                triggers: cfg.triggers,
                enabled: cfg.enabled,
                sensitivity: cfg.sensitivity,
            });
        } catch (err) {
            respond(false, undefined, { message: String(err) });
        }
    },

    "voicewake.set": async ({ params, respond, context }: VoiceWakeHandlerParams): Promise<void> => {
        try {
            const updates: Partial<VoiceWakeConfig> = {};

            if (Array.isArray(params.triggers)) {
                updates.triggers = normalizeVoiceWakeTriggers(params.triggers);
            }
            if (typeof params.enabled === "boolean") {
                updates.enabled = params.enabled;
            }
            if (typeof params.sensitivity === "number") {
                updates.sensitivity = params.sensitivity;
            }

            if (Object.keys(updates).length === 0) {
                respond(false, undefined, { message: "No valid parameters provided" });
                return;
            }

            const cfg = await saveVoiceWakeConfig(updates);
            context.broadcastVoiceWakeChanged(cfg.triggers);
            respond(true, {
                triggers: cfg.triggers,
                enabled: cfg.enabled,
                sensitivity: cfg.sensitivity,
            });
        } catch (err) {
            respond(false, undefined, { message: String(err) });
        }
    },

    "voicewake.test": async ({ respond }: VoiceWakeHandlerParams): Promise<void> => {
        // Test endpoint to verify voice wake is responding
        respond(true, { status: "ready", timestamp: Date.now() });
    },
};

// =============================================================================
// Exports
// =============================================================================

export { normalizeVoiceWakeTriggers };
