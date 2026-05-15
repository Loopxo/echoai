import Foundation

public enum MobileProtocol {
    public static let version = "2026-05-16"
}

public typealias MobileEntityId = String
public typealias MobileIsoTimestamp = String

public enum MobileClientPlatform: String, Codable, Sendable, CaseIterable {
    case ios
    case android
    case web
    case desktop
    case cli
    case cloud
}

public enum MobileSessionSource: String, Codable, Sendable, CaseIterable {
    case cloud
    case desktopGateway = "desktop-gateway"
}

public enum MobilePlanTier: String, Codable, Sendable, CaseIterable {
    case free
    case pro
    case team
    case enterprise
}

public enum MobileModelSource: String, Codable, Sendable, CaseIterable {
    case hosted
    case free
    case byok
    case desktopLocal = "desktop-local"
}

public enum MobileRunStatus: String, Codable, Sendable, CaseIterable {
    case queued
    case running
    case waitingForApproval = "waiting-for-approval"
    case completed
    case failed
    case cancelled
}

public enum MobileApprovalStatus: String, Codable, Sendable, CaseIterable {
    case pending
    case approved
    case denied
    case expired
    case cancelled
}

public enum MobileDeviceTrustState: String, Codable, Sendable, CaseIterable {
    case unpaired
    case pairing
    case trusted
    case revoked
}

public enum MobilePermissionMode: String, Codable, Sendable, CaseIterable {
    case allow
    case ask
    case deny
}

public enum MobileProtocolMethod: String, Codable, Sendable, CaseIterable {
    case authStateGet = "auth.state.get"
    case authLogout = "auth.logout"
    case sessionList = "session.list"
    case sessionGet = "session.get"
    case sessionDelete = "session.delete"
    case chatSend = "chat.send"
    case chatAbort = "chat.abort"
    case projectList = "project.list"
    case fileList = "file.list"
    case fileUploadCreate = "file.upload.create"
    case fileDelete = "file.delete"
    case deviceList = "device.list"
    case deviceRegister = "device.register"
    case devicePairingStart = "device.pairing.start"
    case deviceRevoke = "device.revoke"
    case approvalList = "approval.list"
    case approvalDecide = "approval.decide"
    case automationList = "automation.list"
}

public enum MobileJSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: MobileJSONValue])
    case array([MobileJSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .number(Double(value))
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: MobileJSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([MobileJSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

public struct MobileClientDescriptor: Codable, Sendable, Equatable {
    public var platform: MobileClientPlatform
    public var appVersion: String?
    public var buildNumber: String?
    public var deviceId: MobileEntityId?
    public var workspaceId: MobileEntityId?

    public init(platform: MobileClientPlatform, appVersion: String? = nil, buildNumber: String? = nil, deviceId: MobileEntityId? = nil, workspaceId: MobileEntityId? = nil) {
        self.platform = platform
        self.appVersion = appVersion
        self.buildNumber = buildNumber
        self.deviceId = deviceId
        self.workspaceId = workspaceId
    }
}

public struct MobileProtocolEnvelope<Payload: Codable & Sendable>: Codable, Sendable {
    public var protocolVersion: String
    public var requestId: MobileEntityId
    public var issuedAt: MobileIsoTimestamp
    public var client: MobileClientDescriptor
    public var method: MobileProtocolMethod
    public var payload: Payload

    public init(requestId: MobileEntityId, issuedAt: MobileIsoTimestamp, client: MobileClientDescriptor, method: MobileProtocolMethod, payload: Payload, protocolVersion: String = MobileProtocol.version) {
        self.protocolVersion = protocolVersion
        self.requestId = requestId
        self.issuedAt = issuedAt
        self.client = client
        self.method = method
        self.payload = payload
    }
}

public struct MobileEmptyRequest: Codable, Sendable, Equatable {
    public init() {}
}

public struct MobileAccount: Codable, Sendable, Equatable {
    public var id: MobileEntityId
    public var email: String?
    public var displayName: String?
    public var planTier: MobilePlanTier
    public var defaultWorkspaceId: MobileEntityId
}

public struct MobileWorkspace: Codable, Sendable, Equatable {
    public enum Role: String, Codable, Sendable, CaseIterable {
        case owner
        case admin
        case member
        case guest
    }

    public var id: MobileEntityId
    public var name: String
    public var role: Role
    public var planTier: MobilePlanTier
}

public struct MobileAuthState: Codable, Sendable, Equatable {
    public var account: MobileAccount
    public var workspaces: [MobileWorkspace]
    public var activeWorkspaceId: MobileEntityId
    public var expiresAt: MobileIsoTimestamp
}

public struct MobileLogoutResponse: Codable, Sendable, Equatable {
    public var signedOut: Bool
}

public struct MobileModelRef: Codable, Sendable, Equatable {
    public enum Capability: String, Codable, Sendable, CaseIterable {
        case text
        case tools
        case vision
        case audio
        case reasoning
        case imageGeneration = "image-generation"
    }

    public var id: String
    public var provider: String
    public var displayName: String
    public var source: MobileModelSource
    public var capabilities: [Capability]
}

public struct MobileAttachmentRef: Codable, Sendable, Equatable {
    public enum Kind: String, Codable, Sendable, CaseIterable {
        case image
        case audio
        case video
        case document
        case file
        case url
    }

    public var id: MobileEntityId
    public var kind: Kind
    public var name: String?
    public var mimeType: String?
    public var sizeBytes: Int?
    public var uri: String?
    public var sha256: String?
}

public struct MobileMessagePart: Codable, Sendable, Equatable {
    public enum PartType: String, Codable, Sendable, CaseIterable {
        case text
        case attachment
        case toolCall = "tool-call"
        case toolResult = "tool-result"
        case approvalRequest = "approval-request"
    }

    public var type: PartType
    public var text: String?
    public var attachment: MobileAttachmentRef?
    public var data: [String: MobileJSONValue]?
}

public struct MobileMessage: Codable, Sendable, Equatable {
    public enum Role: String, Codable, Sendable, CaseIterable {
        case system
        case user
        case assistant
        case tool
    }

    public var id: MobileEntityId
    public var role: Role
    public var parts: [MobileMessagePart]
    public var createdAt: MobileIsoTimestamp
    public var model: MobileModelRef?
    public var runId: MobileEntityId?
}

public struct MobileSessionSummary: Codable, Sendable, Equatable {
    public var id: MobileEntityId
    public var title: String
    public var source: MobileSessionSource
    public var projectId: MobileEntityId?
    public var workspaceId: MobileEntityId
    public var model: MobileModelRef?
    public var status: MobileRunStatus
    public var messageCount: Int
    public var updatedAt: MobileIsoTimestamp
}

public struct MobileSessionDetail: Codable, Sendable, Equatable {
    public var summary: MobileSessionSummary
    public var messages: [MobileMessage]
}

public struct MobileSessionListRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
    public var source: MobileSessionSource?
    public var projectId: MobileEntityId?
}

public struct MobileSessionListResponse: Codable, Sendable, Equatable {
    public var sessions: [MobileSessionSummary]
}

public struct MobileSessionGetRequest: Codable, Sendable, Equatable {
    public var sessionId: MobileEntityId
    public var source: MobileSessionSource
}

public struct MobileSessionDeleteRequest: Codable, Sendable, Equatable {
    public var sessionId: MobileEntityId
    public var source: MobileSessionSource
}

public struct MobileSessionDeleteResponse: Codable, Sendable, Equatable {
    public var sessionId: MobileEntityId
    public var deleted: Bool
}

public struct MobileChatSendRequest: Codable, Sendable, Equatable {
    public var sessionId: MobileEntityId?
    public var projectId: MobileEntityId?
    public var source: MobileSessionSource
    public var model: MobileModelRef?
    public var text: String
    public var attachments: [MobileAttachmentRef]?
    public var desktopDeviceId: MobileEntityId?
}

public struct MobileChatSendResponse: Codable, Sendable, Equatable {
    public var sessionId: MobileEntityId
    public var runId: MobileEntityId
    public var status: MobileRunStatus
}

public struct MobileChatAbortRequest: Codable, Sendable, Equatable {
    public var sessionId: MobileEntityId
    public var runId: MobileEntityId
    public var source: MobileSessionSource
}

public struct MobileChatAbortResponse: Codable, Sendable, Equatable {
    public var runId: MobileEntityId
    public var status: MobileRunStatus
}

public struct MobileProjectSummary: Codable, Sendable, Equatable {
    public var id: MobileEntityId
    public var workspaceId: MobileEntityId
    public var name: String
    public var description: String?
    public var updatedAt: MobileIsoTimestamp
    public var sessionCount: Int
    public var fileCount: Int
}

public struct MobileProjectListRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
}

public struct MobileProjectListResponse: Codable, Sendable, Equatable {
    public var projects: [MobileProjectSummary]
}

public struct MobileFileSummary: Codable, Sendable, Equatable {
    public enum Status: String, Codable, Sendable, CaseIterable {
        case uploading
        case ready
        case processing
        case failed
        case deleted
    }

    public var id: MobileEntityId
    public var workspaceId: MobileEntityId
    public var projectId: MobileEntityId?
    public var name: String
    public var mimeType: String?
    public var sizeBytes: Int
    public var uploadedAt: MobileIsoTimestamp
    public var status: Status
}

public struct MobileFileListRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
    public var projectId: MobileEntityId?
}

public struct MobileFileListResponse: Codable, Sendable, Equatable {
    public var files: [MobileFileSummary]
}

public struct MobileFileUploadCreateRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
    public var projectId: MobileEntityId?
    public var file: MobileFileSummary
}

public struct MobileFileUploadCreateResponse: Codable, Sendable, Equatable {
    public var file: MobileFileSummary
    public var uploadUrl: String?
}

public struct MobileFileDeleteRequest: Codable, Sendable, Equatable {
    public var fileId: MobileEntityId
    public var workspaceId: MobileEntityId
}

public struct MobileFileDeleteResponse: Codable, Sendable, Equatable {
    public var fileId: MobileEntityId
    public var deleted: Bool
}

public struct MobileDevice: Codable, Sendable, Equatable {
    public enum Capability: String, Codable, Sendable, CaseIterable {
        case chat
        case approvals
        case push
        case camera
        case audio
        case screen
        case location
        case desktopControl = "desktop-control"
    }

    public var id: MobileEntityId
    public var platform: MobileClientPlatform
    public var displayName: String
    public var trustState: MobileDeviceTrustState
    public var capabilities: [Capability]
    public var lastSeenAt: MobileIsoTimestamp?
}

public struct MobileDeviceListRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
}

public struct MobileDeviceListResponse: Codable, Sendable, Equatable {
    public var devices: [MobileDevice]
}

public struct MobileDeviceRegisterRequest: Codable, Sendable, Equatable {
    public var device: MobileDevice
}

public struct MobileDeviceRegisterResponse: Codable, Sendable, Equatable {
    public var device: MobileDevice
}

public struct MobilePairingStartRequest: Codable, Sendable, Equatable {
    public var deviceId: MobileEntityId
    public var desktopDeviceId: MobileEntityId?
}

public struct MobilePairingChallenge: Codable, Sendable, Equatable {
    public var pairingId: MobileEntityId
    public var displayCode: String
    public var expiresAt: MobileIsoTimestamp
    public var desktopDevice: MobileDevice?
}

public struct MobileDeviceRevokeRequest: Codable, Sendable, Equatable {
    public var deviceId: MobileEntityId
}

public struct MobileDeviceRevokeResponse: Codable, Sendable, Equatable {
    public var deviceId: MobileEntityId
    public var trustState: MobileDeviceTrustState
}

public struct MobileApprovalRequest: Codable, Sendable, Equatable {
    public enum Risk: String, Codable, Sendable, CaseIterable {
        case low
        case medium
        case high
    }

    public var id: MobileEntityId
    public var workspaceId: MobileEntityId
    public var sessionId: MobileEntityId?
    public var runId: MobileEntityId?
    public var sourceDeviceId: MobileEntityId?
    public var toolName: String
    public var title: String
    public var reason: String?
    public var risk: Risk
    public var requestedAt: MobileIsoTimestamp
    public var expiresAt: MobileIsoTimestamp?
    public var status: MobileApprovalStatus
    public var permissionMode: MobilePermissionMode
    public var details: [String: MobileJSONValue]
}

public struct MobileApprovalListRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
    public var status: MobileApprovalStatus?
}

public struct MobileApprovalListResponse: Codable, Sendable, Equatable {
    public var approvals: [MobileApprovalRequest]
}

public struct MobileApprovalDecision: Codable, Sendable, Equatable {
    public enum Decision: String, Codable, Sendable, CaseIterable {
        case approve
        case deny
    }

    public var approvalId: MobileEntityId
    public var decision: Decision
    public var decidedAt: MobileIsoTimestamp
    public var reason: String?
    public var rememberForSession: Bool?
}

public struct MobileApprovalDecisionResponse: Codable, Sendable, Equatable {
    public var approval: MobileApprovalRequest
}

public struct MobileAutomationSummary: Codable, Sendable, Equatable {
    public var id: MobileEntityId
    public var workspaceId: MobileEntityId
    public var name: String
    public var enabled: Bool
    public var schedule: String
    public var nextRunAt: MobileIsoTimestamp?
    public var lastRunStatus: MobileRunStatus?
}

public struct MobileAutomationListRequest: Codable, Sendable, Equatable {
    public var workspaceId: MobileEntityId
    public var projectId: MobileEntityId?
}

public struct MobileAutomationListResponse: Codable, Sendable, Equatable {
    public var automations: [MobileAutomationSummary]
}
