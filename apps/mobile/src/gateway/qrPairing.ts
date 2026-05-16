import type { EchoAIGatewayNativeModule } from "../native";
import type { MobilePairingChallenge } from "../protocol";

import type { GatewayDiscoveryEndpoint } from "./discovery";

export interface EchoAIPairingQrPayload {
  endpoint: GatewayDiscoveryEndpoint;
  expiresAt: string;
  fingerprintSha256?: string;
  pairingToken?: string;
  protocolVersion: 1;
}

export class EchoAIQrPairing {
  constructor(private readonly gateway: EchoAIGatewayNativeModule) {}

  async startFromPayload(payload: EchoAIPairingQrPayload): Promise<MobilePairingChallenge> {
    assertQrPayloadFresh(payload);
    return this.gateway.startPairing(payload.endpoint);
  }
}

export function parseEchoAIPairingQr(value: string): EchoAIPairingQrPayload {
  const trimmed = value.trim();
  const json = trimmed.startsWith("echoai://pair?") ? parsePairingDeepLink(trimmed) : JSON.parse(trimmed);
  return assertQrPayloadShape(json);
}

export function createEchoAIQrPairing(gateway: EchoAIGatewayNativeModule): EchoAIQrPairing {
  return new EchoAIQrPairing(gateway);
}

function parsePairingDeepLink(value: string): unknown {
  const queryIndex = value.indexOf("?");
  const params = new Map<string, string>();
  const query = queryIndex >= 0 ? value.slice(queryIndex + 1) : "";
  for (const pair of query.split("&")) {
    const [rawKey, rawValue] = pair.split("=");
    if (rawKey) {
      params.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue ?? ""));
    }
  }

  return {
    endpoint: {
      displayName: params.get("name") ?? params.get("host") ?? "Desktop gateway",
      host: params.get("host"),
      id: params.get("id") ?? `qr:${params.get("host")}:${params.get("port")}`,
      port: Number.parseInt(params.get("port") ?? "", 10),
      source: "manual",
      tls: params.get("tls") !== "false",
    },
    expiresAt: params.get("expiresAt"),
    fingerprintSha256: params.get("fingerprint"),
    pairingToken: params.get("token"),
    protocolVersion: 1,
  };
}

function assertQrPayloadShape(value: unknown): EchoAIPairingQrPayload {
  const payload = value as EchoAIPairingQrPayload;
  if (
    payload?.protocolVersion !== 1 ||
    !payload.endpoint?.host ||
    !Number.isInteger(payload.endpoint.port) ||
    !payload.expiresAt
  ) {
    throw new Error("Invalid EchoAI pairing QR payload");
  }

  return payload;
}

function assertQrPayloadFresh(payload: EchoAIPairingQrPayload): void {
  const expiresAt = new Date(payload.expiresAt).getTime();
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("EchoAI pairing QR has expired");
  }
}
