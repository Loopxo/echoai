/**
 * EchoAI Mobile Protocol
 *
 * Canonical cross-platform contract for EchoAI cloud, web, desktop gateway,
 * iOS, and Android mobile clients. Generated Swift/Kotlin bindings should
 * preserve these names and wire-format values.
 */

export const MOBILE_PROTOCOL_VERSION = "2026-05-16";

export type MobileProtocolTarget = "cloud" | "web" | "desktop" | "ios" | "android";
export type MobileEntityId = string;
export type MobileIsoTimestamp = string;

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
    AUTH_STATE_GET: "auth.state.get",
    AUTH_LOGOUT: "auth.logout",
    CHAT_SESSION_LIST: "chat.session.list",
    CHAT_SESSION_GET: "chat.session.get",
    CHAT_SEND: "chat.send",
    CHAT_ABORT: "chat.abort",
    PROJECT_LIST: "project.list",
    FILE_UPLOAD_CREATE: "file.upload.create",
    DEVICE_REGISTER: "device.register",
    DEVICE_PAIRING_START: "device.pairing.start",
    DEVICE_REVOKE: "device.revoke",
    APPROVAL_LIST: "approval.list",
    APPROVAL_DECIDE: "approval.decide",
    AUTOMATION_LIST: "automation.list",
} as const;

export type MobileProtocolMethod = (typeof MobileProtocolMethods)[keyof typeof MobileProtocolMethods];

export interface MobileProtocolRequestMap {
    [MobileProtocolMethods.AUTH_STATE_GET]: Record<string, never>;
    [MobileProtocolMethods.AUTH_LOGOUT]: Record<string, never>;
    [MobileProtocolMethods.CHAT_SESSION_LIST]: { workspaceId: MobileEntityId; source?: MobileSessionSource; projectId?: MobileEntityId };
    [MobileProtocolMethods.CHAT_SESSION_GET]: { sessionId: MobileEntityId; source: MobileSessionSource };
    [MobileProtocolMethods.CHAT_SEND]: MobileChatSendRequest;
    [MobileProtocolMethods.CHAT_ABORT]: { sessionId: MobileEntityId; runId: MobileEntityId; source: MobileSessionSource };
    [MobileProtocolMethods.PROJECT_LIST]: { workspaceId: MobileEntityId };
    [MobileProtocolMethods.FILE_UPLOAD_CREATE]: { workspaceId: MobileEntityId; projectId?: MobileEntityId; file: MobileFileSummary };
    [MobileProtocolMethods.DEVICE_REGISTER]: { device: MobileDevice };
    [MobileProtocolMethods.DEVICE_PAIRING_START]: { deviceId: MobileEntityId; desktopDeviceId?: MobileEntityId };
    [MobileProtocolMethods.DEVICE_REVOKE]: { deviceId: MobileEntityId };
    [MobileProtocolMethods.APPROVAL_LIST]: { workspaceId: MobileEntityId; status?: MobileApprovalStatus };
    [MobileProtocolMethods.APPROVAL_DECIDE]: MobileApprovalDecision;
    [MobileProtocolMethods.AUTOMATION_LIST]: { workspaceId: MobileEntityId; projectId?: MobileEntityId };
}

export interface MobileProtocolResponseMap {
    [MobileProtocolMethods.AUTH_STATE_GET]: MobileAuthState;
    [MobileProtocolMethods.AUTH_LOGOUT]: { signedOut: true };
    [MobileProtocolMethods.CHAT_SESSION_LIST]: { sessions: MobileSessionSummary[] };
    [MobileProtocolMethods.CHAT_SESSION_GET]: MobileSessionDetail;
    [MobileProtocolMethods.CHAT_SEND]: MobileChatSendResponse;
    [MobileProtocolMethods.CHAT_ABORT]: { runId: MobileEntityId; status: "cancelled" };
    [MobileProtocolMethods.PROJECT_LIST]: { projects: MobileProjectSummary[] };
    [MobileProtocolMethods.FILE_UPLOAD_CREATE]: { file: MobileFileSummary; uploadUrl?: string };
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
    targets: readonly MobileProtocolTarget[];
    sourcePackage: "@echoai/types";
    domains: {
        auth: MobileProtocolDomainSchema;
        chat: MobileProtocolDomainSchema;
        projects: MobileProtocolDomainSchema;
        files: MobileProtocolDomainSchema;
        devices: MobileProtocolDomainSchema;
        approvals: MobileProtocolDomainSchema;
        automations: MobileProtocolDomainSchema;
    };
}

export const mobileProtocolSchema = {
    version: MOBILE_PROTOCOL_VERSION,
    targets: ["cloud", "web", "desktop", "ios", "android"],
    sourcePackage: "@echoai/types",
    domains: {
        auth: {
            entities: ["MobileAccount", "MobileWorkspace", "MobileAuthState"],
            methods: [MobileProtocolMethods.AUTH_STATE_GET, MobileProtocolMethods.AUTH_LOGOUT],
        },
        chat: {
            entities: ["MobileModelRef", "MobileAttachmentRef", "MobileMessage", "MobileSessionSummary", "MobileSessionDetail"],
            methods: [
                MobileProtocolMethods.CHAT_SESSION_LIST,
                MobileProtocolMethods.CHAT_SESSION_GET,
                MobileProtocolMethods.CHAT_SEND,
                MobileProtocolMethods.CHAT_ABORT,
            ],
            events: ["message.delta", "message.completed", "tool.started", "tool.completed", "approval.requested", "run.status"],
        },
        projects: {
            entities: ["MobileProjectSummary"],
            methods: [MobileProtocolMethods.PROJECT_LIST],
        },
        files: {
            entities: ["MobileFileSummary"],
            methods: [MobileProtocolMethods.FILE_UPLOAD_CREATE],
        },
        devices: {
            entities: ["MobileDevice", "MobilePairingChallenge"],
            methods: [
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
