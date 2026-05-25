package io.whatif.heartbits.ui.pairing

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import io.whatif.heartbits.data.BondStore
import io.whatif.heartbits.ui.theme.HB
import io.whatif.heartbits.ui.theme.brandGradientDiag
import kotlinx.coroutines.delay

private enum class Phase { IDLE, HOSTING, JOINING }

@Composable
fun PairingScreen(bondStore: BondStore) {
    var phase by remember { mutableStateOf(Phase.IDLE) }
    var pendingCode by remember { mutableStateOf("") }
    var rawInput by remember { mutableStateOf("") }
    var partnerName by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(HB.Background)
    ) {
        // Radial background glow shifts with phase
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            (if (phase == Phase.HOSTING) HB.Coral else HB.Purple).copy(alpha = 0.18f),
                            Color.Transparent
                        ),
                        radius = 600f
                    )
                )
        )

        AnimatedContent(
            targetState = phase,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "phase"
        ) { p ->
            when (p) {
                Phase.IDLE    -> IdleView(
                    onCreate = { pendingCode = BondStore.generateId(); phase = Phase.HOSTING },
                    onJoin   = { phase = Phase.JOINING }
                )
                Phase.HOSTING -> HostingView(
                    code    = pendingCode,
                    onBack  = { phase = Phase.IDLE },
                    onConfirm = { bondStore.confirm(pendingCode) }
                )
                Phase.JOINING -> JoiningView(
                    rawInput    = rawInput,
                    partnerName = partnerName,
                    onInputChange       = { rawInput = it },
                    onPartnerNameChange = { partnerName = it },
                    onBack    = { phase = Phase.IDLE },
                    onConnect = { bondStore.join(rawInput, partnerName) }
                )
            }
        }
    }
}

// ── Idle ──────────────────────────────────────────────────────────────────────

@Composable
private fun IdleView(onCreate: () -> Unit, onJoin: () -> Unit) {
    var pulse by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        while (true) {
            pulse = !pulse
            delay(1350)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.weight(1f))

        Text(
            text = "♥",
            fontSize = if (pulse) 84.sp else 72.sp,
            color = HB.Coral,
            modifier = Modifier
        )

        Spacer(Modifier.height(34.dp))

        Text("HeartBits", fontSize = 30.sp, fontWeight = FontWeight.Thin, color = Color.White)

        Text(
            "Share your heartbeat with someone you love",
            fontSize = 14.sp,
            color = Color.White.copy(alpha = 0.5f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 10.dp)
        )

        Spacer(Modifier.weight(1f))

        PrimaryButton("Create a Bond", onClick = onCreate)
        Spacer(Modifier.height(14.dp))
        OutlineButton("Join with a code", onClick = onJoin)
        Spacer(Modifier.height(56.dp))
    }
}

// ── Hosting ───────────────────────────────────────────────────────────────────

@Composable
private fun HostingView(code: String, onBack: () -> Unit, onConfirm: () -> Unit) {
    val context = LocalContext.current
    var waitingDot by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { while (true) { delay(520); waitingDot = (waitingDot + 1) % 3 } }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        BackButton(onClick = onBack, modifier = Modifier.padding(start = 24.dp, top = 56.dp).fillMaxWidth())

        Spacer(Modifier.height(28.dp))
        Text("Your bond code", fontSize = 24.sp, fontWeight = FontWeight.Thin, color = Color.White)
        Text("Share this with your partner", fontSize = 13.sp, color = Color.White.copy(alpha = 0.5f), modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(32.dp))

        // Gradient QR code
        GradientQRCode(
            content = "heartbits://bond/$code",
            modifier = Modifier
                .size(196.dp)
                .clip(RoundedCornerShape(18.dp))
                .border(1.5.dp, Brush.linearGradient(listOf(HB.Coral, HB.Purple)), RoundedCornerShape(18.dp))
                .shadow(elevation = 28.dp, spotColor = HB.Purple)
        )

        Spacer(Modifier.height(28.dp))

        // Tappable code display
        Text(
            text = BondStore.display(code),
            fontSize = 38.sp,
            fontWeight = FontWeight.ExtraLight,
            color = HB.Coral,
            modifier = Modifier.clickable {
                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("HeartBits code", code))
            }
        )
        Text("tap to copy", fontSize = 11.sp, color = Color.White.copy(alpha = 0.3f), modifier = Modifier.padding(top = 3.dp))

        Spacer(Modifier.height(32.dp))

        // Share
        OutlineButton(
            label = "Share Code",
            onClick = {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    putExtra(Intent.EXTRA_TEXT, "Join me on HeartBits!\n\nCode: ${BondStore.display(code)}")
                    type = "text/plain"
                }
                context.startActivity(Intent.createChooser(intent, null))
            },
            modifier = Modifier.padding(horizontal = 28.dp).fillMaxWidth()
        )

        Spacer(Modifier.height(18.dp))

        // Waiting indicator
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
            repeat(3) { i ->
                Box(
                    modifier = Modifier
                        .size(5.dp)
                        .background(
                            color = if (i == waitingDot) HB.Coral else Color.White.copy(alpha = 0.2f),
                            shape = androidx.compose.foundation.shape.CircleShape
                        )
                )
            }
            Spacer(Modifier.width(7.dp))
            Text("Waiting for partner", fontSize = 12.sp, color = Color.White.copy(alpha = 0.3f))
        }

        Spacer(Modifier.height(28.dp))

        PrimaryButton("We're connected →", onClick = onConfirm, modifier = Modifier.padding(horizontal = 28.dp).fillMaxWidth())
        Spacer(Modifier.height(52.dp))
    }
}

// ── Joining ───────────────────────────────────────────────────────────────────

@Composable
private fun JoiningView(
    rawInput: String,
    partnerName: String,
    onInputChange: (String) -> Unit,
    onPartnerNameChange: (String) -> Unit,
    onBack: () -> Unit,
    onConnect: () -> Unit
) {
    val ready = rawInput.length == 8

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        BackButton(onClick = onBack, modifier = Modifier.padding(start = 0.dp, top = 56.dp).fillMaxWidth())
        Spacer(Modifier.weight(1f))

        Text("♥", fontSize = 52.sp, color = HB.Coral)
        Spacer(Modifier.height(22.dp))
        Text("Join a bond", fontSize = 24.sp, fontWeight = FontWeight.Thin, color = Color.White)
        Text("Enter the code your partner shared", fontSize = 13.sp, color = Color.White.copy(alpha = 0.5f), modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(36.dp))

        // Code input — displayed as XXXX·XXXX
        val displayValue = rawInput.let {
            if (it.length > 4) "${it.take(4)}·${it.drop(4)}" else it
        }
        OutlinedTextField(
            value = displayValue,
            onValueChange = { new ->
                val clean = new.uppercase().filter { it.isLetterOrDigit() }.take(8)
                onInputChange(clean)
            },
            placeholder = { Text("ABCD·EFGH", color = Color.White.copy(alpha = 0.25f), textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                keyboardType = KeyboardType.Ascii
            ),
            textStyle = androidx.compose.ui.text.TextStyle(
                fontSize = 34.sp,
                fontWeight = FontWeight.ExtraLight,
                color = Color.White,
                textAlign = TextAlign.Center,
                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
            ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = if (ready) HB.Coral else Color.White.copy(alpha = 0.15f),
                unfocusedBorderColor = Color.White.copy(alpha = 0.1f),
                cursorColor = HB.Coral
            ),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(64.dp)
        )

        Spacer(Modifier.height(14.dp))

        OutlinedTextField(
            value = partnerName,
            onValueChange = onPartnerNameChange,
            placeholder = { Text("Partner's name (optional)", color = Color.White.copy(alpha = 0.25f)) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.White.copy(alpha = 0.15f),
                unfocusedBorderColor = Color.White.copy(alpha = 0.08f),
                cursorColor = HB.Coral
            ),
            textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 15.sp),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(50.dp)
        )

        Spacer(Modifier.weight(1f))

        Button(
            onClick = onConnect,
            enabled = ready,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                disabledContainerColor = Color.Transparent
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .background(
                    brush = if (ready) brandGradientDiag else Brush.horizontalGradient(listOf(Color.White.copy(alpha = 0.12f), Color.White.copy(alpha = 0.12f))),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        ) {
            Text("Connect", fontSize = 17.sp, fontWeight = FontWeight.Medium, color = Color.White)
        }

        Spacer(Modifier.height(52.dp))
    }
}

// ── Shared components ─────────────────────────────────────────────────────────

@Composable
private fun PrimaryButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier.padding(horizontal = 28.dp).fillMaxWidth()) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        modifier = modifier
            .height(54.dp)
            .background(brandGradientDiag, androidx.compose.foundation.shape.CircleShape)
    ) {
        Text(label, fontSize = 17.sp, fontWeight = FontWeight.Medium, color = Color.White)
    }
}

@Composable
private fun OutlineButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier.padding(horizontal = 28.dp).fillMaxWidth()) {
    OutlinedButton(
        onClick = onClick,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f)),
        modifier = modifier.height(54.dp)
    ) {
        Text(label, fontSize = 17.sp, color = Color.White.copy(alpha = 0.75f))
    }
}

@Composable
private fun BackButton(onClick: () -> Unit, modifier: Modifier = Modifier) {
    TextButton(onClick = onClick, modifier = modifier) {
        Text("← Back", fontSize = 16.sp, color = Color.White.copy(alpha = 0.5f))
    }
}

@Composable
private fun GradientQRCode(content: String, modifier: Modifier = Modifier) {
    val bitmap = remember(content) {
        try {
            val size = 512
            val hints = mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M)
            val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    if (matrix[x, y]) {
                        val t = (x.toFloat() / size + y.toFloat() / size) / 2f
                        val color = lerp(HB.Coral, HB.Purple, t)
                        bmp.setPixel(x, y, color.toArgb())
                    } else {
                        bmp.setPixel(x, y, HB.Background.toArgb())
                    }
                }
            }
            bmp
        } catch (_: Exception) { null }
    }

    bitmap?.let {
        Image(bitmap = it.asImageBitmap(), contentDescription = "Bond QR code", modifier = modifier)
    }
}

private fun lerp(a: Color, b: Color, t: Float): Color = Color(
    red   = a.red   + (b.red   - a.red)   * t,
    green = a.green + (b.green - a.green) * t,
    blue  = a.blue  + (b.blue  - a.blue)  * t,
    alpha = 1f
)
