import EchoAIKit
import EchoAIProtocol
import Foundation

// Prefer the EchoAIKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = EchoAIKit.AnyCodable
typealias InstanceIdentity = EchoAIKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: AnyCodable]? { self.value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { self.value as? [AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension EchoAIProtocol.AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: EchoAIProtocol.AnyCodable]? { self.value as? [String: EchoAIProtocol.AnyCodable] }
    var arrayValue: [EchoAIProtocol.AnyCodable]? { self.value as? [EchoAIProtocol.AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: EchoAIProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [EchoAIProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
