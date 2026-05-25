package io.whatif.heartbits.ui.theme

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

object HB {
    val Background = Color(0xFF070710)
    val Coral      = Color(0xFFFF6B6B)
    val Purple     = Color(0xFF7B35DE)
    val Magenta    = Color(0xFFE81F8C)
}

val brandGradient: Brush
    get() = Brush.horizontalGradient(listOf(HB.Coral, HB.Purple))

val brandGradientDiag: Brush
    get() = Brush.linearGradient(
        colors = listOf(HB.Coral, HB.Purple),
        start = Offset(0f, 0f),
        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
    )

fun zoneColor(bpm: Double): Color = when {
    bpm <= 0   -> Color.Gray
    bpm < 60   -> Color(0xFF5B8FE8)
    bpm < 80   -> HB.Coral
    bpm < 100  -> Color(0xFFFF8C42)
    else       -> HB.Magenta
}
