package com.echoai.data

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.UUID

enum class MessageRole { USER, ASSISTANT, SYSTEM }

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

class ChatViewModel : ViewModel() {
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val apiClient = EchoAIClient()
    private var sessionId: String? = null

    fun sendMessage(text: String) {
        val userMessage = ChatMessage(role = MessageRole.USER, content = text)
        _messages.value = _messages.value + userMessage
        _isLoading.value = true

        viewModelScope.launch {
            try {
                val response = apiClient.sendMessage(text, sessionId)
                sessionId = response.sessionId
                val assistantMessage = ChatMessage(
                    role = MessageRole.ASSISTANT,
                    content = response.content
                )
                _messages.value = _messages.value + assistantMessage
            } catch (e: Exception) {
                val errorMessage = ChatMessage(
                    role = MessageRole.ASSISTANT,
                    content = "Error: ${e.message}"
                )
                _messages.value = _messages.value + errorMessage
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearMessages() {
        _messages.value = emptyList()
        sessionId = null
    }
}
