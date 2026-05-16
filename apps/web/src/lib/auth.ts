import type { EchoAIAuthSession, EchoAIRole } from "@echoai/contracts";
import { workspaceState } from "./data";

const adminRoles: EchoAIRole[] = ["owner", "admin"];

export function getMockSession(): EchoAIAuthSession {
  return workspaceState.session;
}

export function canAccess(role: EchoAIRole, area: "billing" | "provider-keys" | "admin" | "workspace"): boolean {
  if (area === "workspace") {
    return true;
  }

  if (area === "billing" || area === "provider-keys" || area === "admin") {
    return adminRoles.includes(role);
  }

  return false;
}

export function refreshSession(session: EchoAIAuthSession): EchoAIAuthSession {
  return {
    ...session,
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
}

export function createDefaultWorkspace(email: string): EchoAIAuthSession {
  return {
    ...workspaceState.session,
    id: `session_${email.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`,
    email,
    refreshedAt: new Date().toISOString(),
  };
}
