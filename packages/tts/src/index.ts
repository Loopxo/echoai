/**
 * EchoAI Text-to-Speech System
 *
 * Multi-provider TTS with automatic fallback:
 * - OpenAI TTS (high quality, fast)
 * - ElevenLabs (natural voices, customizable)
 * - Microsoft Edge TTS (free, good quality)
 *
 * Features:
 * - Voice preference persistence
 * - Auto-summarization for long text
 * - Channel-optimized output formats
 */

import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

// =============================================================================
// Types
// =============================================================================

export type TtsProvider = "openai" | "elevenlabs" | "edge";
export type TtsAutoMode = "off" | "always" | "inbound" | "tagged";
export type TtsMode = "final" | "streaming";

export interface TtsConfig {
    auto?: TtsAutoMode;
    enabled?: boolean;
    mode?: TtsMode;
    provider?: TtsProvider;
    summaryModel?: string;
    maxTextLength?: number;
    timeoutMs?: number;
    prefsPath?: string;
    openai?: {
        apiKey?: string;
        model?: string;
        voice?: string;
    };
    elevenlabs?: {
        apiKey?: string;
        baseUrl?: string;
        voiceId?: string;
        modelId?: string;
        voiceSettings?: {
            stability?: number;
            similarityBoost?: number;
            style?: number;
            useSpeakerBoost?: boolean;
            speed?: number;
        };
    };
    edge?: {
        enabled?: boolean;
        voice?: string;
        lang?: string;
        outputFormat?: string;
        pitch?: string;
        rate?: string;
        volume?: string;
    };
}

export interface ResolvedTtsConfig {
    auto: TtsAutoMode;
    mode: TtsMode;
    provider: TtsProvider;
    summaryModel?: string;
    maxTextLength: number;
    timeoutMs: number;
    openai: {
        apiKey?: string;
        model: string;
        voice: string;
    };
    elevenlabs: {
        apiKey?: string;
        baseUrl: string;
        voiceId: string;
        modelId: string;
        voiceSettings: {
            stability: number;
            similarityBoost: number;
            style: number;
            useSpeakerBoost: boolean;
            speed: number;
        };
    };
    edge: {
        enabled: boolean;
        voice: string;
        lang: string;
        outputFormat: string;
        pitch?: string;
        rate?: string;
        volume?: string;
    };
    prefsPath: string;
}

export interface TtsResult {
    success: boolean;
    audioPath?: string;
    error?: string;
    latencyMs?: number;
    provider?: TtsProvider;
    outputFormat?: string;
    voiceCompatible?: boolean;
}

interface TtsUserPrefs {
    tts?: {
        auto?: TtsAutoMode;
        enabled?: boolean;
        provider?: TtsProvider;
        maxLength?: number;
        summarize?: boolean;
    };
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TEXT_LENGTH = 4096;

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_VOICE = "alloy";
const DEFAULT_ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_ELEVENLABS_VOICE_ID = "pMsXgVXv3BLzUgSXRplE";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_EDGE_VOICE = "en-US-MichelleNeural";
const DEFAULT_EDGE_LANG = "en-US";
const DEFAULT_EDGE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

const DEFAULT_ELEVENLABS_VOICE_SETTINGS = {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true,
    speed: 1.0,
};

const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const OPENAI_MODELS = ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"];
const TTS_PROVIDERS: TtsProvider[] = ["openai", "elevenlabs", "edge"];

// =============================================================================
// Config Resolution
// =============================================================================

export function resolveTtsConfig(rawConfig?: TtsConfig): ResolvedTtsConfig {
    const config = rawConfig ?? {};
    const auto = normalizeTtsAutoMode(config.auto) ?? (config.enabled ? "always" : "off");

    const prefsPath = config.prefsPath?.trim() ||
        process.env.ECHOAI_TTS_PREFS?.trim() ||
        path.join(process.env.HOME || "~", ".echoai", "settings", "tts.json");

    return {
        auto,
        mode: config.mode ?? "final",
        provider: config.provider ?? "edge",
        summaryModel: config.summaryModel?.trim() || undefined,
        maxTextLength: config.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH,
        timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        openai: {
            apiKey: config.openai?.apiKey,
            model: config.openai?.model ?? DEFAULT_OPENAI_MODEL,
            voice: config.openai?.voice ?? DEFAULT_OPENAI_VOICE,
        },
        elevenlabs: {
            apiKey: config.elevenlabs?.apiKey,
            baseUrl: config.elevenlabs?.baseUrl?.trim() || DEFAULT_ELEVENLABS_BASE_URL,
            voiceId: config.elevenlabs?.voiceId ?? DEFAULT_ELEVENLABS_VOICE_ID,
            modelId: config.elevenlabs?.modelId ?? DEFAULT_ELEVENLABS_MODEL_ID,
            voiceSettings: {
                stability: config.elevenlabs?.voiceSettings?.stability ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS.stability,
                similarityBoost: config.elevenlabs?.voiceSettings?.similarityBoost ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS.similarityBoost,
                style: config.elevenlabs?.voiceSettings?.style ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS.style,
                useSpeakerBoost: config.elevenlabs?.voiceSettings?.useSpeakerBoost ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS.useSpeakerBoost,
                speed: config.elevenlabs?.voiceSettings?.speed ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS.speed,
            },
        },
        edge: {
            enabled: config.edge?.enabled ?? true,
            voice: config.edge?.voice?.trim() || DEFAULT_EDGE_VOICE,
            lang: config.edge?.lang?.trim() || DEFAULT_EDGE_LANG,
            outputFormat: config.edge?.outputFormat?.trim() || DEFAULT_EDGE_OUTPUT_FORMAT,
            pitch: config.edge?.pitch?.trim() || undefined,
            rate: config.edge?.rate?.trim() || undefined,
            volume: config.edge?.volume?.trim() || undefined,
        },
        prefsPath,
    };
}

function normalizeTtsAutoMode(value: unknown): TtsAutoMode | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (["off", "always", "inbound", "tagged"].includes(normalized)) {
        return normalized as TtsAutoMode;
    }
    return undefined;
}

// =============================================================================
// User Preferences
// =============================================================================

function readPrefs(prefsPath: string): TtsUserPrefs {
    try {
        if (!existsSync(prefsPath)) {
            return {};
        }
        return JSON.parse(readFileSync(prefsPath, "utf8")) as TtsUserPrefs;
    } catch {
        return {};
    }
}

function writePrefs(prefsPath: string, prefs: TtsUserPrefs): void {
    mkdirSync(path.dirname(prefsPath), { recursive: true });
    const tmpPath = `${prefsPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    writeFileSync(tmpPath, JSON.stringify(prefs, null, 2));
    try {
        renameSync(tmpPath, prefsPath);
    } catch (err) {
        try { unlinkSync(tmpPath); } catch { /* ignore */ }
        throw err;
    }
}

export function isTtsEnabled(config: ResolvedTtsConfig, sessionAuto?: string): boolean {
    const sessionMode = normalizeTtsAutoMode(sessionAuto);
    if (sessionMode) {
        return sessionMode !== "off";
    }
    const prefsAuto = normalizeTtsAutoMode(readPrefs(config.prefsPath).tts?.auto);
    if (prefsAuto) {
        return prefsAuto !== "off";
    }
    return config.auto !== "off";
}

export function setTtsEnabled(config: ResolvedTtsConfig, enabled: boolean): void {
    const prefs = readPrefs(config.prefsPath);
    prefs.tts = { ...prefs.tts, auto: enabled ? "always" : "off" };
    writePrefs(config.prefsPath, prefs);
}

export function getTtsProvider(config: ResolvedTtsConfig): TtsProvider {
    const prefs = readPrefs(config.prefsPath);
    if (prefs.tts?.provider) {
        return prefs.tts.provider;
    }

    // Auto-select based on available API keys
    if (resolveTtsApiKey(config, "openai")) {
        return "openai";
    }
    if (resolveTtsApiKey(config, "elevenlabs")) {
        return "elevenlabs";
    }
    return "edge";
}

export function setTtsProvider(config: ResolvedTtsConfig, provider: TtsProvider): void {
    const prefs = readPrefs(config.prefsPath);
    prefs.tts = { ...prefs.tts, provider };
    writePrefs(config.prefsPath, prefs);
}

export function resolveTtsApiKey(config: ResolvedTtsConfig, provider: TtsProvider): string | undefined {
    if (provider === "elevenlabs") {
        return config.elevenlabs.apiKey || process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
    }
    if (provider === "openai") {
        return config.openai.apiKey || process.env.OPENAI_API_KEY;
    }
    return undefined;
}

export function isTtsProviderConfigured(config: ResolvedTtsConfig, provider: TtsProvider): boolean {
    if (provider === "edge") {
        return config.edge.enabled;
    }
    return Boolean(resolveTtsApiKey(config, provider));
}

// =============================================================================
// TTS Generation
// =============================================================================

export async function synthesizeSpeech(
    text: string,
    options: {
        config?: ResolvedTtsConfig;
        provider?: TtsProvider;
        channel?: string;
    } = {}
): Promise<TtsResult> {
    const config = options.config ?? resolveTtsConfig();
    const provider = options.provider ?? getTtsProvider(config);
    const startTime = Date.now();

    // Validate text
    const trimmedText = text?.trim();
    if (!trimmedText) {
        return { success: false, error: "No text provided for TTS" };
    }

    if (trimmedText.length > config.maxTextLength) {
        return {
            success: false,
            error: `Text too long: ${trimmedText.length} chars (max ${config.maxTextLength})`,
        };
    }

    // Try providers in order
    const providerOrder = resolveProviderOrder(provider);
    let lastError: string | undefined;

    for (const tryProvider of providerOrder) {
        if (!isTtsProviderConfigured(config, tryProvider)) {
            continue;
        }

        try {
            const result = await generateAudio(trimmedText, tryProvider, config, options.channel);
            return {
                success: true,
                audioPath: result.path,
                latencyMs: Date.now() - startTime,
                provider: tryProvider,
                outputFormat: result.format,
                voiceCompatible: result.voiceCompatible,
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            console.warn(`[tts] ${tryProvider} failed: ${lastError}`);
        }
    }

    return {
        success: false,
        error: lastError ?? "No TTS provider available",
        latencyMs: Date.now() - startTime,
    };
}

function resolveProviderOrder(primary: TtsProvider): TtsProvider[] {
    return [primary, ...TTS_PROVIDERS.filter((p) => p !== primary)];
}

async function generateAudio(
    text: string,
    provider: TtsProvider,
    config: ResolvedTtsConfig,
    channel?: string
): Promise<{ path: string; format: string; voiceCompatible: boolean }> {
    switch (provider) {
        case "openai":
            return generateOpenAiAudio(text, config, channel);
        case "elevenlabs":
            return generateElevenLabsAudio(text, config, channel);
        case "edge":
        default:
            return generateEdgeAudio(text, config);
    }
}

// =============================================================================
// OpenAI TTS
// =============================================================================

async function generateOpenAiAudio(
    text: string,
    config: ResolvedTtsConfig,
    channel?: string
): Promise<{ path: string; format: string; voiceCompatible: boolean }> {
    const apiKey = resolveTtsApiKey(config, "openai");
    if (!apiKey) {
        throw new Error("OpenAI API key not configured");
    }

    const isTelegram = channel === "telegram";
    const responseFormat = isTelegram ? "opus" : "mp3";
    const extension = isTelegram ? ".opus" : ".mp3";

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: config.openai.model,
            voice: config.openai.voice,
            input: text,
            response_format: responseFormat,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI TTS error: ${error}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const tempDir = mkdtempSync(path.join(tmpdir(), "echoai-tts-"));
    const filePath = path.join(tempDir, `speech${extension}`);
    writeFileSync(filePath, buffer);

    scheduleTempCleanup(tempDir);

    return {
        path: filePath,
        format: responseFormat,
        voiceCompatible: isTelegram,
    };
}

// =============================================================================
// ElevenLabs TTS
// =============================================================================

async function generateElevenLabsAudio(
    text: string,
    config: ResolvedTtsConfig,
    channel?: string
): Promise<{ path: string; format: string; voiceCompatible: boolean }> {
    const apiKey = resolveTtsApiKey(config, "elevenlabs");
    if (!apiKey) {
        throw new Error("ElevenLabs API key not configured");
    }

    const isTelegram = channel === "telegram";
    const outputFormat = isTelegram ? "opus_48000_64" : "mp3_44100_128";
    const extension = isTelegram ? ".opus" : ".mp3";

    const baseUrl = config.elevenlabs.baseUrl.replace(/\/+$/, "");
    const voiceId = config.elevenlabs.voiceId;
    const url = `${baseUrl}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
        },
        body: JSON.stringify({
            text,
            model_id: config.elevenlabs.modelId,
            voice_settings: {
                stability: config.elevenlabs.voiceSettings.stability,
                similarity_boost: config.elevenlabs.voiceSettings.similarityBoost,
                style: config.elevenlabs.voiceSettings.style,
                use_speaker_boost: config.elevenlabs.voiceSettings.useSpeakerBoost,
            },
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs TTS error: ${error}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const tempDir = mkdtempSync(path.join(tmpdir(), "echoai-tts-"));
    const filePath = path.join(tempDir, `speech${extension}`);
    writeFileSync(filePath, buffer);

    scheduleTempCleanup(tempDir);

    return {
        path: filePath,
        format: outputFormat,
        voiceCompatible: isTelegram,
    };
}

// =============================================================================
// Microsoft Edge TTS (Free)
// =============================================================================

async function generateEdgeAudio(
    text: string,
    config: ResolvedTtsConfig
): Promise<{ path: string; format: string; voiceCompatible: boolean }> {
    const tempDir = mkdtempSync(path.join(tmpdir(), "echoai-tts-"));
    const filePath = path.join(tempDir, "speech.mp3");

    // node-edge-tts API: options go in constructor, ttsPromise(text, path) 
    const tts = new EdgeTTS({
        voice: config.edge.voice,
        lang: config.edge.lang,
        outputFormat: config.edge.outputFormat,
        pitch: config.edge.pitch || undefined,
        rate: config.edge.rate || undefined,
        volume: config.edge.volume || undefined,
    });

    await tts.ttsPromise(text, filePath);

    scheduleTempCleanup(tempDir);

    return {
        path: filePath,
        format: "mp3",
        voiceCompatible: false,
    };
}

// =============================================================================
// Utilities
// =============================================================================

function scheduleTempCleanup(tempDir: string, delayMs = 5 * 60 * 1000): void {
    setTimeout(() => {
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch { /* ignore */ }
    }, delayMs);
}

export function isValidOpenAiVoice(voice: string): boolean {
    return OPENAI_VOICES.includes(voice.toLowerCase());
}

export function isValidOpenAiModel(model: string): boolean {
    return OPENAI_MODELS.includes(model.toLowerCase());
}

export function getAvailableVoices(provider: TtsProvider): string[] {
    switch (provider) {
        case "openai":
            return [...OPENAI_VOICES];
        case "elevenlabs":
            return ["Default (pMsXgVXv3BLzUgSXRplE)"];
        case "edge":
            return [
                "en-US-MichelleNeural",
                "en-US-GuyNeural",
                "en-US-JennyNeural",
                "en-GB-SoniaNeural",
                "en-AU-NatashaNeural",
            ];
        default:
            return [];
    }
}

// =============================================================================
// Exports
// =============================================================================

export { TTS_PROVIDERS, OPENAI_VOICES, OPENAI_MODELS };
