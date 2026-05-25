package io.whatif.heartbits.health

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.sin
import kotlin.random.Random

// Simulated heart rate reader — produces realistic BPM with natural HRV drift.
// Replace start() with Health Connect integration when targeting real devices.
class HeartRateReader(private val onHeartRate: (Double) -> Unit) {

    private val scope = CoroutineScope(Dispatchers.IO)
    private var job: Job? = null
    private var baseBPM = 65.0 + Random.nextDouble(-8.0, 8.0)

    fun start() {
        if (job?.isActive == true) return
        job = scope.launch {
            var tick = 0
            while (true) {
                baseBPM = (baseBPM + Random.nextDouble(-0.4, 0.4)).coerceIn(50.0, 95.0)
                val hrv = sin(tick * 0.07) * 2.0 + Random.nextDouble(-1.2, 1.2)
                val bpm = (baseBPM + hrv).coerceIn(40.0, 120.0)
                onHeartRate(bpm)
                delay(((60.0 / bpm) * 1000).toLong())
                tick++
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }
}
