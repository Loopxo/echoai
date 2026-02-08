import Foundation

public enum EchoAICameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum EchoAICameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum EchoAICameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum EchoAICameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct EchoAICameraSnapParams: Codable, Sendable, Equatable {
    public var facing: EchoAICameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: EchoAICameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: EchoAICameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: EchoAICameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct EchoAICameraClipParams: Codable, Sendable, Equatable {
    public var facing: EchoAICameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: EchoAICameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: EchoAICameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: EchoAICameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
