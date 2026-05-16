export type EchoAILogLevel = "info" | "warn" | "error";

export function createRunId(prefix = "run"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRequestContext(source: string) {
  return {
    source,
    runId: createRunId("web"),
    requestId: createRunId("req"),
    startedAt: new Date().toISOString(),
  };
}

export function logWebEvent(level: EchoAILogLevel, message: string, fields: Record<string, unknown>) {
  const payload = {
    level,
    message,
    service: "echoai-web",
    at: new Date().toISOString(),
    ...fields,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}
