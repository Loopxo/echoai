import type {
  KernelPromptSection,
  KernelPromptSectionContext,
  KernelSession,
  KernelSystemPromptConfig,
} from "./types.js";

const STATIC_PROMPT_CACHE_KEY = "__systemPromptSectionCache";

export function normalizeSystemPrompt(
  systemPrompt?: string | KernelSystemPromptConfig
): KernelSystemPromptConfig | undefined {
  if (!systemPrompt) {
    return undefined;
  }

  if (typeof systemPrompt === "string") {
    return { basePrompt: systemPrompt };
  }

  return systemPrompt;
}

export async function resolveSystemPrompt(
  session: KernelSession,
  config: KernelSystemPromptConfig | undefined,
  context: KernelPromptSectionContext
): Promise<string | undefined> {
  if (!config) {
    return undefined;
  }

  const parts: string[] = [];
  if (config.basePrompt?.trim()) {
    parts.push(config.basePrompt.trim());
  }

  const sections = config.sections ?? [];
  if (sections.length === 0) {
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  const cache = getStaticSectionCache(session);
  const resolvedSections = await Promise.all(
    sections.map((section) => resolveSection(section, cache, context))
  );

  for (const value of resolvedSections) {
    if (value) {
      parts.push(value);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function getStaticSectionCache(session: KernelSession): Record<string, string | null> {
  const existing = session.metadata[STATIC_PROMPT_CACHE_KEY];
  if (isStringRecord(existing)) {
    return existing;
  }

  const fresh: Record<string, string | null> = {};
  session.metadata[STATIC_PROMPT_CACHE_KEY] = fresh;
  return fresh;
}

async function resolveSection(
  section: KernelPromptSection,
  cache: Record<string, string | null>,
  context: KernelPromptSectionContext
): Promise<string | null> {
  if (section.mode === "static" && Object.prototype.hasOwnProperty.call(cache, section.name)) {
    return cache[section.name] ?? null;
  }

  const computed = await section.compute(context);
  const normalized = computed?.trim() ? computed.trim() : null;
  if (section.mode === "static") {
    cache[section.name] = normalized;
  }

  return normalized;
}

function isStringRecord(value: unknown): value is Record<string, string | null> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => typeof entry === "string" || entry === null
  );
}
