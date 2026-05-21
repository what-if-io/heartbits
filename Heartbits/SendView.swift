import SwiftUI

// ── SendView ─────────────────────────────────────────────────────────────────
//
// "My Heart" — the sender screen.
//
// The centerpiece is a large gradient ring that pulses at the real BPM.
// Each beat fires a sonar ping: a second ring that expands outward and fades.
// The background breathes a warm glow that shifts with heart-rate zone.
// An ECG trace scrolls at the bottom as ambient proof of signal.

public struct SendView: View {
    @State var vm: HeartBitsViewModel
    @State private var healthKit: HealthKitReader?
    @State private var simulator: HeartRateSimulator?

    // Sonar ping state — one expanding ring per beat
    @State private var pingScale: CGFloat = 1.0
    @State private var pingOpacity: Double = 0.0

    // Second, slower ping for depth
    @State private var ping2Scale: CGFloat = 1.0
    @State private var ping2Opacity: Double = 0.0

    private let ringSize: CGFloat = 228

    public var body: some View {
        ZStack {
            // ── Background ─────────────────────────────────────────────────
            Color.hbBackground.ignoresSafeArea()

            // Breathing zone-reactive glow from center
            RadialGradient(
                colors: [zoneColor.opacity(0.16), Color.clear],
                center: .center,
                startRadius: 10,
                endRadius: 440
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 2.2), value: vm.myBPM)

            // ── Content ────────────────────────────────────────────────────
            VStack(spacing: 0) {

                // Status line — appears when actively sharing
                statusLine
                    .padding(.top, 64)

                Spacer()

                // Hero: ring + pings + BPM
                ZStack {
                    // Sonar ping 2 (slower, larger radius)
                    Circle()
                        .stroke(zoneColor.opacity(0.25), lineWidth: 1)
                        .frame(width: ringSize, height: ringSize)
                        .scaleEffect(ping2Scale)
                        .opacity(ping2Opacity)
                        .blur(radius: 1)

                    // Sonar ping 1 (faster, tighter)
                    Circle()
                        .stroke(zoneColor, lineWidth: 1.5)
                        .frame(width: ringSize, height: ringSize)
                        .scaleEffect(pingScale)
                        .opacity(pingOpacity)

                    // Main ring — gradient stroke, pulses on beat
                    Circle()
                        .stroke(LinearGradient.hbBrandDiag, lineWidth: 2)
                        .frame(width: ringSize, height: ringSize)
                        .scaleEffect(vm.isBeating ? 1.038 : 1.0)
                        .shadow(color: .hbCoral.opacity(0.35), radius: 14)
                        .animation(
                            .spring(response: 0.13, dampingFraction: 0.40),
                            value: vm.isBeating
                        )

                    // Inner glow ring
                    Circle()
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                        .frame(width: ringSize - 18, height: ringSize - 18)

                    // BPM display
                    VStack(spacing: 0) {
                        Text(vm.myBPM > 0 ? "\(Int(vm.myBPM))" : "––")
                            .font(.system(size: 76, weight: .ultraLight, design: .rounded))
                            .foregroundStyle(.white)
                            .contentTransition(.numericText())
                            .animation(.easeInOut(duration: 0.25), value: Int(vm.myBPM))

                        Text("bpm")
                            .font(.system(size: 15, weight: .light))
                            .foregroundStyle(.tertiary)
                            .padding(.top, 1)
                    }
                }

                Spacer()

                // ECG trace — visible once we have a signal
                Group {
                    if vm.myBPM > 0 {
                        GradientHeartbeatWaveform(bpm: max(vm.myBPM, 40))
                            .frame(height: 44)
                            .padding(.horizontal, 28)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                    } else {
                        Flatline()
                            .frame(height: 44)
                            .padding(.horizontal, 28)
                    }
                }
                .animation(.easeInOut(duration: 0.6), value: vm.myBPM > 0)

                Spacer().frame(height: 52)
            }
        }
        .onChange(of: vm.isBeating) { _, beating in
            guard beating else { return }
            firePing()
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
    private var statusLine: some View {
        Group {
            switch vm.connectionState {
            case .error(let msg):
                HStack(spacing: 6) {
                    Circle().fill(.red).frame(width: 5, height: 5)
                    Text(msg)
                }
                .foregroundStyle(.red.opacity(0.8))
            case .connecting:
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.55)
                    Text("connecting…")
                }
                .foregroundStyle(.secondary)
            case .connected where vm.isSending && !vm.partnerName.isEmpty:
                HStack(spacing: 6) {
                    Circle().fill(LinearGradient.hbBrand).frame(width: 5, height: 5)
                    Text("sharing with \(vm.partnerName)")
                }
                .foregroundStyle(.secondary)
            case .connected where vm.isSending:
                HStack(spacing: 6) {
                    Circle().fill(.green).frame(width: 5, height: 5)
                    Text("sharing your heartbeat")
                }
                .foregroundStyle(.secondary)
            default:
                Text("swipe left to feel theirs")
                    .foregroundStyle(.secondary)
            }
        }
        .font(.system(size: 13, weight: .light))
        .animation(.easeInOut(duration: 0.4), value: vm.connectionState)
    }

    // MARK: - Helpers

    private func firePing() {
        // Fast tight ping
        pingScale = 1.0
        pingOpacity = 0.70
        withAnimation(.easeOut(duration: 0.75)) {
            pingScale = 1.48
            pingOpacity = 0
        }

        // Slower wider ping — launches 80ms after, different radius
        Task {
            try? await Task.sleep(for: .milliseconds(80))
            ping2Scale = 1.0
            ping2Opacity = 0.45
            withAnimation(.easeOut(duration: 1.1)) {
                ping2Scale = 1.72
                ping2Opacity = 0
            }
        }
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
    vm.partnerName = "Alex"
    return SendView(vm: vm)
        .preferredColorScheme(.dark)
}
