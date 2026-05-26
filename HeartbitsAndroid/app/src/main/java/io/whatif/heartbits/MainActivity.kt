@file:Suppress("EXTENSION_SHADOWED_BY_MEMBER")

package io.whatif.heartbits

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PeopleAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import io.whatif.heartbits.data.BondStore
import io.whatif.heartbits.haptics.HapticEngine
import io.whatif.heartbits.relay.WebSocketRelay
import io.whatif.heartbits.ui.HeartBitsViewModel
import io.whatif.heartbits.ui.feel.FeelScreen
import io.whatif.heartbits.ui.pairing.PairingScreen
import io.whatif.heartbits.ui.send.SendScreen
import io.whatif.heartbits.ui.theme.HB

private const val RELAY_BASE  = "wss://hb.what-if.io/"
private const val RELAY_TOKEN = "fb266c34-97df-4bfc-9e51-bdba7b9c26ea"

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val bondStore = BondStore(this)

        // Handle deep link: heartbits://bond/<code>
        intent?.handleBondLink(bondStore)

        setContent {
            val roomId by bondStore.roomId.collectAsState()
            val partnerName by bondStore.partnerName.collectAsState()

            Box(modifier = Modifier.fillMaxSize().background(HB.Background)) {
                AnimatedContent(
                    targetState = roomId,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "root"
                ) { id ->
                    if (id != null) {
                        RootScreen(bondStore, id, partnerName)
                    } else {
                        PairingScreen(bondStore)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Deep link while app is already open
        intent.handleBondLink(BondStore(this))
    }
}

private fun Intent.handleBondLink(bondStore: BondStore) {
    if (action == Intent.ACTION_VIEW && data?.scheme == "heartbits" && data?.host == "bond") {
        data?.lastPathSegment?.let { code ->
            if (code.length == 8) bondStore.join(code, "")
        }
    }
}

// ── RootScreen ────────────────────────────────────────────────────────────────

@Composable
private fun RootScreen(bondStore: BondStore, roomId: String, partnerName: String) {
    val context = LocalContext.current
    val factory = remember(roomId) {
        val relay = WebSocketRelay("$RELAY_BASE$roomId", RELAY_TOKEN)
        val haptic = HapticEngine(context)
        HeartBitsViewModel.Factory(
            relay = relay,
            senderAddress = "0x${roomId.take(4)}",
            recipientAddress = "0x${roomId.takeLast(4)}",
            hapticEngine = haptic
        )
    }
    val vm: HeartBitsViewModel = viewModel(factory = factory)
    vm.partnerName = partnerName

    var showSheet by remember { mutableStateOf(false) }
    val pagerState = rememberPagerState(pageCount = { 2 })

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            when (page) {
                0 -> SendScreen(vm = vm)
                1 -> FeelScreen(vm = vm)
            }
        }

        // Page dots
        Row(
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 18.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(2) { i ->
                val active = pagerState.currentPage == i
                Box(
                    modifier = Modifier
                        .size(if (active) 5.dp else 4.dp)
                        .background(
                            color = if (active) Color.White else Color.White.copy(alpha = 0.22f),
                            shape = CircleShape
                        )
                )
            }
        }

        // Settings button
        IconButton(
            onClick = { showSheet = true },
            modifier = Modifier.align(Alignment.TopEnd).padding(top = 48.dp, end = 8.dp)
        ) {
            Icon(Icons.Filled.PeopleAlt, contentDescription = "Bond info", tint = Color.White.copy(alpha = 0.28f))
        }
    }

    if (showSheet) {
        BondSheet(vm = vm, bondStore = bondStore, roomId = roomId, onDismiss = { })
    }
}

// ── Bond info sheet ───────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BondSheet(
    vm: HeartBitsViewModel,
    bondStore: BondStore,
    roomId: String,
    onDismiss: () -> Unit
) {
    val connectionState by vm.connectionState.collectAsState()
    var confirmUnpair by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = HB.Background,
        tonalElevation = 0.dp
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp).padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Filled.Favorite, contentDescription = null, tint = HB.Coral, modifier = Modifier.size(32.dp))
            Spacer(Modifier.height(16.dp))

            if (vm.partnerName.isNotEmpty()) {
                Text(vm.partnerName, fontSize = 26.sp, fontWeight = FontWeight(200), color = Color.White)
            }
            Text(BondStore.display(roomId), fontSize = 15.sp, color = Color.White.copy(alpha = 0.4f), modifier = Modifier.padding(top = 4.dp))

            Spacer(Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(
                    modifier = Modifier.size(5.dp).background(
                        color = if (connectionState == HeartBitsViewModel.ConnectionState.CONNECTED) Color.Green else Color(0xFFFF8C00),
                        shape = CircleShape
                    )
                )
                Text(
                    if (connectionState == HeartBitsViewModel.ConnectionState.CONNECTED) "connected" else "connecting…",
                    fontSize = 12.sp,
                    color = Color.White.copy(alpha = 0.4f)
                )
            }

            Spacer(Modifier.height(32.dp))

            TextButton(onClick = { confirmUnpair = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Change partner", fontSize = 15.sp, color = Color.White.copy(alpha = 0.35f))
            }
        }
    }

    if (confirmUnpair) {
        AlertDialog(
            onDismissRequest = { },
            title = { Text("Change partner?") },
            text = { Text("You'll need to create or join a new bond.") },
            confirmButton = {
                TextButton(onClick = {
                    vm.tearDown()
                    bondStore.unpair()
                    onDismiss()
                }) { Text("Unpair", color = Color.Red) }
            },
            dismissButton = {
                TextButton(onClick = { }) { Text("Cancel") }
            },
            containerColor = HB.Background
        )
    }
}
