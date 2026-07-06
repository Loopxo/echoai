import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { createEchoAIMobileClient, type EchoAIMobileClient } from "../api/mobileClient";
import { createHttpsMobileTransport, type FetchLike } from "../api/transports";
import type { MobileClientDescriptor, MobileSessionSummary } from "../protocol";

export type RouteKey = "home" | "chats" | "new" | "settings" | "more" | "chatDetail";

interface AppStateValue {
  route: RouteKey;
  navigate: (route: RouteKey) => void;
  goBack: () => void;
  client: EchoAIMobileClient | null;
  clientReady: boolean;
  endpoint: string | null;
  sessions: MobileSessionSummary[];
  activeSession: MobileSessionSummary | null;
  openSession: (session: MobileSessionSummary) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const DESCRIPTOR: MobileClientDescriptor = {
  platform: "android",
  appVersion: "0.1.0",
  deviceId: "echoai-mobile-dev",
};

/**
 * Resolve the mobile API endpoint. In a real build this comes from app config
 * / build-time env; we read a global injected value when present so the client
 * is genuinely wired rather than a no-op.
 */
function resolveEndpoint(): string | null {
  const globalConfig = (globalThis as { ECHOAI_MOBILE_ENDPOINT?: string }).ECHOAI_MOBILE_ENDPOINT;
  return globalConfig && globalConfig.length > 0 ? globalConfig : null;
}

function buildClient(endpoint: string): EchoAIMobileClient {
  const fetchImpl: FetchLike = (input, init) =>
    (globalThis as unknown as { fetch: FetchLike }).fetch(input, init);

  const transport = createHttpsMobileTransport({
    endpointUrl: endpoint,
    fetchImpl,
    // Token integration lands with the auth/tokenStore wiring; null = anonymous.
    getAccessToken: async () => null,
  });

  return createEchoAIMobileClient({
    client: DESCRIPTOR,
    requestId: () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    now: () => new Date().toISOString(),
    transports: { https: transport },
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<RouteKey>("home");
  const [history, setHistory] = useState<RouteKey[]>([]);
  const [activeSession, setActiveSession] = useState<MobileSessionSummary | null>(null);
  const [sessions] = useState<MobileSessionSummary[]>([]);

  const endpoint = useMemo(resolveEndpoint, []);
  const client = useMemo(() => (endpoint ? buildClient(endpoint) : null), [endpoint]);

  const value = useMemo<AppStateValue>(
    () => ({
      route,
      navigate: (next) => {
        setHistory((prev) => [...prev, route]);
        setRoute(next);
      },
      goBack: () => {
        setHistory((prev) => {
          if (prev.length === 0) {
            setRoute("home");
            return prev;
          }
          const next = [...prev];
          const last = next.pop()!;
          setRoute(last);
          return next;
        });
      },
      client,
      clientReady: client !== null,
      endpoint,
      sessions,
      activeSession,
      openSession: (session) => {
        setActiveSession(session);
        setHistory((prev) => [...prev, route]);
        setRoute("chatDetail");
      },
    }),
    [route, client, endpoint, sessions, activeSession],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return value;
}
