package io.whatif.heartbits.haptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

class HapticEngine(context: Context) {

    private val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

    fun playBeat(rrIntervalMs: Double) {
        if (!vibrator.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Thump + soft aftershock — mimics the two-phase heartbeat feel
            val effect = VibrationEffect.createWaveform(
                longArrayOf(0, 60, 40, 30),
                intArrayOf(0, 200, 0, 80),
                -1
            )
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(longArrayOf(0, 60, 40, 30), -1)
        }
    }
}
