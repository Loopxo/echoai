import { createHmac, timingSafeEqual } from "node:crypto";
import type { EchoAIAuthSession, EchoAIWorkspaceState } from "@echoai/contracts";
import { makeId } from "./store";

const cookieName = "echoai_web_session";

function secret() {
  return process.env.ECHOAI_WEB_AUTH_SECRET || "mock-auth-secret-for-local-web";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeSession(session: EchoAIAuthSession) {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): EchoAIAuthSession | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EchoAIAuthSession;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

export function sessionCookieName() {
  return cookieName;
}

export function createSignedSession(state: EchoAIWorkspaceState, email = state.session.email): EchoAIAuthSession {
  return {
    ...state.session,
    id: makeId("session"),
    email,
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
}

export function makeSessionCookie(session: EchoAIAuthSession) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=${encodeSession(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionFromRequest(request: Request): EchoAIAuthSession | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? decodeSession(match[1]) : null;
}

export function createNativeBearerToken(session: EchoAIAuthSession) {
  return encodeSession({
    ...session,
    id: makeId("native"),
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
  });
}

export function readBearerSession(request: Request): EchoAIAuthSession | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return decodeSession(header.slice("Bearer ".length));
}
