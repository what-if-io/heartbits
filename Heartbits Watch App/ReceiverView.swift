import SwiftUI

// ── ReceiverView ──────────────────────────────────────────────────────────────
//
// "Their Heart" — Partner B's watch screen.
// Receives HeartBits from the relay and plays them back as haptic lub-dub.

public struct ReceiverView: View {
    var vm: HeartBitsViewModel

    private var hasSignal: Bool {
        guard let last = vm.lastReceived else { return false }
        return Date().timeIntervalSince(last) < 10
    }

    public var body: some View {
        ZStack {
            Color.hbBackground.ignoresSafeArea()

            // Soft purple glow when receiving
            RadialGradient(
                colors: [Color.hbPurple.opacity(hasSignal ? 0.14 : 0.0), Color.clear],
                center: .center,
                startRadius: 5,
                endRadius: 100
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 1.5), value: hasSignal)

            VStack(spacing: 0) {
                Spacer()

                if !vm.partnerName.isEmpty {
                    Text(vm.partnerName)
                        .font(.system(size: 13, weight: .light))
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 6)
                }

                // ECG waveform
                Group {
                    if hasSignal {
                        GradientHeartbeatWaveform(bpm: max(vm.partnerBPM, 40))
                            .frame(height: 28)
                            .padding(.horizontal, 12)
                            .transition(.opacity.combined(with: .scale(scale: 0.95)))
                    } else {
                        Flatline()
                            .frame(height: 28)
                            .padding(.horizontal, 12)
                    }
                }
                .animation(.easeInOut(duration: 0.5), value: hasSignal)
                .padding(.bottom, 10)

                // BPM
                Group {
                    if hasSignal {
                        Text("\(Int(vm.partnerBPM))")
                            .font(.system(size: 52, weight: .thin, design: .rounded))
                            .foregroundStyle(.white)
                            .contentTransition(.numericText(countsDown: false))
                    } else {
                        Text("––")
                            .font(.system(size: 52, weight: .thin, design: .rounded))
                            .foregroundStyle(.tertiary)
                    }
                }
                .animation(.easeInOut(duration: 0.4), value: hasSignal)

                Text("their heartbeat")
                    .font(.system(size: 11, weight: .light))
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)

                Spacer()

                if let last = vm.lastReceived {
                    Text(last, style: .relative)
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                        .padding(.bottom, 6)
                }
            }
        }
        .animation(.easeInOut(duration: 0.6), value: hasSignal)
        .task {
            await vm.startReceiving(partnerName: vm.partnerName)
        }
    }
}

#Preview("Receiving") {
    let vm = HeartBitsViewModel(
        relay: SimulatedRelay(),
        senderAddress: "0xAlice",
        recipientAddress: "0xBob"
    )
    vm.partnerName = "Alice"
    vm.partnerBPM = 68
    vm.lastReceived = Date()
    return ReceiverView(vm: vm)
}

#Preview("Waiting") {
    let vm = HeartBitsViewModel(
        relay: SimulatedRelay(),
        senderAddress: "0xAlice",
        recipientAddress: "0xBob"
    )
    vm.partnerName = "Alice"
    return ReceiverView(vm: vm)
}
