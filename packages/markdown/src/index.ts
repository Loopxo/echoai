/**
 * EchoAI Markdown - Markdown Processing
 */

export interface TableData { headers: string[]; rows: string[][]; }

export function markdownToPlainText(md: string): string {
    return md
        .replace(/\*\*(.+?)\*\*/g, "$1")     // bold
        .replace(/\*(.+?)\*/g, "$1")          // italic
        .replace(/__(.+?)__/g, "$1")          // bold alt
        .replace(/_(.+?)_/g, "$1")            // italic alt
        .replace(/~~(.+?)~~/g, "$1")          // strikethrough
        .replace(/`(.+?)`/g, "$1")            // inline code
        .replace(/```[\s\S]*?```/g, "")       // code blocks
        .replace(/!\[.*?\]\(.*?\)/g, "")      // images
        .replace(/\[(.+?)\]\(.*?\)/g, "$1")   // links
        .replace(/^#{1,6}\s+/gm, "")          // headers
        .replace(/^[-*+]\s+/gm, "• ")         // lists
        .replace(/^\d+\.\s+/gm, "")           // numbered lists
        .replace(/^>\s*/gm, "")               // blockquotes
        .replace(/\n{3,}/g, "\n\n")           // multiple newlines
        .trim();
}

export function parseTable(md: string): TableData | null {
    const lines = md.trim().split("\n");
    if (lines.length < 2) return null;
    const headerLine = lines[0];
    if (!headerLine.includes("|")) return null;
    const headers = headerLine.split("|").map(h => h.trim()).filter(Boolean);
    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
        if (!lines[i].includes("|")) continue;
        rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean));
    }
    return { headers, rows };
}

export function tableToMarkdown(data: TableData): string {
    const lines: string[] = [];
    lines.push("| " + data.headers.join(" | ") + " |");
    lines.push("| " + data.headers.map(() => "---").join(" | ") + " |");
    for (const row of data.rows) lines.push("| " + row.join(" | ") + " |");
    return lines.join("\n");
}

export function tableToPlainText(data: TableData): string {
    const widths = data.headers.map((h, i) => Math.max(h.length, ...data.rows.map(r => (r[i] || "").length)));
    const sep = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";
    const formatRow = (row: string[]) => "|" + row.map((c, i) => ` ${(c || "").padEnd(widths[i])} `).join("|") + "|";
    return [sep, formatRow(data.headers), sep, ...data.rows.map(formatRow), sep].join("\n");
}

export function formatCode(code: string, lang = ""): string { return "```" + lang + "\n" + code + "\n```"; }
export function formatBold(text: string): string { return `**${text}**`; }
export function formatItalic(text: string): string { return `*${text}*`; }
export function formatLink(text: string, url: string): string { return `[${text}](${url})`; }
export function formatList(items: string[], ordered = false): string { return items.map((item, i) => ordered ? `${i + 1}. ${item}` : `- ${item}`).join("\n"); }
export function formatHeader(text: string, level = 1): string { return "#".repeat(Math.min(6, Math.max(1, level))) + " " + text; }
export function formatBlockquote(text: string): string { return text.split("\n").map(l => "> " + l).join("\n"); }

export function truncate(text: string, maxLen: number, suffix = "..."): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - suffix.length) + suffix;
}

export function escapeMarkdown(text: string): string {
    return text.replace(/([*_`~\[\]()#>!|\\-])/g, "\\$1");
}
