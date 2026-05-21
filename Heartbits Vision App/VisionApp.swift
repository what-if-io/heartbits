#if os(visionOS)
import SwiftUI

// ── HeartBits for Apple Vision Pro ────────────────────────────────────────────
//
// A pure receiver experience: their heartbeat floating in your space.
// The volumetric window lets the rings expand into the room.
//
// To add this target in Xcode:
//   File → New Target → visionOS → App
//   Name: "Heartbits Vision App"
//   Add all files from Heartbits/ to the new target's Compile Sources
//   (or use a Swift Package for shared code — see lesson/09)

// ── Relay URL ─────────────────────────────────────────────────────────────────
// Must match the sender (iOS / watch) — same room, same server.
private let relayURL = URL(string: "ws://localhost:8765/alice-bob")!

@main
struct HeartbitsVisionApp: App {
    @State private var vm: HeartBitsViewModel
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let vm = HeartBitsViewModel(
            relay: WebSocketRelay(url: relayURL),
            senderAddress: "0xAlice",
            recipientAddress: "0xBob"
        )
        vm.partnerName = "Alex"
        _vm = State(initialValue: vm)
    }

    var body: some Scene {
        // Volumetric window — gives depth to the ring animations
        WindowGroup {
            VisionFeelView(vm: vm)
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 0.7, height: 0.6, depth: 0.5, in: .meters)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { vm.tearDown() }
        }
    }
}
#endif
