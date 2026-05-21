import SwiftUI

private let relayToken = "fb266c34-97df-4bfc-9e51-bdba7b9c26ea"
private let relayBase  = "wss://hb.what-if.io/"

@main
struct HeartBitsApp: App {
    @State private var store = BondStore()
    @State private var vm: HeartBitsViewModel?
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ZStack {
                if store.isBonded, let vm {
                    RootView(vm: vm, roomId: store.roomId ?? "")
                        .transition(.opacity)
                } else {
                    WatchPairingView()
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.5), value: store.isBonded)
            .onChange(of: store.isBonded) { _, bonded in
                if bonded { bootVM() }
            }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .background:
                    vm?.tearDown()
                case .active:
                    // Re-establish relay after background — tearDown cancelled the socket
                    if let vm, store.isBonded {
                        Task { await vm.startSending() }
                    }
                default:
                    break
                }
            }
            .onAppear {
                WatchBridge.shared.onBondReceived = { [store] roomId, name in
                    store.receivedFromPhone(roomId: roomId, partnerName: name)
                    rebootVM()
                }
                WatchBridge.shared.onUnpairReceived = {
                    vm?.tearDown()
                    vm = nil
                    store.unpair()
                }
                WatchBridge.shared.checkExistingContext()
                bootVM()
            }
        }
    }

    private func bootVM() {
        guard store.isBonded, let roomId = store.roomId, vm == nil else { return }
        vm = makeVM(roomId: roomId)
    }

    private func rebootVM() {
        guard store.isBonded, let roomId = store.roomId else { return }
        vm?.tearDown()
        vm = nil
        vm = makeVM(roomId: roomId)
    }

    private func makeVM(roomId: String) -> HeartBitsViewModel {
        let url   = URL(string: "\(relayBase)\(roomId)")!
        let relay = WebSocketRelay(url: url, token: relayToken)
        let newVM = HeartBitsViewModel(
            relay: relay,
            senderAddress:    "0x\(roomId.prefix(4))",
            recipientAddress: "0x\(roomId.suffix(4))"
        )
        newVM.partnerName = store.partnerName
        WatchBridge.shared.onPartnerBeatReceived = { [weak newVM] bpm, rr in
            newVM?.didReceivePartnerBeat(bpm: bpm, rrIntervalMs: rr)
        }
        return newVM
    }
}

// Watch: swipe left/right between Send and Feel
struct RootView: View {
    var vm: HeartBitsViewModel
    var roomId: String

    var body: some View {
        TabView {
            SenderView(vm: vm, roomCode: roomId)
            ReceiverView(vm: vm)
        }
    }
}
