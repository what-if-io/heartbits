import SwiftUI

private let relayToken = "cda99d6005b24de627b034f8ac5d27edde0abbcddaef1ac18d05a7cc3934ce61"
private let relayBase  = "wss://hb.what-if.io/"

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
