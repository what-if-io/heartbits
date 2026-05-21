import SwiftUI

// ── HeartbeatWaveform ─────────────────────────────────────────────────────────
//
// A custom Shape that draws one cycle of a stylised ECG trace:
// P wave → QRS complex (the main spike) → T wave → baseline.
//
// The shape animates by revealing the line left-to-right using a trim modifier.
// Call it like:
//
//   HeartbeatWaveform()
//       .trim(from: 0, to: progress)   // progress: 0.0 → 1.0 over beatInterval
//       .stroke(Color.red, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
//       .frame(height: 32)
//
// Normalized control points (x: 0–1, y: 0–1 where 0.5 = baseline):

public struct HeartbeatWaveform: Shape {
    public func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        let mid = h * 0.5   // baseline y

        // Maps normalized (0–1, 0–1) to rect coordinates
        func pt(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: w * x, y: mid - (0.5 - y) * h)
        }

        var path = Path()

        // Baseline start
        path.move(to: pt(0.00, 0.50))
        path.addLine(to: pt(0.10, 0.50))

        // P wave (atrial depolarisation — small bump)
        path.addCurve(
            to: pt(0.20, 0.50),
            control1: pt(0.13, 0.35),
            control2: pt(0.17, 0.35)
        )

        // PR segment (flat)
        path.addLine(to: pt(0.28, 0.50))

        // QRS complex — the signature spike
        path.addLine(to: pt(0.33, 0.58))   // Q dip
        path.addLine(to: pt(0.38, 0.02))   // R peak — the tall spike
        path.addLine(to: pt(0.43, 0.65))   // S undershoot
        path.addLine(to: pt(0.48, 0.50))   // return to baseline

        // ST segment
        path.addLine(to: pt(0.55, 0.50))

        // T wave (ventricular repolarisation — broad hump)
        path.addCurve(
            to: pt(0.75, 0.50),
            control1: pt(0.60, 0.28),
            control2: pt(0.70, 0.28)
        )

        // Post-T baseline to end
        path.addLine(to: pt(1.00, 0.50))

        return path
    }

    public init() {}
}

// MARK: - Animated wrapper

public struct AnimatedHeartbeatWaveform: View {
    let bpm: Double
    let color: Color

    @State private var progress: Double = 0
    @State private var isAnimating = false

    private var beatInterval: Double { 60.0 / bpm }

    public var body: some View {
        HeartbeatWaveform()
            .trim(from: 0, to: progress)
            .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            .onAppear { startLoop() }
            .onChange(of: bpm) { startLoop() }
    }

    private func startLoop() {
        isAnimating = false
        progress = 0

        withAnimation(.linear(duration: beatInterval * 0.8)) {
            progress = 1.0
        }

        Task {
            try? await Task.sleep(for: .seconds(beatInterval))
            startLoop()
        }
    }

    public init(bpm: Double, color: Color = .red) {
        self.bpm = bpm
        self.color = color
    }
}

#Preview {
    AnimatedHeartbeatWaveform(bpm: 72)
        .frame(width: 160, height: 40)
        .padding()
        .background(.black)
}
