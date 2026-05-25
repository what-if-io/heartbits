package io.whatif.heartbits.ui.send

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.whatif.heartbits.health.HeartRateReader
import io.whatif.heartbits.ui.HeartBitsViewModel
import io.whatif.heartbits.ui.theme.HB
import io.whatif.heartbits.ui.theme.brandGradientDiag
import io.whatif.heartbits.ui.theme.zoneColor
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SendScreen(vm: HeartBitsViewModel) {
    val myBPM by vm.myBPM.collectAsState()
    val isBeating by vm.isBeating.collectAsState()
    val isSending by vm.isSending.collectAsState()
    val connectionState by vm.connectionState.collectAsState()

    val heartRateReader = remember { HeartRateReader { bpm -> vm.onReceiveHeartRate(bpm) } }
    LaunchedEffect(Unit) {
        heartRateReader.start()
        vm.startSending()
    }
    DisposableEffect(Unit) { onDispose { heartRateReader.stop() } }

    // Sonar ping animations
    val ping1Scale = remember { Animatable(1f) }
    val ping1Alpha = remember { Animatable(0f) }
    val ping2Scale = remember { Animatable(1f) }
    val ping2Alpha = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(isBeating) {
        if (!isBeating) return@LaunchedEffect
        scope.launch {
            ping1Scale.snapTo(1f); ping1Alpha.snapTo(0.7f)
            launch { ping1Scale.animateTo(1.48f, tween(750, easing = EaseOut)) }
            ping1Alpha.animateTo(0f, tween(750, easing = EaseOut))
        }
        delay(80)
        scope.launch {
            ping2Scale.snapTo(1f); ping2Alpha.snapTo(0.45f)
            launch { ping2Scale.animateTo(1.72f, tween(1100, easing = EaseOut)) }
            ping2Alpha.animateTo(0f, tween(1100, easing = EaseOut))
        }
    }

    val ringScale by animateFloatAsState(
        targetValue = if (isBeating) 1.038f else 1.0f,
        animationSpec = spring(dampingRatio = 0.40f, stiffness = Spring.StiffnessHigh),
        label = "ringScale"
    )
    val zone = zoneColor(myBPM)

    Box(
        modifier = Modifier.fillMaxSize().background(HB.Background),
        contentAlignment = Alignment.Center
    ) {
        // Zone glow
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(zone.copy(alpha = 0.15f), Color.Transparent),
                    radius = size.minDimension
                )
            )
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Status line
            Box(modifier = Modifier.padding(top = 64.dp).height(24.dp), contentAlignment = Alignment.Center) {
                StatusLine(connectionState, isSending, vm.partnerName)
            }

            Spacer(Modifier.weight(1f))

            // Hero ring
            val ringDp = 228.dp
            Box(modifier = Modifier.size(ringDp), contentAlignment = Alignment.Center) {
                // Ping 2 (wider, slower)
                Canvas(modifier = Modifier.size(ringDp)) {
                    val r = size.minDimension / 2f
                    drawCircle(
                        color = zone.copy(alpha = ping2Alpha.value * 0.25f),
                        radius = r * ping2Scale.value,
                        style = Stroke(width = 1.dp.toPx())
                    )
                }
                // Ping 1 (tight, fast)
                Canvas(modifier = Modifier.size(ringDp)) {
                    val r = size.minDimension / 2f
                    drawCircle(
                        color = zone.copy(alpha = ping1Alpha.value),
                        radius = r * ping1Scale.value,
                        style = Stroke(width = 1.5.dp.toPx())
                    )
                }
                // Main gradient ring
                Canvas(modifier = Modifier.size(ringDp * ringScale)) {
                    val r = size.minDimension / 2f - 2.dp.toPx()
                    drawCircle(
                        brush = Brush.sweepGradient(listOf(HB.Coral, HB.Purple, HB.Coral)),
                        radius = r,
                        style = Stroke(width = 2.dp.toPx())
                    )
                    // Inner ghost ring
                    drawCircle(
                        color = Color.White.copy(alpha = 0.04f),
                        radius = r - 9.dp.toPx(),
                        style = Stroke(width = 1.dp.toPx())
                    )
                }
                // BPM
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (myBPM > 0) "${myBPM.toInt()}" else "––",
                        fontSize = 76.sp,
                        fontWeight = FontWeight.ExtraLight,
                        fontFamily = FontFamily.Default,
                        color = Color.White
                    )
                    Text("bpm", fontSize = 15.sp, fontWeight = FontWeight.Light, color = Color.White.copy(alpha = 0.3f))
                }
            }

            Spacer(Modifier.weight(1f))

            // ECG trace
            if (myBPM > 0) {
                HeartbeatWaveform(
                    bpm = myBPM.coerceAtLeast(40.0),
                    modifier = Modifier.height(44.dp).fillMaxWidth().padding(horizontal = 28.dp)
                )
            } else {
                Flatline(modifier = Modifier.height(44.dp).fillMaxWidth().padding(horizontal = 28.dp))
            }

            Spacer(Modifier.height(52.dp))
        }
    }
}

@Composable
private fun StatusLine(
    state: HeartBitsViewModel.ConnectionState,
    isSending: Boolean,
    partnerName: String
) {
    when (state) {
        HeartBitsViewModel.ConnectionState.CONNECTING ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                CircularProgressIndicator(modifier = Modifier.size(10.dp), strokeWidth = 1.dp, color = Color.White.copy(alpha = 0.4f))
                Text("connecting…", fontSize = 13.sp, color = Color.White.copy(alpha = 0.4f))
            }
        HeartBitsViewModel.ConnectionState.CONNECTED ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Canvas(Modifier.size(5.dp)) { drawCircle(brush = brandGradientDiag) }
                Text(
                    if (partnerName.isNotEmpty()) "sharing with $partnerName" else "sharing your heartbeat",
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.4f)
                )
            }
        else ->
            Text("swipe left to feel theirs", fontSize = 13.sp, color = Color.White.copy(alpha = 0.4f))
    }
}

// ── ECG Waveform ──────────────────────────────────────────────────────────────

@Composable
fun HeartbeatWaveform(bpm: Double, modifier: Modifier = Modifier) {
    val beatInterval = 60.0 / bpm.coerceAtLeast(20.0)
    val progress = remember { Animatable(0f) }

    LaunchedEffect(bpm) {
        while (true) {
            progress.snapTo(0f)
            progress.animateTo(1f, tween((beatInterval * 780).toInt(), easing = LinearEasing))
            delay((beatInterval * 220).toLong())
        }
    }

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val mid = h / 2f

        val path = Path().apply {
            moveTo(0f, mid)
            // Baseline
            lineTo(w * 0.08f, mid)
            // P wave
            cubicTo(w * 0.10f, mid - h * 0.12f, w * 0.14f, mid - h * 0.12f, w * 0.16f, mid)
            // PR segment
            lineTo(w * 0.28f, mid)
            // Q dip
            lineTo(w * 0.32f, mid + h * 0.08f)
            // R spike
            lineTo(w * 0.38f, mid - h * 0.85f)
            // S wave
            lineTo(w * 0.44f, mid + h * 0.18f)
            // ST return
            lineTo(w * 0.52f, mid)
            // T wave
            cubicTo(w * 0.58f, mid - h * 0.22f, w * 0.70f, mid - h * 0.22f, w * 0.78f, mid)
            // Tail baseline
            lineTo(w, mid)
        }

        // Clip to progress
        val clipPath = Path().apply {
            addRect(androidx.compose.ui.geometry.Rect(0f, -h, w * progress.value, h * 2))
        }

        with(drawContext.canvas) {
            save()
            clipPath(clipPath)
            drawPath(
                path = path,
                brush = Brush.horizontalGradient(listOf(HB.Coral, HB.Purple)),
                style = Stroke(width = 2.2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
            )
            restore()
        }
    }
}

@Composable
fun Flatline(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val mid = size.height / 2f
        val dashLen = 8.dp.toPx()
        val gapLen = 8.dp.toPx()
        drawLine(
            color = Color.White.copy(alpha = 0.10f),
            start = androidx.compose.ui.geometry.Offset(0f, mid),
            end = androidx.compose.ui.geometry.Offset(size.width, mid),
            strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(dashLen, gapLen))
        )
    }
}
