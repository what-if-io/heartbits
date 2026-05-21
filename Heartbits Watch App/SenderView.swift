import SwiftUI

// ── SenderView ────────────────────────────────────────────────────────────────
//
// "My Heart" — Partner A's watch screen.
// Reads live BPM, pulses on each beat, transmits via relay.

public struct SenderView: View {
    @State var vm: HeartBitsViewModel
    var roomCode: String = ""
    @State private var healthKit: HealthKitReader?
    @State private var simulator: HeartRateSimulator?

    @State private var pingScale: CGFloat = 1.0
    @State private var pingOpacity: Double = 0.0

    public var body: some View {
        ZStack {
            Color.hbBackground.ignoresSafeArea()

            // Zone-reactive radial glow
            RadialGradient(
                colors: [zoneColor.opacity(0.18), Color.clear],
                center: .center,
                startRadius: 5,
                endRadius: 100
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 2.0), value: vm.myBPM)

            VStack(spacing: 0) {
                Spacer()

                ZStack {
                    // Sonar ping
                    Circle()
                        .stroke(zoneColor, lineWidth: 1)
                        .frame(width: 72, height: 72)
                        .scaleEffect(pingScale)
                        .opacity(pingOpacity)

                    // Gradient heart icon — pulses on each beat
                    Image(systemName: vm.isSending ? "heart.fill" : "heart")
                        .font(.system(size: 26, weight: .light))
                        .foregroundStyle(LinearGradient.hbBrandDiag)
                        .scaleEffect(vm.isBeating ? 1.28 : 1.0)
                        .animation(
                            .spring(response: 0.13, dampingFraction: 0.45),
                            value: vm.isBeating
                        )
                }
                .padding(.bottom, 8)

                // BPM — dominant element
                Text(bpmText)
                    .font(.system(size: 52, weight: .thin, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(countsDown: false))
                    .animation(.easeInOut(duration: 0.3), value: vm.myBPM)

                Text("bpm")
                    .font(.system(size: 13, weight: .light))
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)

                Spacer()

                // ECG trace
                Group {
                    if vm.myBPM > 0 {
                        GradientHeartbeatWaveform(bpm: max(vm.myBPM, 40))
                            .frame(height: 28)
                            .padding(.horizontal, 12)
                            .transition(.opacity)
                    } else {
                        Flatline()
                            .frame(height: 28)
                            .padding(.horizontal, 12)
                    }
                }
                .animation(.easeInOut(duration: 0.5), value: vm.myBPM > 0)

                statusBar
                    .padding(.top, 8)
                    .padding(.bottom, 6)
            }
        }
        .onChange(of: vm.isBeating) { _, beating in
            guard beating else { return }
            firePing()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        if vm.isSending { vm.stopSending() }
                        else { await vm.startSending() }
                    }
                } label: {
                    Image(systemName: vm.isSending ? "stop.circle" : "play.circle")
                        .foregroundStyle(vm.isSending ? .red : .green)
                }
            }
        }
        .task {
            #if targetEnvironment(simulator)
            let sim = HeartRateSimulator { [vm] bpm in
                Task { await vm.didReceiveHeartRate(bpm) }
            }
            simulator = sim
            sim.start()
            #endif

            if HealthKitReader.isSupported {
                let reader = HealthKitReader { [vm] bpm in
                    Task { await vm.didReceiveHeartRate(bpm) }
                }
                healthKit = reader
                await reader.requestAndStart()
            }

            await vm.startSending()
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var statusBar: some View {
        switch vm.connectionState {
        case .connected:
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(LinearGradient.hbBrand)
                        .frame(width: 5, height: 5)
                    Text("sending")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                if !roomCode.isEmpty {
                    Text(BondStore.display(roomCode))
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(.quaternary)
                }
            }
        case .connecting:
            HStack(spacing: 4) {
                ProgressView().scaleEffect(0.6)
                Text("connecting")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        case .error(let msg):
            Text(msg)
                .font(.system(size: 11))
                .foregroundStyle(.red)
        case .disconnected:
            Text("tap ▶ to begin")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
        }
    }

    // MARK: - Helpers

    private func firePing() {
        pingScale = 1.0
        pingOpacity = 0.65
        withAnimation(.easeOut(duration: 0.8)) {
            pingScale = 1.9
            pingOpacity = 0
        }
    }

    private var bpmText: String {
        vm.myBPM > 0 ? "\(Int(vm.myBPM))" : "––"
    }

    private var zoneColor: Color {
        switch vm.myBPM {
        case 0:        return .gray
        case ..<60:    return Color(hue: 0.62, saturation: 0.8, brightness: 0.9)
        case 60..<80:  return .hbCoral
        case 80..<100: return Color(hue: 0.05, saturation: 0.95, brightness: 1.0)
        default:       return .hbMagenta
        }
    }
}

#Preview {
    let vm = HeartBitsViewModel(
        relay: SimulatedRelay(),
        senderAddress: "0xAlice",
        recipientAddress: "0xBob"
    )
    vm.myBPM = 72
    vm.isSending = true
    vm.connectionState = .connected
    return SenderView(vm: vm)
}
