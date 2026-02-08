/**
 * EchoAI Media - Image/Audio/Video Understanding
 */
import fs from "node:fs/promises";
import path from "node:path";

export type MediaType = "image" | "audio" | "video" | "document" | "unknown";

export interface MediaInfo {
    path: string;
    type: MediaType;
    mimeType: string;
    size: number;
    name: string;
    extension: string;
}

export interface ImageAnalysis {
    description: string;
    tags?: string[];
    text?: string; // OCR
    objects?: Array<{ label: string; confidence: number }>;
}

export interface AudioTranscription {
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{ start: number; end: number; text: string }>;
}

const MIME_MAP: Record<string, MediaType> = {
    "image/jpeg": "image", "image/png": "image", "image/gif": "image", "image/webp": "image",
    "audio/mpeg": "audio", "audio/wav": "audio", "audio/ogg": "audio", "audio/webm": "audio",
    "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
    "application/pdf": "document", "text/plain": "document",
};

const EXT_MAP: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
    ".webp": "image/webp", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".pdf": "application/pdf",
};

export function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return EXT_MAP[ext] || "application/octet-stream";
}

export function getMediaType(mimeType: string): MediaType {
    return MIME_MAP[mimeType] || "unknown";
}

export async function getMediaInfo(filePath: string): Promise<MediaInfo> {
    const stat = await fs.stat(filePath);
    const name = path.basename(filePath);
    const extension = path.extname(filePath).slice(1);
    const mimeType = getMimeType(filePath);
    return { path: filePath, type: getMediaType(mimeType), mimeType, size: stat.size, name, extension };
}

export async function loadMediaAsBase64(filePath: string): Promise<{ data: string; mimeType: string }> {
    const buffer = await fs.readFile(filePath);
    const mimeType = getMimeType(filePath);
    return { data: buffer.toString("base64"), mimeType };
}

export async function saveMedia(data: Buffer, outputPath: string): Promise<MediaInfo> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, data);
    return getMediaInfo(outputPath);
}

export interface MediaAnalyzer {
    analyzeImage(imagePath: string): Promise<ImageAnalysis>;
    transcribeAudio(audioPath: string): Promise<AudioTranscription>;
}

export class DefaultMediaAnalyzer implements MediaAnalyzer {
    private apiKey?: string;
    private baseUrl = "https://api.openai.com/v1";

    constructor(apiKey?: string) { this.apiKey = apiKey || process.env.OPENAI_API_KEY; }

    async analyzeImage(imagePath: string): Promise<ImageAnalysis> {
        if (!this.apiKey) return { description: "Image analysis requires API key" };

        const { data, mimeType } = await loadMediaAsBase64(imagePath);
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: "Describe this image in detail. Extract any text you see." },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } },
                    ],
                }],
                max_tokens: 500,
            }),
        });
        const result = await response.json() as { choices: Array<{ message: { content: string } }> };
        return { description: result.choices?.[0]?.message?.content || "No description" };
    }

    async transcribeAudio(audioPath: string): Promise<AudioTranscription> {
        if (!this.apiKey) return { text: "Audio transcription requires API key" };

        const buffer = await fs.readFile(audioPath);
        const form = new FormData();
        form.append("file", new Blob([buffer]), path.basename(audioPath));
        form.append("model", "whisper-1");

        const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: form,
        });
        const result = await response.json() as { text: string };
        return { text: result.text || "" };
    }
}

export function createMediaAnalyzer(apiKey?: string): MediaAnalyzer {
    return new DefaultMediaAnalyzer(apiKey);
}
