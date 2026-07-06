/**
 * Real client for the hosted EchoAI Cloud model gateway.
 *
 * When `ECHOAI_WEB_CLOUD_API_URL` and `ECHOAI_WEB_CLOUD_TOKEN` are configured,
 * the web app routes completions to the hosted cloud (which itself routes to
 * the cheap Chinese providers and meters credits). When they are not set, the
 * caller falls back to the local deterministic path so local dev still works.
 *
 * This is the "production adapter that fails closed until credentials are
 * present" pattern from the surpass-overlay plan.
 */

export interface CloudChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface CloudCompletionResult {
  content: string;
  provider: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  costUsdMicros?: number;
  live: boolean;
}

export function isCloudConfigured(): boolean {
  return Boolean(process.env.ECHOAI_WEB_CLOUD_API_URL && process.env.ECHOAI_WEB_CLOUD_TOKEN);
}

function cloudBaseUrl(): string {
  return (process.env.ECHOAI_WEB_CLOUD_API_URL || "").replace(/\/$/, "");
}

/**
 * Call the hosted cloud `/chat/completions` endpoint. Throws on transport or
 * upstream errors so the caller can fall back gracefully.
 */
export async function cloudComplete(input: {
  model: string;
  messages: CloudChatMessage[];
  sessionId?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<CloudCompletionResult> {
  const base = cloudBaseUrl();
  const token = process.env.ECHOAI_WEB_CLOUD_TOKEN || "";
  if (!base || !token) {
    throw new Error("EchoAI Cloud is not configured (ECHOAI_WEB_CLOUD_API_URL / ECHOAI_WEB_CLOUD_TOKEN)");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        sessionId: input.sessionId,
        temperature: input.temperature,
        maxTokens: input.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`EchoAI Cloud error ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      content?: string;
      metadata?: { usage?: { prompt_tokens?: number; completion_tokens?: number }; cost?: number };
    };

    return {
      content: data.content ?? "",
      provider: "echoai-cloud",
      model: input.model,
      usage: data.metadata?.usage,
      costUsdMicros: data.metadata?.cost,
      live: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
