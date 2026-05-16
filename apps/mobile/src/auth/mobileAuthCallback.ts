import type { EchoAIAuthApi } from "../api";
import type { MobileAuthState } from "../protocol";

export interface MobileAuthCallbackParams {
  code: string;
  state: string;
}

export function parseMobileAuthCallback(url: string): MobileAuthCallbackParams | null {
  const queryStart = url.indexOf("?");
  if (queryStart < 0) return null;

  const params = url
    .slice(queryStart + 1)
    .split("&")
    .reduce<Record<string, string>>((acc, pair) => {
      const [rawKey, rawValue = ""] = pair.split("=");
      const key = decodeURIComponent(rawKey);
      acc[key] = decodeURIComponent(rawValue.replace(/\+/g, " "));
      return acc;
    }, {});

  const code = params.code;
  const state = params.state;

  if (!code || !state) return null;
  return { code, state };
}

export async function completeMobileAuthCallback(
  authApi: EchoAIAuthApi,
  redirectUri: string,
  url: string,
  mode: "sign-in" | "sign-up",
): Promise<MobileAuthState | null> {
  const params = parseMobileAuthCallback(url);
  if (!params) return null;

  const request = {
    code: params.code,
    redirectUri,
    state: params.state,
  };

  return mode === "sign-in" ? authApi.completeSignIn(request) : authApi.completeSignUp(request);
}
