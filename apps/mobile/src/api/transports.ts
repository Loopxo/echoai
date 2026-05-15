import type {
  MobileProtocolMethod,
  MobileProtocolRequest,
  MobileProtocolResponse,
} from "../protocol";

import type { EchoAIMobileTransport } from "./mobileClient";

export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init: { body: string; headers: Record<string, string>; method: "POST" }) => Promise<FetchLikeResponse>;

export interface HttpsMobileTransportOptions {
  endpointUrl: string;
  fetchImpl: FetchLike;
  getAccessToken: () => Promise<string | null>;
}

export class HttpsMobileTransport implements EchoAIMobileTransport {
  readonly kind = "https" as const;

  constructor(private readonly options: HttpsMobileTransportOptions) {}

  async request<TMethod extends MobileProtocolMethod>(
    method: TMethod,
    envelope: MobileProtocolRequest<TMethod>,
  ): Promise<MobileProtocolResponse<TMethod>> {
    const token = await this.options.getAccessToken();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-echoai-mobile-method": method,
    };

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await this.options.fetchImpl(this.options.endpointUrl, {
      body: JSON.stringify(envelope),
      headers,
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`EchoAI mobile request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as MobileProtocolResponse<TMethod>;
  }
}

export function createHttpsMobileTransport(options: HttpsMobileTransportOptions): HttpsMobileTransport {
  return new HttpsMobileTransport(options);
}
