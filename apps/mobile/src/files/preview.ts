import type { MobileFileSummary } from "../protocol";

export type FilePreviewKind = "image" | "text" | "pdf" | "markdown" | "code" | "metadata";

export function getFilePreviewKind(file: MobileFileSummary): FilePreviewKind {
  const mimeType = file.mimeType ?? "";
  const name = file.name.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".md") || name.endsWith(".mdx")) return "markdown";
  if (/\.(ts|tsx|js|jsx|json|css|html|py|go|rs|swift|kt)$/.test(name)) return "code";
  if (mimeType.startsWith("text/")) return "text";
  return "metadata";
}
