#if os(visionOS)
import SwiftUI

// ── VisionFeelView ────────────────────────────────────────────────────────────
//
// Spatial receiver for Apple Vision Pro.
// Their heartbeat floats in the room as a glowing orb — each beat sends
// concentric rings of light radiating outward through 3D space.
//
// Window style: .volumetric (set in VisionApp.swift) gives the rings real depth.
// depth layers via offset(z:):
//   partner name watermark  z = –200  (far back, almost on the wall)
//   outer rings             z = 0–30  (in the space between)
//   heart orb               z = 80    (pops forward toward the viewer)
//   ornament                attached below the window via .ornament()

public struct VisionFeelView: View {
    @State var vm: HeartBitsViewModel

    @State private var pulseScale: CGFloat = 1.0
    @State private var ring1Scale: CGFloat = 1.0;  @State private var ring1Opacity: Double = 0
    @State private var ring2Scale: CGFloat = 1.0;  @State private var ring2Opacity: Double = 0
    @State private var ring3Scale: CGFloat = 1.0;  @State private var ring3Opacity: Double = 0

    private var hasSignal: Bool {
        guard let last = vm.lastReceived else { return false }
        return Date().timeIntervalSince(last) < 10
    }

    public var body: some View {
        ZStack {

            // ── Far back: partner name watermark ──────────────────────
            Text(vm.partnerName.isEmpty ? "…" : vm.partnerName)
                .font(.system(size: 220, weight: .ultraLight, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.hbCoral.opacity(0.05), Color.hbPurple.opacity(0.05)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .lineLimit(1)
                .minimumScaleFactor(0.3)
                .offset(z: -200)
                .animation(.easeInOut(duration: 0.6), value: vm.partnerName)

            // ── Mid-space: emanating rings ─────────────────────────────
            Circle()
                .stroke(Color.hbPurple.opacity(ring3Opacity), lineWidth: 0.7)
                .frame(width: 340, height: 340)
                .scaleEffect(ring3Scale)
                .offset(z: 8)

            Circle()
                .stroke(
                    LinearGradient(
                        colors: [Color.hbCoral.opacity(ring2Opacity), Color.hbPurple.opacity(ring2Opacity)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.0
                )
                .frame(width: 290, height: 290)
                .scaleEffect(ring2Scale)
                .offset(z: 22)

            Circle()
                .stroke(Color.hbCoral.opacity(ring1Opacity), lineWidth: 1.5)
                .frame(width: 245, height: 245)
                .scaleEffect(ring1Scale)
                .offset(z: 36)

            // ── Foreground: glowing heart orb ─────────────────────────
            ZStack {
                // Radial bloom
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.hbCoral.opacity(0.28),
                                Color.hbPurple.opacity(0.14),
                                .clear
                            ],
                            center: .center,
                            startRadius: 10,
                            endRadius: 110
                        )
                    )
                    .frame(width: 220, height: 220)
                    .blur(radius: 10)

                // Core sphere
                Circle()
                    .fill(LinearGradient.hbBrandDiag)
                    .frame(width: 120, height: 120)
                    .shadow(color: Color.hbCoral.opacity(0.55), radius: 48)

                // Inline BPM
                VStack(spacing: 0) {
                    Text(hasSignal ? "\(Int(vm.partnerBPM))" : "––")
                        .font(.system(size: 42, weight: .ultraLight, design: .rounded))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                        .animation(.easeInOut(duration: 0.3), value: Int(vm.partnerBPM))
                    if hasSignal {
                        Text("bpm")
                            .font(.system(size: 11, weight: .light))
                            .foregroundStyle(.white.opacity(0.55))
                            .padding(.top, 1)
                    }
                }
            }
            .scaleEffect(pulseScale)
            .offset(z: 80)
            .hoverEffect()
        }
        .frame(width: 640, height: 520)
        .onChange(of: vm.isBeating) { _, beating in
            guard beating else { return }
            fireBeat()
        }
        .ornament(attachmentAnchor: .scene(.bottom)) {
            bottomOrnament
                .glassBackgroundEffect()
        }
        .task {
            await vm.startReceiving(partnerName: vm.partnerName)
        }
    }

    // MARK: - Bottom ornament (glass pill)

    private var bottomOrnament: some View {
        HStack(spacing: 24) {

            if !vm.partnerName.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text(vm.partnerName)
                        .font(.system(size: 22, weight: .light, design: .rounded))
                        .foregroundStyle(.white)
                    Text("their heart")
                        .font(.system(size: 11, weight: .light))
                        .foregroundStyle(.secondary)
                }
            }

            if !vm.partnerName.isEmpty {
                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 1, height: 44)
            }

            VStack(spacing: 2) {
                Text(hasSignal ? "\(Int(vm.partnerBPM))" : "––")
                    .font(.system(size: 44, weight: .ultraLight, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.3), value: Int(vm.partnerBPM))
                Text("bpm")
                    .font(.system(size: 12, weight: .light))
                    .foregroundStyle(.tertiary)
            }

            if hasSignal {
                GradientHeartbeatWaveform(bpm: max(vm.partnerBPM, 40))
                    .frame(width: 110, height: 30)
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }

        }
        .padding(.horizontal, 32)
        .padding(.vertical, 20)
        .animation(.easeInOut(duration: 0.5), value: hasSignal)
        .animation(.easeInOut(duration: 0.5), value: vm.partnerName)
    }

    // MARK: - Beat animation

    private func fireBeat() {
        // Orb pulse
        withAnimation(.spring(response: 0.12, dampingFraction: 0.38)) {
            pulseScale = 1.30
        }
        withAnimation(.spring(response: 0.38, dampingFraction: 0.62).delay(0.12)) {
            pulseScale = 1.0
        }

        // Ring 1 — tight, fast
        ring1Scale = 1.0; ring1Opacity = 0.9
        withAnimation(.easeOut(duration: 0.9)) { ring1Scale = 1.85; ring1Opacity = 0 }

        // Ring 2 — medium, 80ms later
        Task {
            try? await Task.sleep(for: .milliseconds(80))
            ring2Scale = 1.0; ring2Opacity = 0.55
            withAnimation(.easeOut(duration: 1.25)) { ring2Scale = 2.3; ring2Opacity = 0 }
        }

        // Ring 3 — wide, 160ms later
        Task {
            try? await Task.sleep(for: .milliseconds(160))
            ring3Scale = 1.0; ring3Opacity = 0.30
            withAnimation(.easeOut(duration: 1.7)) { ring3Scale = 3.0; ring3Opacity = 0 }
        }
    }
}

#Preview {
    let vm = HeartBitsViewModel(
        relay: SimulatedRelay(),
        senderAddress: "0xAlice",
        recipientAddress: "0xBob"
    )
    vm.partnerName = "Alex"
    vm.partnerBPM = 72
    vm.lastReceived = Date()
    return VisionFeelView(vm: vm)
}
#endif
