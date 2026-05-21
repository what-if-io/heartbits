import SwiftUI

extension Color {
    static let hbBackground = Color(red: 0.027, green: 0.027, blue: 0.063)
    static let hbCoral      = Color(red: 1.00,  green: 0.42,  blue: 0.42)
    static let hbPurple     = Color(red: 0.48,  green: 0.21,  blue: 0.87)
    static let hbMagenta    = Color(red: 0.91,  green: 0.12,  blue: 0.55)
}

extension LinearGradient {
    static let hbBrand = LinearGradient(
        colors: [.hbCoral, .hbPurple],
        startPoint: .leading,
        endPoint: .trailing
    )
    static let hbBrandDiag = LinearGradient(
        colors: [.hbCoral, .hbPurple],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// ── Gradient ECG waveform ─────────────────────────────────────────────────────

struct GradientHeartbeatWaveform: View {
    let bpm: Double
    @State private var progress: Double = 0

    private var beatInterval: Double { 60.0 / max(bpm, 20) }

    var body: some View {
        HeartbeatWaveform()
            .trim(from: 0, to: progress)
            .stroke(
                LinearGradient.hbBrand,
                style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round)
            )
            .onAppear { loop() }
            .onChange(of: bpm) { loop() }
    }

    private func loop() {
        progress = 0
        withAnimation(.linear(duration: beatInterval * 0.78)) {
            progress = 1.0
        }
        Task {
            try? await Task.sleep(for: .seconds(beatInterval))
            loop()
        }
    }

    init(bpm: Double) { self.bpm = bpm }
}

// ── Flatline (no signal) ──────────────────────────────────────────────────────

struct Flatline: View {
    var body: some View {
        GeometryReader { geo in
            Path { p in
                let y = geo.size.height / 2
                p.move(to: CGPoint(x: 0, y: y))
                p.addLine(to: CGPoint(x: geo.size.width, y: y))
            }
            .stroke(
                Color.white.opacity(0.10),
                style: StrokeStyle(lineWidth: 1.0, dash: [8, 8])
            )
        }
    }
}
