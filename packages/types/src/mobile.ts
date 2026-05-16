/**
 * EchoAI Mobile Protocol
 *
 * Canonical cross-platform contract for EchoAI cloud, web, desktop gateway,
 * iOS, and Android mobile clients. Generated Swift/Kotlin bindings should
 * preserve these names and wire-format values.
 */

export const MOBILE_PROTOCOL_VERSION = "2026-05-16";
export const MOBILE_MIN_SUPPORTED_PROTOCOL_VERSION = "2026-05-16";

export type MobileProtocolTarget = "cloud" | "web" | "desktop" | "ios" | "android";
export type MobileEntityId = string;
export type MobileIsoTimestamp = string;
export type MobileProtocolCompatibility = "compatible" | "upgrade-recommended" | "unsupported";

export type MobileClientPlatform = "ios" | "android" | "web" | "desktop" | "cli" | "cloud";
export type MobileSessionSource = "cloud" | "desktop-gateway";
export type MobilePlanTier = "free" | "pro" | "team" | "enterprise";
export type MobileModelSource = "hosted" | "free" | "byok" | "desktop-local";
export type MobileRunStatus = "queued" | "running" | "waiting-for-approval" | "completed" | "failed" | "cancelled";
export type MobileApprovalStatus = "pending" | "approved" | "denied" | "expired" | "cancelled";
export type MobileDeviceTrustState = "unpaired" | "pairing" | "trusted" | "revoked";
export type MobilePermissionMode = "allow" | "ask" | "deny";
export type MobileFeatureFlagSource = "default" | "remote" | "org-policy" | "workspace-policy" | "local-debug";

export interface MobileClientDescriptor {
    platform: MobileClientPlatform;
    appVersion?: string;
    buildNumber?: string;
    deviceId?: MobileEntityId;
    workspaceId?: MobileEntityId;
}

export interface MobileProtocolVersionPolicy {
    currentVersion: typeof MOBILE_PROTOCOL_VERSION;
    minimumSupportedVersion: typeof MOBILE_MIN_SUPPORTED_PROTOCOL_VERSION;
    compatibleVersions: readonly string[];
}

export interface MobileProtocolVersionResult {
    compatibility: MobileProtocolCompatibility;
    currentVersion: string;
    minimumSupportedVersion: string;
    receivedVersion: string;
}

export const mobileProtocolVersionPolicy = {
    currentVersion: MOBILE_PROTOCOL_VERSION,
    minimumSupportedVersion: MOBILE_MIN_SUPPORTED_PROTOCOL_VERSION,
    compatibleVersions: [MOBILE_PROTOCOL_VERSION],
} as const satisfies MobileProtocolVersionPolicy;

export function evaluateMobileProtocolVersion(
    receivedVersion: string,
    policy: MobileProtocolVersionPolicy = mobileProtocolVersionPolicy
): MobileProtocolVersionResult {
    if (policy.compatibleVersions.includes(receivedVersion)) {
        return {
            compatibility: "compatible",
            currentVersion: policy.currentVersion,
            minimumSupportedVersion: policy.minimumSupportedVersion,
            receivedVersion,
        };
    }

    if (receivedVersion >= policy.minimumSupportedVersion && receivedVersion < policy.currentVersion) {
        return {
            compatibility: "upgrade-recommended",
            currentVersion: policy.currentVersion,
            minimumSupportedVersion: policy.minimumSupportedVersion,
            receivedVersion,
        };
    }

    return {
        compatibility: "unsupported",
        currentVersion: policy.currentVersion,
        minimumSupportedVersion: policy.minimumSupportedVersion,
        receivedVersion,
    };
}

export interface MobileProtocolEnvelope<TPayload> {
    protocolVersion: typeof MOBILE_PROTOCOL_VERSION;
    requestId: MobileEntityId;
    issuedAt: MobileIsoTimestamp;
    client: MobileClientDescriptor;
    payload: TPayload;
}

export interface MobileAccount {
    id: MobileEntityId;
    email?: string;
    displayName?: string;
    planTier: MobilePlanTier;
    defaultWorkspaceId: MobileEntityId;
}

export interface MobileWorkspace {
    id: MobileEntityId;
    name: string;
    role: "owner" | "admin" | "member" | "guest";
    planTier: MobilePlanTier;
}

export interface MobileAuthState {
    account: MobileAccount;
    workspaces: MobileWorkspace[];
    activeWorkspaceId: MobileEntityId;
    expiresAt: MobileIsoTimestamp;
}

export interface MobileAuthStartRequest {
    redirectUri: string;
    workspaceId?: MobileEntityId;
    codeChallenge?: string;
}

export interface MobileAuthStartResponse {
    authUrl: string;
    state: string;
    expiresAt: MobileIsoTimestamp;
}

export interface MobileAuthCompleteRequest {
    redirectUri: string;
    state: string;
    code: string;
    codeVerifier?: string;
}

export interface MobileAuthRefreshRequest {
    refreshToken: string;
    workspaceId?: MobileEntityId;
}

export interface MobileAuthRefreshResponse {
    authState: MobileAuthState;
    accessToken: string;
    refreshToken?: string;
    expiresAt: MobileIsoTimestamp;
}

export type MobileAuthAuditEventType =
    | "sign-in"
    | "sign-up"
    | "token-refresh"
    | "logout"
    | "device-paired"
    | "device-revoked"
    | "workspace-switched";

export interface MobileAuthAuditEvent {
    id: MobileEntityId;
    accountId: MobileEntityId;
    workspaceId?: MobileEntityId;
    deviceId?: MobileEntityId;
    eventType: MobileAuthAuditEventType;
    status: "success" | "failed" | "blocked";
    createdAt: MobileIsoTimestamp;
    ipCountry?: string;
    userAgent?: string;
    summary?: string;
}

export interface MobileModelRef {
    id: string;
    provider: string;
    displayName: string;
    source: MobileModelSource;
    capabilities: Array<"text" | "tools" | "vision" | "audio" | "reasoning" | "image-generation">;
}

export interface MobileAttachmentRef {
    id: MobileEntityId;
    kind: "image" | "audio" | "video" | "document" | "file" | "url";
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    uri?: string;
    sha256?: string;
}

export interface MobileMessagePart {
    type: "text" | "attachment" | "tool-call" | "tool-result" | "approval-request";
    text?: string;
    attachment?: MobileAttachmentRef;
    data?: Record<string, unknown>;
}

export interface MobileMessage {
    id: MobileEntityId;
    role: "system" | "user" | "assistant" | "tool";
    parts: MobileMessagePart[];
    createdAt: MobileIsoTimestamp;
    model?: MobileModelRef;
    runId?: MobileEntityId;
}

export interface MobileSessionSummary {
    id: MobileEntityId;
    title: string;
    source: MobileSessionSource;
    projectId?: MobileEntityId;
    workspaceId: MobileEntityId;
    model?: MobileModelRef;
    status: MobileRunStatus;
    messageCount: number;
    updatedAt: MobileIsoTimestamp;
}

export interface MobileSessionDetail extends MobileSessionSummary {
    messages: MobileMessage[];
}

export interface MobileChatSendRequest {
    sessionId?: MobileEntityId;
    projectId?: MobileEntityId;
    source: MobileSessionSource;
    model?: MobileModelRef;
    text: string;
    attachments?: MobileAttachmentRef[];
    desktopDeviceId?: MobileEntityId;
}

export interface MobileChatSendResponse {
    sessionId: MobileEntityId;
    runId: MobileEntityId;
    status: MobileRunStatus;
}

export type MobileChatEvent =
    | { type: "message.delta"; sessionId: MobileEntityId; runId: MobileEntityId; text: string }
    | { type: "message.completed"; sessionId: MobileEntityId; runId: MobileEntityId; message: MobileMessage }
    | { type: "tool.started"; sessionId: MobileEntityId; runId: MobileEntityId; toolName: string; toolCallId: MobileEntityId }
    | { type: "tool.completed"; sessionId: MobileEntityId; runId: MobileEntityId; toolCallId: MobileEntityId; output?: string }
    | { type: "approval.requested"; sessionId: MobileEntityId; runId: MobileEntityId; approvalId: MobileEntityId }
    | { type: "run.status"; sessionId: MobileEntityId; runId: MobileEntityId; status: MobileRunStatus };

export interface MobileProjectSummary {
    id: MobileEntityId;
    workspaceId: MobileEntityId;
    name: string;
    description?: string;
    updatedAt: MobileIsoTimestamp;
    sessionCount: number;
    fileCount: number;
}

export interface MobileProjectContext {
    project: MobileProjectSummary;
    sessions: MobileSessionSummary[];
    files: MobileFileSummary[];
    automations: MobileAutomationSummary[];
}

export interface MobileFileSummary {
    id: MobileEntityId;
    workspaceId: MobileEntityId;
    projectId?: MobileEntityId;
    name: string;
    mimeType?: string;
    sizeBytes: number;
    uploadedAt: MobileIsoTimestamp;
    status: "uploading" | "ready" | "processing" | "failed" | "deleted";
}

export interface MobileDevice {
    id: MobileEntityId;
    platform: MobileClientPlatform;
    displayName: string;
    trustState: MobileDeviceTrustState;
    capabilities: Array<"chat" | "approvals" | "push" | "camera" | "audio" | "screen" | "location" | "desktop-control">;
    lastSeenAt?: MobileIsoTimestamp;
}

export interface MobilePairingChallenge {
    pairingId: MobileEntityId;
    displayCode: string;
    expiresAt: MobileIsoTimestamp;
    desktopDevice?: MobileDevice;
}

export interface MobileApprovalRequest {
    id: MobileEntityId;
    workspaceId: MobileEntityId;
    sessionId?: MobileEntityId;
    runId?: MobileEntityId;
    sourceDeviceId?: MobileEntityId;
    toolName: string;
    title: string;
    reason?: string;
    risk: "low" | "medium" | "high";
    requestedAt: MobileIsoTimestamp;
    expiresAt?: MobileIsoTimestamp;
    status: MobileApprovalStatus;
    permissionMode: MobilePermissionMode;
    details: Record<string, unknown>;
}

export interface MobileApprovalDecision {
    approvalId: MobileEntityId;
    decision: "approve" | "deny";
    decidedAt: MobileIsoTimestamp;
    reason?: string;
    rememberForSession?: boolean;
}

export interface MobileAutomationSummary {
    id: MobileEntityId;
    workspaceId: MobileEntityId;
    name: string;
    enabled: boolean;
    schedule: string;
    nextRunAt?: MobileIsoTimestamp;
    lastRunStatus?: MobileRunStatus;
}

export const MobileFeatureFlags = {
    CAMERA_CAPTURE: "mobile.capture.camera",
    AUDIO_CAPTURE: "mobile.capture.audio",
    LOCATION_CONTEXT: "mobile.capture.location",
    SCREEN_CAPTURE_ANDROID: "mobile.capture.screen.android",
    SCREEN_FLOW_IOS: "mobile.capture.screen.ios",
    SHARE_SHEET_INTAKE: "mobile.capture.share-sheet",
    SMS_CAPABILITY_ANDROID: "mobile.capability.sms.android",
    VOICE_WAKE_ANDROID: "mobile.voice.wake.android",
    VOICE_WAKE_IOS_FEASIBILITY: "mobile.voice.wake.ios-feasibility",
    DESKTOP_CONTROL: "mobile.desktop.control",
    DESKTOP_REMOTE_TUNNEL: "mobile.desktop.remote-tunnel",
    APPROVAL_PUSH: "mobile.approvals.push",
    OFFLINE_CAPTURE_QUEUE: "mobile.offline.capture-queue",
} as const;

export type MobileFeatureFlag = (typeof MobileFeatureFlags)[keyof typeof MobileFeatureFlags];

export interface MobileFeatureFlagState {
    key: MobileFeatureFlag;
    enabled: boolean;
    source: MobileFeatureFlagSource;
    reason?: string;
    platform?: Extract<MobileClientPlatform, "ios" | "android">;
    expiresAt?: MobileIsoTimestamp;
}

export const mobileFeatureFlagDefaults = {
    [MobileFeatureFlags.CAMERA_CAPTURE]: true,
    [MobileFeatureFlags.AUDIO_CAPTURE]: true,
    [MobileFeatureFlags.LOCATION_CONTEXT]: true,
    [MobileFeatureFlags.SCREEN_CAPTURE_ANDROID]: false,
    [MobileFeatureFlags.SCREEN_FLOW_IOS]: false,
    [MobileFeatureFlags.SHARE_SHEET_INTAKE]: true,
    [MobileFeatureFlags.SMS_CAPABILITY_ANDROID]: false,
    [MobileFeatureFlags.VOICE_WAKE_ANDROID]: false,
    [MobileFeatureFlags.VOICE_WAKE_IOS_FEASIBILITY]: false,
    [MobileFeatureFlags.DESKTOP_CONTROL]: true,
    [MobileFeatureFlags.DESKTOP_REMOTE_TUNNEL]: false,
    [MobileFeatureFlags.APPROVAL_PUSH]: true,
    [MobileFeatureFlags.OFFLINE_CAPTURE_QUEUE]: false,
} as const satisfies Record<MobileFeatureFlag, boolean>;

export const MobileProtocolMethods = {
    AUTH_SIGN_IN_START: "auth.signIn.start",
    AUTH_SIGN_IN_COMPLETE: "auth.signIn.complete",
    AUTH_SIGN_UP_START: "auth.signUp.start",
    AUTH_SIGN_UP_COMPLETE: "auth.signUp.complete",
    AUTH_REFRESH: "auth.refresh",
    AUTH_STATE_GET: "auth.state.get",
    AUTH_LOGOUT: "auth.logout",
    AUTH_AUDIT_LIST: "auth.audit.list",
    SESSION_LIST: "session.list",
    SESSION_GET: "session.get",
    SESSION_RESUME: "session.resume",
    SESSION_DELETE: "session.delete",
    CHAT_SEND: "chat.send",
    CHAT_ABORT: "chat.abort",
    PROJECT_LIST: "project.list",
    PROJECT_GET: "project.get",
    FILE_LIST: "file.list",
    FILE_UPLOAD_CREATE: "file.upload.create",
    FILE_DELETE: "file.delete",
    DEVICE_LIST: "device.list",
    DEVICE_REGISTER: "device.register",
    DEVICE_PAIRING_START: "device.pairing.start",
    DEVICE_REVOKE: "device.revoke",
    APPROVAL_LIST: "approval.list",
    APPROVAL_DECIDE: "approval.decide",
    AUTOMATION_LIST: "automation.list",
} as const;

export type MobileProtocolMethod = (typeof MobileProtocolMethods)[keyof typeof MobileProtocolMethods];

export interface MobileProtocolRequestMap {
    [MobileProtocolMethods.AUTH_SIGN_IN_START]: MobileAuthStartRequest;
    [MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE]: MobileAuthCompleteRequest;
    [MobileProtocolMethods.AUTH_SIGN_UP_START]: MobileAuthStartRequest;
    [MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE]: MobileAuthCompleteRequest;
    [MobileProtocolMethods.AUTH_REFRESH]: MobileAuthRefreshRequest;
    [MobileProtocolMethods.AUTH_STATE_GET]: Record<string, never>;
    [MobileProtocolMethods.AUTH_LOGOUT]: Record<string, never>;
    [MobileProtocolMethods.AUTH_AUDIT_LIST]: { accountId?: MobileEntityId; workspaceId?: MobileEntityId; limit?: number };
    [MobileProtocolMethods.SESSION_LIST]: { workspaceId: MobileEntityId; source?: MobileSessionSource; projectId?: MobileEntityId };
    [MobileProtocolMethods.SESSION_GET]: { sessionId: MobileEntityId; source: MobileSessionSource };
    [MobileProtocolMethods.SESSION_RESUME]: { sessionId: MobileEntityId; source: MobileSessionSource };
    [MobileProtocolMethods.SESSION_DELETE]: { sessionId: MobileEntityId; source: MobileSessionSource };
    [MobileProtocolMethods.CHAT_SEND]: MobileChatSendRequest;
    [MobileProtocolMethods.CHAT_ABORT]: { sessionId: MobileEntityId; runId: MobileEntityId; source: MobileSessionSource };
    [MobileProtocolMethods.PROJECT_LIST]: { workspaceId: MobileEntityId };
    [MobileProtocolMethods.PROJECT_GET]: { projectId: MobileEntityId; workspaceId: MobileEntityId };
    [MobileProtocolMethods.FILE_LIST]: { workspaceId: MobileEntityId; projectId?: MobileEntityId };
    [MobileProtocolMethods.FILE_UPLOAD_CREATE]: { workspaceId: MobileEntityId; projectId?: MobileEntityId; file: MobileFileSummary };
    [MobileProtocolMethods.FILE_DELETE]: { fileId: MobileEntityId; workspaceId: MobileEntityId };
    [MobileProtocolMethods.DEVICE_LIST]: { workspaceId: MobileEntityId };
    [MobileProtocolMethods.DEVICE_REGISTER]: { device: MobileDevice };
    [MobileProtocolMethods.DEVICE_PAIRING_START]: { deviceId: MobileEntityId; desktopDeviceId?: MobileEntityId };
    [MobileProtocolMethods.DEVICE_REVOKE]: { deviceId: MobileEntityId };
    [MobileProtocolMethods.APPROVAL_LIST]: { workspaceId: MobileEntityId; status?: MobileApprovalStatus };
    [MobileProtocolMethods.APPROVAL_DECIDE]: MobileApprovalDecision;
    [MobileProtocolMethods.AUTOMATION_LIST]: { workspaceId: MobileEntityId; projectId?: MobileEntityId };
}

export interface MobileProtocolResponseMap {
    [MobileProtocolMethods.AUTH_SIGN_IN_START]: MobileAuthStartResponse;
    [MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE]: MobileAuthState;
    [MobileProtocolMethods.AUTH_SIGN_UP_START]: MobileAuthStartResponse;
    [MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE]: MobileAuthState;
    [MobileProtocolMethods.AUTH_REFRESH]: MobileAuthRefreshResponse;
    [MobileProtocolMethods.AUTH_STATE_GET]: MobileAuthState;
    [MobileProtocolMethods.AUTH_LOGOUT]: { signedOut: true };
    [MobileProtocolMethods.AUTH_AUDIT_LIST]: { events: MobileAuthAuditEvent[] };
    [MobileProtocolMethods.SESSION_LIST]: { sessions: MobileSessionSummary[] };
    [MobileProtocolMethods.SESSION_GET]: MobileSessionDetail;
    [MobileProtocolMethods.SESSION_RESUME]: { session: MobileSessionDetail; runId?: MobileEntityId; status: MobileRunStatus };
    [MobileProtocolMethods.SESSION_DELETE]: { sessionId: MobileEntityId; deleted: true };
    [MobileProtocolMethods.CHAT_SEND]: MobileChatSendResponse;
    [MobileProtocolMethods.CHAT_ABORT]: { runId: MobileEntityId; status: "cancelled" };
    [MobileProtocolMethods.PROJECT_LIST]: { projects: MobileProjectSummary[] };
    [MobileProtocolMethods.PROJECT_GET]: MobileProjectContext;
    [MobileProtocolMethods.FILE_LIST]: { files: MobileFileSummary[] };
    [MobileProtocolMethods.FILE_UPLOAD_CREATE]: { file: MobileFileSummary; uploadUrl?: string };
    [MobileProtocolMethods.FILE_DELETE]: { fileId: MobileEntityId; deleted: true };
    [MobileProtocolMethods.DEVICE_LIST]: { devices: MobileDevice[] };
    [MobileProtocolMethods.DEVICE_REGISTER]: { device: MobileDevice };
    [MobileProtocolMethods.DEVICE_PAIRING_START]: MobilePairingChallenge;
    [MobileProtocolMethods.DEVICE_REVOKE]: { deviceId: MobileEntityId; trustState: "revoked" };
    [MobileProtocolMethods.APPROVAL_LIST]: { approvals: MobileApprovalRequest[] };
    [MobileProtocolMethods.APPROVAL_DECIDE]: { approval: MobileApprovalRequest };
    [MobileProtocolMethods.AUTOMATION_LIST]: { automations: MobileAutomationSummary[] };
}

export type MobileProtocolRequest<TMethod extends MobileProtocolMethod> =
    MobileProtocolEnvelope<MobileProtocolRequestMap[TMethod]> & { method: TMethod };

export type MobileProtocolResponse<TMethod extends MobileProtocolMethod> =
    MobileProtocolEnvelope<MobileProtocolResponseMap[TMethod]> & { method: TMethod };

export interface MobileProtocolDomainSchema {
    entities: readonly string[];
    methods: readonly MobileProtocolMethod[];
    events?: readonly string[];
}

export interface MobileProtocolSchema {
    version: typeof MOBILE_PROTOCOL_VERSION;
    minimumSupportedVersion: typeof MOBILE_MIN_SUPPORTED_PROTOCOL_VERSION;
    targets: readonly MobileProtocolTarget[];
    sourcePackage: "@echoai/types";
    domains: {
        auth: MobileProtocolDomainSchema;
        sessions: MobileProtocolDomainSchema;
        chat: MobileProtocolDomainSchema;
        projects: MobileProtocolDomainSchema;
        files: MobileProtocolDomainSchema;
        devices: MobileProtocolDomainSchema;
        approvals: MobileProtocolDomainSchema;
        automations: MobileProtocolDomainSchema;
    };
}

export type MobileApiDomain = keyof MobileProtocolSchema["domains"];
export type MobileApiTransport = "https" | "gateway-rpc" | "websocket";
export type MobileApiAuth = "guest" | "cloud-session" | "trusted-device";

export interface MobileApiMethodDescriptor<TMethod extends MobileProtocolMethod = MobileProtocolMethod> {
    method: TMethod;
    domain: MobileApiDomain;
    transports: readonly MobileApiTransport[];
    auth: MobileApiAuth;
    requestType: keyof MobileProtocolRequestMap;
    responseType: keyof MobileProtocolResponseMap;
}

export interface MobileApiContract {
    version: typeof MOBILE_PROTOCOL_VERSION;
    methods: { readonly [TMethod in MobileProtocolMethod]: MobileApiMethodDescriptor<TMethod> };
}

export const mobileApiContract = {
    version: MOBILE_PROTOCOL_VERSION,
    methods: {
        [MobileProtocolMethods.AUTH_STATE_GET]: {
            method: MobileProtocolMethods.AUTH_STATE_GET,
            domain: "auth",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.AUTH_STATE_GET,
            responseType: MobileProtocolMethods.AUTH_STATE_GET,
        },
        [MobileProtocolMethods.AUTH_SIGN_IN_START]: {
            method: MobileProtocolMethods.AUTH_SIGN_IN_START,
            domain: "auth",
            transports: ["https"],
            auth: "guest",
            requestType: MobileProtocolMethods.AUTH_SIGN_IN_START,
            responseType: MobileProtocolMethods.AUTH_SIGN_IN_START,
        },
        [MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE]: {
            method: MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE,
            domain: "auth",
            transports: ["https"],
            auth: "guest",
            requestType: MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE,
            responseType: MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE,
        },
        [MobileProtocolMethods.AUTH_SIGN_UP_START]: {
            method: MobileProtocolMethods.AUTH_SIGN_UP_START,
            domain: "auth",
            transports: ["https"],
            auth: "guest",
            requestType: MobileProtocolMethods.AUTH_SIGN_UP_START,
            responseType: MobileProtocolMethods.AUTH_SIGN_UP_START,
        },
        [MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE]: {
            method: MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE,
            domain: "auth",
            transports: ["https"],
            auth: "guest",
            requestType: MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE,
            responseType: MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE,
        },
        [MobileProtocolMethods.AUTH_REFRESH]: {
            method: MobileProtocolMethods.AUTH_REFRESH,
            domain: "auth",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.AUTH_REFRESH,
            responseType: MobileProtocolMethods.AUTH_REFRESH,
        },
        [MobileProtocolMethods.AUTH_LOGOUT]: {
            method: MobileProtocolMethods.AUTH_LOGOUT,
            domain: "auth",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.AUTH_LOGOUT,
            responseType: MobileProtocolMethods.AUTH_LOGOUT,
        },
        [MobileProtocolMethods.AUTH_AUDIT_LIST]: {
            method: MobileProtocolMethods.AUTH_AUDIT_LIST,
            domain: "auth",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.AUTH_AUDIT_LIST,
            responseType: MobileProtocolMethods.AUTH_AUDIT_LIST,
        },
        [MobileProtocolMethods.SESSION_LIST]: {
            method: MobileProtocolMethods.SESSION_LIST,
            domain: "sessions",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.SESSION_LIST,
            responseType: MobileProtocolMethods.SESSION_LIST,
        },
        [MobileProtocolMethods.SESSION_GET]: {
            method: MobileProtocolMethods.SESSION_GET,
            domain: "sessions",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.SESSION_GET,
            responseType: MobileProtocolMethods.SESSION_GET,
        },
        [MobileProtocolMethods.SESSION_RESUME]: {
            method: MobileProtocolMethods.SESSION_RESUME,
            domain: "sessions",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.SESSION_RESUME,
            responseType: MobileProtocolMethods.SESSION_RESUME,
        },
        [MobileProtocolMethods.SESSION_DELETE]: {
            method: MobileProtocolMethods.SESSION_DELETE,
            domain: "sessions",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.SESSION_DELETE,
            responseType: MobileProtocolMethods.SESSION_DELETE,
        },
        [MobileProtocolMethods.CHAT_SEND]: {
            method: MobileProtocolMethods.CHAT_SEND,
            domain: "chat",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.CHAT_SEND,
            responseType: MobileProtocolMethods.CHAT_SEND,
        },
        [MobileProtocolMethods.CHAT_ABORT]: {
            method: MobileProtocolMethods.CHAT_ABORT,
            domain: "chat",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.CHAT_ABORT,
            responseType: MobileProtocolMethods.CHAT_ABORT,
        },
        [MobileProtocolMethods.PROJECT_LIST]: {
            method: MobileProtocolMethods.PROJECT_LIST,
            domain: "projects",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.PROJECT_LIST,
            responseType: MobileProtocolMethods.PROJECT_LIST,
        },
        [MobileProtocolMethods.PROJECT_GET]: {
            method: MobileProtocolMethods.PROJECT_GET,
            domain: "projects",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.PROJECT_GET,
            responseType: MobileProtocolMethods.PROJECT_GET,
        },
        [MobileProtocolMethods.FILE_LIST]: {
            method: MobileProtocolMethods.FILE_LIST,
            domain: "files",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.FILE_LIST,
            responseType: MobileProtocolMethods.FILE_LIST,
        },
        [MobileProtocolMethods.FILE_UPLOAD_CREATE]: {
            method: MobileProtocolMethods.FILE_UPLOAD_CREATE,
            domain: "files",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.FILE_UPLOAD_CREATE,
            responseType: MobileProtocolMethods.FILE_UPLOAD_CREATE,
        },
        [MobileProtocolMethods.FILE_DELETE]: {
            method: MobileProtocolMethods.FILE_DELETE,
            domain: "files",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.FILE_DELETE,
            responseType: MobileProtocolMethods.FILE_DELETE,
        },
        [MobileProtocolMethods.DEVICE_LIST]: {
            method: MobileProtocolMethods.DEVICE_LIST,
            domain: "devices",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.DEVICE_LIST,
            responseType: MobileProtocolMethods.DEVICE_LIST,
        },
        [MobileProtocolMethods.DEVICE_REGISTER]: {
            method: MobileProtocolMethods.DEVICE_REGISTER,
            domain: "devices",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.DEVICE_REGISTER,
            responseType: MobileProtocolMethods.DEVICE_REGISTER,
        },
        [MobileProtocolMethods.DEVICE_PAIRING_START]: {
            method: MobileProtocolMethods.DEVICE_PAIRING_START,
            domain: "devices",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.DEVICE_PAIRING_START,
            responseType: MobileProtocolMethods.DEVICE_PAIRING_START,
        },
        [MobileProtocolMethods.DEVICE_REVOKE]: {
            method: MobileProtocolMethods.DEVICE_REVOKE,
            domain: "devices",
            transports: ["https", "gateway-rpc"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.DEVICE_REVOKE,
            responseType: MobileProtocolMethods.DEVICE_REVOKE,
        },
        [MobileProtocolMethods.APPROVAL_LIST]: {
            method: MobileProtocolMethods.APPROVAL_LIST,
            domain: "approvals",
            transports: ["https", "gateway-rpc"],
            auth: "trusted-device",
            requestType: MobileProtocolMethods.APPROVAL_LIST,
            responseType: MobileProtocolMethods.APPROVAL_LIST,
        },
        [MobileProtocolMethods.APPROVAL_DECIDE]: {
            method: MobileProtocolMethods.APPROVAL_DECIDE,
            domain: "approvals",
            transports: ["https", "gateway-rpc"],
            auth: "trusted-device",
            requestType: MobileProtocolMethods.APPROVAL_DECIDE,
            responseType: MobileProtocolMethods.APPROVAL_DECIDE,
        },
        [MobileProtocolMethods.AUTOMATION_LIST]: {
            method: MobileProtocolMethods.AUTOMATION_LIST,
            domain: "automations",
            transports: ["https"],
            auth: "cloud-session",
            requestType: MobileProtocolMethods.AUTOMATION_LIST,
            responseType: MobileProtocolMethods.AUTOMATION_LIST,
        },
    },
} as const satisfies MobileApiContract;

export const mobileProtocolSchema = {
    version: MOBILE_PROTOCOL_VERSION,
    minimumSupportedVersion: MOBILE_MIN_SUPPORTED_PROTOCOL_VERSION,
    targets: ["cloud", "web", "desktop", "ios", "android"],
    sourcePackage: "@echoai/types",
    domains: {
        auth: {
            entities: ["MobileAccount", "MobileWorkspace", "MobileAuthState", "MobileAuthStartRequest", "MobileAuthStartResponse", "MobileAuthRefreshRequest", "MobileAuthRefreshResponse", "MobileAuthAuditEvent"],
            methods: [
                MobileProtocolMethods.AUTH_SIGN_IN_START,
                MobileProtocolMethods.AUTH_SIGN_IN_COMPLETE,
                MobileProtocolMethods.AUTH_SIGN_UP_START,
                MobileProtocolMethods.AUTH_SIGN_UP_COMPLETE,
                MobileProtocolMethods.AUTH_REFRESH,
                MobileProtocolMethods.AUTH_STATE_GET,
                MobileProtocolMethods.AUTH_LOGOUT,
                MobileProtocolMethods.AUTH_AUDIT_LIST,
            ],
        },
        sessions: {
            entities: ["MobileSessionSummary", "MobileSessionDetail"],
            methods: [
                MobileProtocolMethods.SESSION_LIST,
                MobileProtocolMethods.SESSION_GET,
                MobileProtocolMethods.SESSION_RESUME,
                MobileProtocolMethods.SESSION_DELETE,
            ],
        },
        chat: {
            entities: ["MobileModelRef", "MobileAttachmentRef", "MobileMessage", "MobileChatSendRequest", "MobileChatSendResponse"],
            methods: [
                MobileProtocolMethods.CHAT_SEND,
                MobileProtocolMethods.CHAT_ABORT,
            ],
            events: ["message.delta", "message.completed", "tool.started", "tool.completed", "approval.requested", "run.status"],
        },
        projects: {
            entities: ["MobileProjectSummary", "MobileProjectContext"],
            methods: [MobileProtocolMethods.PROJECT_LIST, MobileProtocolMethods.PROJECT_GET],
        },
        files: {
            entities: ["MobileFileSummary"],
            methods: [
                MobileProtocolMethods.FILE_LIST,
                MobileProtocolMethods.FILE_UPLOAD_CREATE,
                MobileProtocolMethods.FILE_DELETE,
            ],
        },
        devices: {
            entities: ["MobileDevice", "MobilePairingChallenge"],
            methods: [
                MobileProtocolMethods.DEVICE_LIST,
                MobileProtocolMethods.DEVICE_REGISTER,
                MobileProtocolMethods.DEVICE_PAIRING_START,
                MobileProtocolMethods.DEVICE_REVOKE,
            ],
        },
        approvals: {
            entities: ["MobileApprovalRequest", "MobileApprovalDecision"],
            methods: [MobileProtocolMethods.APPROVAL_LIST, MobileProtocolMethods.APPROVAL_DECIDE],
            events: ["approval.requested"],
        },
        automations: {
            entities: ["MobileAutomationSummary"],
            methods: [MobileProtocolMethods.AUTOMATION_LIST],
        },
    },
} as const satisfies MobileProtocolSchema;
