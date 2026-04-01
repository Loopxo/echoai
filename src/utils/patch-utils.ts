import { applyPatch as applyTextPatch } from 'diff';

export function extractUnifiedDiff(response: string): string | null {
  const trimmed = response.trim();
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:diff|patch)?\n([\s\S]*?)```/i);
  const fencedContent = fencedMatch?.[1];
  const candidate = fencedContent ? fencedContent.trim() : trimmed;

  if (looksLikeUnifiedDiff(candidate)) {
    return candidate;
  }

  return null;
}

export function applyUnifiedDiff(original: string, patch: string): string | null {
  const next = applyTextPatch(original, patch);
  return next === false ? null : next;
}

function looksLikeUnifiedDiff(content: string): boolean {
  return content.includes('@@')
    && (content.includes('--- ') || content.includes('diff --git'));
}
