import Foundation
import SwiftUI

// MARK: - Models

enum MessageRole: String, Codable {
    case user
    case assistant
    case system
}

struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date
    
    init(role: MessageRole, content: String) {
        self.id = UUID()
        self.role = role
        self.content = content
        self.timestamp = Date()
    }
}

// MARK: - API Client

class EchoAIClient {
    private let baseURL: URL
    private let session: URLSession
    
    init(baseURL: String = "http://localhost:3000") {
        self.baseURL = URL(string: baseURL)!
        self.session = URLSession.shared
    }
    
    func sendMessage(_ message: String, sessionId: String?) async throws -> (response: String, sessionId: String) {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "message": message,
            "sessionId": sessionId as Any
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await session.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        
        let responseMessage = json["message"] as! [String: Any]
        let content = responseMessage["content"] as! String
        let newSessionId = json["sessionId"] as! String
        
        return (content, newSessionId)
    }
}

// MARK: - ViewModel

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private let client = EchoAIClient()
    private var sessionId: String?
    
    func sendMessage(_ text: String) {
        let userMessage = ChatMessage(role: .user, content: text)
        messages.append(userMessage)
        isLoading = true
        
        Task {
            do {
                let (response, newSessionId) = try await client.sendMessage(text, sessionId: sessionId)
                sessionId = newSessionId
                let assistantMessage = ChatMessage(role: .assistant, content: response)
                messages.append(assistantMessage)
            } catch {
                self.error = error.localizedDescription
                let errorMessage = ChatMessage(role: .assistant, content: "Error: \(error.localizedDescription)")
                messages.append(errorMessage)
            }
            isLoading = false
        }
    }
    
    func clearMessages() {
        messages.removeAll()
        sessionId = nil
    }
}
