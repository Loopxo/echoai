export type GatewayConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "reconnecting" | "failed";
export type GatewayReconnectTrigger = "app-foreground" | "network-online" | "network-changed" | "manual";

export interface GatewayReconnectSnapshot {
  attempt: number;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  nextDelayMs: number;
  state: GatewayConnectionState;
  trigger?: GatewayReconnectTrigger;
}

const reconnectDelaysMs = [0, 1000, 3000, 8000, 15000, 30000] as const;

export class EchoAIGatewayReconnectController {
  private snapshot: GatewayReconnectSnapshot = {
    attempt: 0,
    nextDelayMs: 0,
    state: "idle",
  };

  getSnapshot(): GatewayReconnectSnapshot {
    return this.snapshot;
  }

  markConnected(now: Date = new Date()): GatewayReconnectSnapshot {
    this.snapshot = {
      attempt: 0,
      lastConnectedAt: now.toISOString(),
      nextDelayMs: 0,
      state: "connected",
    };
    return this.snapshot;
  }

  markDisconnected(now: Date = new Date()): GatewayReconnectSnapshot {
    this.snapshot = {
      ...this.snapshot,
      lastDisconnectedAt: now.toISOString(),
      state: "disconnected",
    };
    return this.snapshot;
  }

  requestReconnect(trigger: GatewayReconnectTrigger): GatewayReconnectSnapshot {
    const attempt = this.snapshot.attempt + 1;
    this.snapshot = {
      ...this.snapshot,
      attempt,
      nextDelayMs: reconnectDelaysMs[Math.min(attempt, reconnectDelaysMs.length - 1)],
      state: "reconnecting",
      trigger,
    };
    return this.snapshot;
  }
}

export function createEchoAIGatewayReconnectController(): EchoAIGatewayReconnectController {
  return new EchoAIGatewayReconnectController();
}
