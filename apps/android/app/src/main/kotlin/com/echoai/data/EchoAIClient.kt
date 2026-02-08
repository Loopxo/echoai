package com.echoai.data

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class ChatResponse(val content: String, val sessionId: String)

class EchoAIClient(
    private val baseUrl: String = "http://10.0.2.2:3000" // Android emulator localhost
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()

    suspend fun sendMessage(message: String, sessionId: String?): ChatResponse = withContext(Dispatchers.IO) {
        val body = mapOf(
            "message" to message,
            "sessionId" to sessionId
        )
        
        val json = gson.toJson(body)
        val request = Request.Builder()
            .url("$baseUrl/api/chat")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: throw Exception("Empty response")
        
        val jsonResponse = gson.fromJson(responseBody, Map::class.java)
        val messageObj = jsonResponse["message"] as Map<*, *>
        
        ChatResponse(
            content = messageObj["content"] as String,
            sessionId = jsonResponse["sessionId"] as String
        )
    }
}
