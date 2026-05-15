import {
  type MobileClientDescriptor,
  type MobileProtocolMethod,
  type MobileProtocolRequest,
  type MobileProtocolRequestMap,
  type MobileProtocolResponse,
  type MobileProtocolResponseMap,
  evaluateMobileProtocolVersion,
  mobileApiContract,
  MOBILE_PROTOCOL_VERSION,
} from "../protocol";

export type EchoAIMobileTransportKind = "https" | "gateway-rpc" | "websocket";

export interface EchoAIMobileTransport {
  readonly kind: EchoAIMobileTransportKind;
  request<TMethod extends MobileProtocolMethod>(
    method: TMethod,
    envelope: MobileProtocolRequest<TMethod>,
  ): Promise<MobileProtocolResponse<TMethod>>;
}

export interface EchoAIMobileClientOptions {
  client: MobileClientDescriptor;
  requestId: () => string;
  now: () => string;
  transports: Partial<Record<EchoAIMobileTransportKind, EchoAIMobileTransport>>;
}

export class EchoAIMobileClient {
  private readonly client: MobileClientDescriptor;
  private readonly requestId: () => string;
  private readonly now: () => string;
  private readonly transports: Partial<Record<EchoAIMobileTransportKind, EchoAIMobileTransport>>;

  constructor(options: EchoAIMobileClientOptions) {
    this.client = options.client;
    this.requestId = options.requestId;
    this.now = options.now;
    this.transports = options.transports;
  }

  async request<TMethod extends MobileProtocolMethod>(
    method: TMethod,
    payload: MobileProtocolRequestMap[TMethod],
    transportKind?: EchoAIMobileTransportKind,
  ): Promise<MobileProtocolResponseMap[TMethod]> {
    const descriptor = mobileApiContract.methods[method];
    const selectedTransport = transportKind ?? descriptor.transports[0];
    const transport = this.transports[selectedTransport];

    if (!transport) {
      throw new Error(`EchoAI mobile transport unavailable: ${selectedTransport}`);
    }

    const envelope: MobileProtocolRequest<TMethod> = {
      protocolVersion: MOBILE_PROTOCOL_VERSION,
      requestId: this.requestId(),
      issuedAt: this.now(),
      client: this.client,
      method,
      payload,
    };

    const response = await transport.request(method, envelope);

    const versionResult = evaluateMobileProtocolVersion(response.protocolVersion);

    if (versionResult.compatibility === "unsupported") {
      throw new Error(`Unsupported EchoAI mobile protocol version: ${response.protocolVersion}`);
    }

    return response.payload;
  }
}

export function createEchoAIMobileClient(options: EchoAIMobileClientOptions): EchoAIMobileClient {
  return new EchoAIMobileClient(options);
}
