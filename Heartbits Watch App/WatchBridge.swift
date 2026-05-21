import Foundation
import WatchConnectivity

// ── WatchBridge (watchOS side) ────────────────────────────────────────────────
//
// Receives the bond pushed by the iPhone via WatchConnectivity.
// Delivers it to BondStore on the main actor.

@MainActor
final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()

    var onBondReceived:       (@MainActor (String, String) -> Void)?
    var onUnpairReceived:     (@MainActor () -> Void)?
    var onPartnerBeatReceived: (@MainActor (Double, Double) -> Void)?  // (bpm, rrIntervalMs)

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendHeartRate(_ bpm: Double) {
        guard WCSession.isSupported(),
              WCSession.default.activationState == .activated,
              WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["heartRate": bpm], replyHandler: nil)
    }

    // Call after setting onBondReceived — replays any context that arrived
    // before this session launched (e.g. Watch opened after iPhone paired).
    func checkExistingContext() {
        guard WCSession.isSupported() else { return }
        let ctx = WCSession.default.receivedApplicationContext
        deliver(ctx)
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession,
                             didReceiveMessage message: [String: Any]) {
        Task { @MainActor [weak self] in self?.deliver(message) }
    }

    nonisolated func session(_ session: WCSession,
                             didReceiveApplicationContext context: [String: Any]) {
        Task { @MainActor [weak self] in self?.deliver(context) }
    }

    nonisolated func session(_ session: WCSession,
                             didReceiveUserInfo userInfo: [String: Any]) {
        Task { @MainActor [weak self] in self?.deliver(userInfo) }
    }

    nonisolated func session(_ session: WCSession,
                             activationDidCompleteWith state: WCSessionActivationState,
                             error: Error?) {}

    // MARK: - Private

    private func deliver(_ dict: [String: Any]) {
        if dict["unpair"] != nil {
            onUnpairReceived?()
            return
        }
        if let bpm = dict["partnerBPM"] as? Double,
           let rr  = dict["partnerRR"]  as? Double {
            onPartnerBeatReceived?(bpm, rr)
            return
        }
        guard let roomId = dict["roomId"] as? String else { return }
        let name = dict["partnerName"] as? String ?? ""
        onBondReceived?(roomId, name)
    }
}
