import { z } from "zod";

const envSchema = z.object({
  ECHOAI_WEB_APP_URL: z.string().url(),
  ECHOAI_WEB_AUTH_SECRET: z.string().min(16),
  ECHOAI_WEB_DATABASE_URL: z.string().min(1),
  ECHOAI_WEB_ENCRYPTION_KEY: z.string().min(16),
  ECHOAI_WEB_PROVIDER_VAULT_KEY: z.string().min(8),
  ECHOAI_WEB_STRIPE_SECRET: z.string().min(8),
});

const mockEnv = {
  ECHOAI_WEB_APP_URL: "http://localhost:3000",
  ECHOAI_WEB_AUTH_SECRET: "mock-auth-secret-for-local-web",
  ECHOAI_WEB_DATABASE_URL: "postgres://mock/echoai_web",
  ECHOAI_WEB_ENCRYPTION_KEY: "mock-encryption-key-for-local",
  ECHOAI_WEB_PROVIDER_VAULT_KEY: "mock-vault-key",
  ECHOAI_WEB_STRIPE_SECRET: "sk_test_mock_echoai",
};

export type EchoAIWebEnv = z.infer<typeof envSchema>;

export function getWebEnv(): EchoAIWebEnv {
  const allowMocks =
    process.env.ECHOAI_WEB_ALLOW_MOCKS === "true" || process.env.NODE_ENV !== "production";

  const candidate = allowMocks
    ? { ...mockEnv, ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("ECHOAI_WEB_"))) }
    : process.env;

  const parsed = envSchema.safeParse(candidate);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`EchoAI Web environment is invalid: ${missing}`);
  }

  return parsed.data;
}
