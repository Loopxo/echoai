import type {
  MobileApprovalDecision,
  MobileApprovalRequest,
  MobileDevice,
  MobilePairingChallenge,
} from "../protocol";

export type EchoAINativeAvailability = "available" | "unavailable" | "permission-denied" | "not-implemented";

export interface EchoAIGatewayEndpoint {
  id: string;
  displayName: string;
  host: string;
  port: number;
  tls: boolean;
  lastSeenAt?: string;
}

export interface EchoAISecureTokenRecord {
  accountId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface EchoAICapturedAsset {
  id: string;
  kind: "image" | "audio" | "video" | "screen" | "file";
  uri: string;
  mimeType?: string;
  sizeBytes?: number;
  capturedAt: string;
}

export interface EchoAILocationSnapshot {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
}

export interface EchoAIGatewayNativeModule {
  availability(): Promise<EchoAINativeAvailability>;
  discover(): Promise<EchoAIGatewayEndpoint[]>;
  connect(endpoint: EchoAIGatewayEndpoint, token?: string): Promise<MobileDevice>;
  startPairing(endpoint: EchoAIGatewayEndpoint): Promise<MobilePairingChallenge>;
  rememberTlsIdentity(endpointId: string, fingerprintSha256: string): Promise<void>;
  forgetEndpoint(endpointId: string): Promise<void>;
}

export interface EchoAISecureStorageNativeModule {
  availability(): Promise<EchoAINativeAvailability>;
  saveToken(record: EchoAISecureTokenRecord): Promise<void>;
  readToken(accountId: string, workspaceId: string): Promise<EchoAISecureTokenRecord | null>;
  clearToken(accountId: string, workspaceId: string): Promise<void>;
  clearAll(): Promise<void>;
}

export interface EchoAIPushNativeModule {
  availability(): Promise<EchoAINativeAvailability>;
  registerDevice(workspaceId: string): Promise<MobileDevice>;
  setApprovalHandler(handler: (approval: MobileApprovalRequest) => void): void;
  decideApproval(decision: MobileApprovalDecision): Promise<void>;
}

export interface EchoAICaptureNativeModule {
  cameraAvailability(): Promise<EchoAINativeAvailability>;
  microphoneAvailability(): Promise<EchoAINativeAvailability>;
  locationAvailability(): Promise<EchoAINativeAvailability>;
  screenAvailability(): Promise<EchoAINativeAvailability>;
  captureImage(): Promise<EchoAICapturedAsset>;
  recordAudio(maxDurationSeconds?: number): Promise<EchoAICapturedAsset>;
  captureScreenSnapshot(): Promise<EchoAICapturedAsset>;
  getLocation(precision: "approximate" | "precise"): Promise<EchoAILocationSnapshot>;
}

export interface EchoAINativeModules {
  gateway: EchoAIGatewayNativeModule;
  secureStorage: EchoAISecureStorageNativeModule;
  push: EchoAIPushNativeModule;
  capture: EchoAICaptureNativeModule;
}
