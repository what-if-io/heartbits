package io.whatif.heartbits.ui.feel

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.whatif.heartbits.ui.HeartBitsViewModel
import io.whatif.heartbits.ui.send.Flatline
import io.whatif.heartbits.ui.send.HeartbeatWaveform
import io.whatif.heartbits.ui.theme.HB
import java.util.concurrent.TimeUnit

@Composable
fun FeelScreen(vm: HeartBitsViewModel) {
    val partnerBPM by vm.partnerBPM.collectAsState()
    val lastReceived by vm.lastReceived.collectAsState()

    // Signal is "live" if a beat arrived within the last 10 seconds
    val hasSignal = lastReceived?.let {
        System.currentTimeMillis() - it < TimeUnit.SECONDS.toMillis(10)
    } ?: false

    // Bloom flash on each beat
    var bloomAlpha by remember { mutableFloatStateOf(0f) }
    val bloomAnimated by animateFloatAsState(
        targetValue = bloomAlpha,
        animationSpec = tween(550),
        label = "bloom"
    )
    LaunchedEffect(lastReceived) {
        if (lastReceived != null) {
            bloomAlpha = 0.05f
            kotlinx.coroutines.delay(50)
            bloomAlpha = 0f
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(HB.Background),
        contentAlignment = Alignment.Center
    ) {
        // Purple ambient when live
        if (hasSignal) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(HB.Purple.copy(alpha = 0.13f), Color.Transparent),
                        radius = size.minDimension * 1.2f
                    )
                )
            }
        }

        // Beat bloom overlay
        Box(modifier = Modifier.fillMaxSize().background(HB.Purple.copy(alpha = bloomAnimated)))

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(72.dp))

            // Partner header
            PartnerHeader(name = vm.partnerName)

            Spacer(Modifier.weight(1f))

            // ECG or flatline
            AnimatedContent(
                targetState = hasSignal,
                transitionSpec = { fadeIn(tween(700)) togetherWith fadeOut(tween(700)) },
                label = "waveform"
            ) { live ->
                if (live) {
                    HeartbeatWaveform(
                        bpm = partnerBPM.coerceAtLeast(40.0),
                        modifier = Modifier.height(68.dp).fillMaxWidth().padding(horizontal = 20.dp)
                    )
                } else {
                    Flatline(modifier = Modifier.height(68.dp).fillMaxWidth().padding(horizontal = 20.dp))
                }
            }

            Spacer(Modifier.height(36.dp))

            // BPM display
            Text(
                text = if (hasSignal) "${partnerBPM.toInt()}" else "––",
                fontSize = 96.sp,
                fontWeight = FontWeight.ExtraLight,
                fontFamily = FontFamily.Default,
                color = if (hasSignal) Color.White else Color.White.copy(alpha = 0.18f)
            )
            Text("bpm", fontSize = 15.sp, fontWeight = FontWeight.Light, color = Color.White.copy(alpha = 0.3f), modifier = Modifier.padding(top = 4.dp))

            Spacer(Modifier.weight(1f))

            // Last received ago
            lastReceived?.let { ts ->
                val ago = relativeTime(ts)
                Text(ago, fontSize = 12.sp, color = Color.White.copy(alpha = 0.2f), modifier = Modifier.padding(bottom = 44.dp))
            }
        }
    }
}

@Composable
private fun PartnerHeader(name: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = if (name.isNotEmpty()) name else "waiting…",
            fontSize = 36.sp,
            fontWeight = FontWeight.ExtraLight,
            color = if (name.isNotEmpty()) Color.White else Color.White.copy(alpha = 0.25f)
        )
        Text("their heart", fontSize = 13.sp, color = Color.White.copy(alpha = 0.4f), modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun relativeTime(epochMs: Long): String {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(1000)
            now = System.currentTimeMillis()
        }
    }
    val diff = now - epochMs
    return when {
        diff < 5_000   -> "just now"
        diff < 60_000  -> "${diff / 1000}s ago"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        else            -> "${diff / 3600_000}h ago"
    }
}
