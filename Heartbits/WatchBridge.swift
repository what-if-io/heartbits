import Foundation
import WatchConnectivity

// ── WatchBridge (iPhone side) ─────────────────────────────────────────────────
//
// Pushes the bond (roomId + partnerName) to the paired Apple Watch.
// Uses sendMessage when the Watch is reachable; falls back to
// updateApplicationContext so the Watch gets it on its next launch.

@MainActor
final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()

    var onHeartRateReceived: ((Double) -> Void)?

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendPartnerBeat(bpm: Double, rrIntervalMs: Double) {
        guard WCSession.isSupported(),
              WCSession.default.activationState == .activated else { return }
        let payload: [String: Any] = ["partnerBPM": bpm, "partnerRR": rrIntervalMs]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil)
        } else {
            WCSession.default.transferUserInfo(payload)
        }
    }

    func syncBond(roomId: String, partnerName: String) {
        send(["roomId": roomId, "partnerName": partnerName])
    }

    func syncUnpair() {
        send(["unpair": true])
    }

    private func send(_ payload: [String: Any]) {
        guard WCSession.isSupported(),
              WCSession.default.activationState == .activated else { return }
        // Always update context (persists for Watch next launch)
        try? WCSession.default.updateApplicationContext(payload)
        // Also send live message if Watch is reachable right now
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil)
        }
    }

    // MARK: - WCSessionDelegate (iOS requires these three)

    nonisolated func session(_ session: WCSession,
                             didReceiveMessage message: [String: Any]) {
        guard let bpm = message["heartRate"] as? Double else { return }
        Task { @MainActor [weak self] in self?.onHeartRateReceived?(bpm) }
    }

    nonisolated func session(_ session: WCSession,
                             activationDidCompleteWith state: WCSessionActivationState,
                             error: Error?) {}

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
}
