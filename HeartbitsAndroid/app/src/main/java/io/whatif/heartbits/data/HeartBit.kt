package io.whatif.heartbits.data

import kotlinx.serialization.Serializable
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

@Serializable
data class HeartBit(
    val id: String,
    val senderAddress: String,
    val recipientAddress: String,
    val bpm: Double,
    val rrIntervalMs: Double,
    val timestamp: String
) {
    val beatIntervalSeconds: Double get() = rrIntervalMs / 1000.0

    val zone: String get() = when {
        bpm < 50  -> "resting deeply"
        bpm < 60  -> "resting"
        bpm < 80  -> "calm"
        bpm < 100 -> "active"
        else      -> "elevated"
    }

    companion object {
        private val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        fun fromBPM(bpm: Double, sender: String, recipient: String) = HeartBit(
            id = UUID.randomUUID().toString(),
            senderAddress = sender,
            recipientAddress = recipient,
            bpm = bpm,
            rrIntervalMs = (60.0 / bpm) * 1000.0,
            timestamp = sdf.format(Date())
        )
    }
}
