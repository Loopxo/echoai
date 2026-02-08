/**
 * EchoAI Links - URL Parsing and Link Previews
 */

export interface LinkPreview {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    type?: string;
    favicon?: string;
}

export interface ExtractedLinks {
    urls: string[];
    emails: string[];
    phones: string[];
}

const URL_REGEX = /https?:\/\/[^\s<>"\[\]{}|\\^`]+/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

export function extractLinks(text: string): ExtractedLinks {
    return {
        urls: [...(text.match(URL_REGEX) || [])],
        emails: [...(text.match(EMAIL_REGEX) || [])],
        phones: [...(text.match(PHONE_REGEX) || [])],
    };
}

export function isValidUrl(url: string): boolean {
    try { new URL(url); return true; } catch { return false; }
}

export function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.href;
    } catch { return url; }
}

export function getDomain(url: string): string | null {
    try { return new URL(url).hostname; } catch { return null; }
}

export async function fetchLinkPreview(url: string, timeout = 10000): Promise<LinkPreview> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "EchoAI Link Preview Bot" },
        });
        clearTimeout(timer);

        if (!response.ok) return { url };
        const html = await response.text();
        return parseOpenGraph(url, html);
    } catch {
        clearTimeout(timer);
        return { url };
    }
}

function parseOpenGraph(url: string, html: string): LinkPreview {
    const preview: LinkPreview = { url };

    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    preview.title = ogTitle?.[1] || title?.[1];
    preview.description = ogDesc?.[1];
    preview.image = ogImage?.[1];
    preview.siteName = ogSite?.[1];

    // Favicon
    const favicon = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (favicon) {
        try {
            preview.favicon = new URL(favicon[1], url).href;
        } catch { /* ignore */ }
    }

    return preview;
}

export function formatPreview(preview: LinkPreview): string {
    const lines = [];
    if (preview.title) lines.push(`**${preview.title}**`);
    if (preview.description) lines.push(preview.description);
    if (preview.siteName) lines.push(`_${preview.siteName}_`);
    lines.push(preview.url);
    return lines.join("\n");
}

export async function processTextWithLinks(text: string): Promise<{ text: string; previews: LinkPreview[] }> {
    const { urls } = extractLinks(text);
    const previews = await Promise.all(urls.slice(0, 5).map(u => fetchLinkPreview(u)));
    return { text, previews };
}
