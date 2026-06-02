import SwiftUI

// Relay config — never hardcode the token. Inject RELAY_TOKEN / RELAY_BASE via the
// scheme's environment variables or a gitignored Secrets.xcconfig (mirrors the
// Watch app's RelayConfig). An empty token targets an open/local-dev relay only.
private let relayToken = ProcessInfo.processInfo.environment["RELAY_TOKEN"]
    ?? Bundle.main.infoDictionary?["RELAY_TOKEN"] as? String
    ?? ""
private let relayBase = ProcessInfo.processInfo.environment["RELAY_BASE"]
    ?? Bundle.main.infoDictionary?["RELAY_BASE"] as? String
    ?? "wss://relay.heartbits.what-if.io/"

@main
struct HeartbitsApp: App {
    @State private var store = BondStore()
    @State private var vm: HeartBitsViewModel?
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ZStack {
                if store.isBonded, let vm {
                    RootView(vm: vm, store: store)
                        .transition(.opacity)
                } else {
                    PairingView(store: store)
                        .transition(.opacity)
                }
            }
            .preferredColorScheme(.dark)
            .animation(.easeInOut(duration: 0.5), value: store.isBonded)
            .onChange(of: store.isBonded) { _, bonded in
                if bonded { bootVM() }
                else      { vm?.tearDown(); vm = nil }
            }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .background:
                    vm?.tearDown()
                case .active:
                    if let vm, store.isBonded {
                        Task { await vm.startSending() }
                    }
                default:
                    break
                }
            }
            .onAppear { bootVM() }
        }
    }

    private func bootVM() {
        guard store.isBonded, let roomId = store.roomId, vm == nil else { return }
        let url   = URL(string: "\(relayBase)\(roomId)")!
        let relay = WebSocketRelay(url: url, token: relayToken)
        let newVM = HeartBitsViewModel(
            relay: relay,
            senderAddress:    "0x\(roomId.prefix(4))",
            recipientAddress: "0x\(roomId.suffix(4))"
        )
        newVM.partnerName = store.partnerName
        vm = newVM
        WatchBridge.shared.onHeartRateReceived = { [weak newVM] bpm in
            Task { await newVM?.didReceiveHeartRate(bpm) }
        }
        WatchBridge.shared.syncBond(roomId: roomId, partnerName: store.partnerName)
    }
}
