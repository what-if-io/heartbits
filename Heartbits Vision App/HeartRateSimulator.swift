import Foundation

// ── HeartRateSimulator ────────────────────────────────────────────────────────
//
// Feeds realistic heart rate data to the ViewModel on Simulator / preview.
// Replaces itself with a real HKAnchoredObjectQuery in lesson/05.
//
// Simulates gentle variability: a resting heart drifts between 62–78 bpm
// with small beat-to-beat fluctuation — close to real HRV behaviour.

@MainActor
final class HeartRateSimulator {
    private var task: Task<Void, Never>?
    private let onBeat: (Double) -> Void

    init(onBeat: @escaping (Double) -> Void) {
        self.onBeat = onBeat
    }

    func start(baseBPM: Double = 72) {
        task = Task { @MainActor in
            var current = baseBPM
            while !Task.isCancelled {
                // Small random drift — mirrors heart rate variability
                let drift = Double.random(in: -1.5...1.5)
                current = min(max(current + drift, 58), 90)

                onBeat(current)

                let interval = 60.0 / current
                try? await Task.sleep(for: .seconds(interval))
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}
