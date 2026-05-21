import SwiftUI

// ── FeelView ──────────────────────────────────────────────────────────────────
//
// "Their Heart" — the receiver screen.
//
// The ECG waveform is the hero. Full-width, gradient-stroked, it scrolls at
// the received BPM. The partner's name floats above. The BPM number dominates
// below. When no signal has arrived in 10 seconds the waveform becomes a flat
// dashed line — the silence is as legible as the signal.
//
// A subtle purple bloom pulses on every received beat. The background shifts
// imperceptibly warmer as BPM rises — the room changes temperature with them.

public struct FeelView: View {
    @State var vm: HeartBitsViewModel

    // Bloom overlay — fires on each received beat
    @State private var bloomOpacity: Double = 0.0

    private var hasSignal: Bool {
        guard let last = vm.lastReceived else { return false }
        return Date().timeIntervalSince(last) < 10
    }

    public var body: some View {
        ZStack {
            // ── Background ─────────────────────────────────────────────────
            Color.hbBackground.ignoresSafeArea()

            // Purple ambient glow when signal is live
            RadialGradient(
                colors: [
                    Color.hbPurple.opacity(hasSignal ? 0.13 : 0.0),
                    Color.clear
                ],
                center: .center,
                startRadius: 0,
                endRadius: 460
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 1.2), value: hasSignal)

            // Beat bloom — brief full-screen pulse
            Color.hbPurple
                .opacity(bloomOpacity)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            // ── Content ────────────────────────────────────────────────────
            VStack(spacing: 0) {

                // Partner identity
                partnerHeader
                    .padding(.top, 72)

                Spacer()

                // Hero: ECG or flatline
                waveformSection
                    .frame(height: 68)
                    .padding(.horizontal, 20)

                Spacer().frame(height: 36)

                // BPM
                bpmDisplay

                Text("bpm")
                    .font(.system(size: 15, weight: .light))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)

                Spacer()

                // Last-received timestamp
                if let last = vm.lastReceived {
                    Text(last, style: .relative)
                        .font(.system(size: 12, weight: .light, design: .rounded))
                        .foregroundStyle(.quaternary)
                        .padding(.bottom, 44)
                }
            }
        }
        .onChange(of: vm.lastReceived) { _, _ in
            bloom()
        }
        .task {
            await vm.startReceiving(partnerName: vm.partnerName)
        }
    }

    // MARK: - Subviews

    private var partnerHeader: some View {
        VStack(spacing: 6) {
            Group {
                if !vm.partnerName.isEmpty {
                    Text(vm.partnerName)
                        .foregroundStyle(.white)
                } else {
                    Text("waiting…")
                        .foregroundStyle(Color.white.opacity(0.25))
                }
            }
            .font(.system(size: 36, weight: .ultraLight, design: .rounded))

            Text("their heart")
                .font(.system(size: 13, weight: .light))
                .foregroundStyle(.secondary)
        }
        .animation(.easeInOut(duration: 0.5), value: vm.partnerName)
    }

    @ViewBuilder
    private var waveformSection: some View {
        Group {
            if hasSignal {
                GradientHeartbeatWaveform(bpm: max(vm.partnerBPM, 40))
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.94, anchor: .center)),
                        removal: .opacity
                    ))
            } else {
                Flatline()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.7), value: hasSignal)
    }

    private var bpmDisplay: some View {
        Group {
            if hasSignal {
                Text("\(Int(vm.partnerBPM))")
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(countsDown: false))
            } else {
                Text("––")
                    .foregroundStyle(Color.white.opacity(0.18))
            }
        }
        .font(.system(size: 96, weight: .ultraLight, design: .rounded))
        .animation(.easeInOut(duration: 0.4), value: hasSignal)
        .animation(.easeInOut(duration: 0.3), value: Int(vm.partnerBPM))
    }

    // MARK: - Helpers

    private func bloom() {
        bloomOpacity = 0.05
        withAnimation(.easeOut(duration: 0.55)) {
            bloomOpacity = 0
        }
    }
}

#Preview("Receiving") {
    let vm = HeartBitsViewModel(
        relay: SimulatedRelay(),
        senderAddress: "0xAlice",
        recipientAddress: "0xBob"
    )
    vm.partnerName = "Alex"
    vm.partnerBPM = 68
    vm.lastReceived = Date()
    return FeelView(vm: vm)
        .preferredColorScheme(.dark)
}

#Preview("Waiting") {
    let vm = HeartBitsViewModel(
        relay: SimulatedRelay(),
        senderAddress: "0xAlice",
        recipientAddress: "0xBob"
    )
    vm.partnerName = "Alex"
    return FeelView(vm: vm)
        .preferredColorScheme(.dark)
}
