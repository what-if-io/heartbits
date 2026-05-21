import Foundation
import HealthKit

// ── HealthKitReader (watchOS) ─────────────────────────────────────────────────
//
// Streams live heart rate from the watch sensor via HKAnchoredObjectQuery.
// The anchor persists the read position — on restart, only new samples arrive.
//
// Falls back gracefully if permission is denied or the hardware lacks a sensor.

@MainActor
final class HealthKitReader {
    private let store = HKHealthStore()
    private var query: HKAnchoredObjectQuery?
    private var anchor: HKQueryAnchor?
    private let onBeat: (Double) -> Void

    static var isSupported: Bool { HKHealthStore.isHealthDataAvailable() }

    init(onBeat: @escaping (Double) -> Void) {
        self.onBeat = onBeat
    }

    func requestAndStart() async {
        guard Self.isSupported else { return }

        let heartRateType = HKQuantityType(.heartRate)

        do {
            try await store.requestAuthorization(toShare: [], read: [heartRateType])
            try await store.enableBackgroundDelivery(for: heartRateType, frequency: .immediate)
        } catch {
            return
        }

        let query = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: HKQuery.predicateForSamples(
                withStart: Date().addingTimeInterval(-5),
                end: nil
            ),
            anchor: anchor,
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, _, newAnchor, _ in
            Task { @MainActor [weak self] in
                self?.anchor = newAnchor
                self?.deliver(samples)
            }
        }

        query.updateHandler = { [weak self] _, samples, _, newAnchor, _ in
            Task { @MainActor [weak self] in
                self?.anchor = newAnchor
                self?.deliver(samples)
            }
        }

        store.execute(query)
        self.query = query
    }

    func stop() {
        if let query { store.stop(query) }
        query = nil
    }

    private func deliver(_ samples: [HKSample]?) {
        guard let samples = samples as? [HKQuantitySample],
              let latest = samples.max(by: { $0.endDate < $1.endDate }) else { return }
        let bpm = latest.quantity.doubleValue(for: HKUnit(from: "count/min"))
        onBeat(bpm)
    }
}
