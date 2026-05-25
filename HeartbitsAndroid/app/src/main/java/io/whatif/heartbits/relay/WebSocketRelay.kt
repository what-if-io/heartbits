package io.whatif.heartbits.relay

import io.whatif.heartbits.data.HeartBit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class WebSocketRelay(
    private val url: String,
    private val token: String? = null
) : HeartBitRelay {

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val json = Json { ignoreUnknownKeys = true }

    private var socket: WebSocket? = null
    private var messageHandler: ((HeartBit) -> Unit)? = null
    private var connectionHandler: ((Boolean) -> Unit)? = null
    private var backoffMs = 1000L

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            backoffMs = 1000L
            connectionHandler?.invoke(true)
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            try {
                messageHandler?.invoke(json.decodeFromString(text))
            } catch (_: Exception) {}
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            connectionHandler?.invoke(false)
            scope.launch {
                delay(backoffMs)
                backoffMs = minOf(backoffMs * 2, 5_000L)
                reconnect()
            }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            connectionHandler?.invoke(false)
        }
    }

    override fun subscribe(onMessage: (HeartBit) -> Unit, onConnectionChange: (Boolean) -> Unit) {
        messageHandler = onMessage
        connectionHandler = onConnectionChange
        connect()
    }

    override fun send(heartBit: HeartBit) {
        socket?.send(json.encodeToString(HeartBit.serializer(), heartBit))
    }

    override fun disconnect() {
        scope.cancel()
        socket?.close(1000, "Going away")
        socket = null
    }

    private fun connect() {
        val request = Request.Builder()
            .url(url)
            .apply { token?.let { addHeader("Authorization", "Bearer $it") } }
            .build()
        socket = client.newWebSocket(request, listener)
    }

    private fun reconnect() {
        socket?.cancel()
        socket = null
        connect()
    }
}
