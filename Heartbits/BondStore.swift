import Foundation
import Observation

// ── BondStore ─────────────────────────────────────────────────────────────────
//
// Persists the shared room ID that both partners connect to.
// Room ID = WebSocket path on the relay: wss://hb.what-if.io/<roomId>
//
// Flow:
//   Creator  → BondStore.generateId() → show QR → store.confirm(id) → isBonded
//   Joiner   → enter partner's code   → store.join(code:partnerName:) → isBonded
//   Watch    → receives id via WatchConnectivity → store.receivedFromPhone(...)

@Observable
@MainActor
final class BondStore {

    private(set) var roomId: String?
    private(set) var partnerName: String = ""

    var isBonded: Bool { roomId != nil }

    private enum Keys {
        static let roomId      = "hb.roomId"
        static let partnerName = "hb.partnerName"
    }

    init() {
        roomId      = UserDefaults.standard.string(forKey: Keys.roomId)
        partnerName = UserDefaults.standard.string(forKey: Keys.partnerName) ?? ""
    }

    // Called by the creator after showing the QR and partner has joined
    func confirm(_ id: String) {
        persist(roomId: id, partnerName: "")
    }

    // Called by the joiner after entering the code
    func join(code: String, partnerName name: String) {
        persist(roomId: canonicalise(code), partnerName: name)
    }

    // Called when the Watch receives a bond from the paired iPhone
    func receivedFromPhone(roomId id: String, partnerName name: String) {
        persist(roomId: id, partnerName: name)
    }

    func setPartnerName(_ name: String) {
        partnerName = name
        UserDefaults.standard.set(name, forKey: Keys.partnerName)
    }

    func unpair() {
        roomId = nil
        partnerName = ""
        UserDefaults.standard.removeObject(forKey: Keys.roomId)
        UserDefaults.standard.removeObject(forKey: Keys.partnerName)
    }

    // MARK: - Display / generation

    static func display(_ id: String) -> String {
        guard id.count >= 8 else { return id }
        return "\(id.prefix(4))·\(id.suffix(4))"
    }

    // Unambiguous charset — drop 0/O/I/1/S/5/Z/2 lookalikes
    static func generateId() -> String {
        let chars = Array("ABCDEFGHJKLMNPQRSTUVWXY3456789")
        return String((0..<8).map { _ in chars[Int.random(in: chars.indices)] })
    }

    // MARK: - Private

    private func persist(roomId id: String, partnerName name: String) {
        roomId      = id
        partnerName = name
        UserDefaults.standard.set(id,   forKey: Keys.roomId)
        UserDefaults.standard.set(name, forKey: Keys.partnerName)
    }

    private func canonicalise(_ raw: String) -> String {
        String(raw.uppercased()
               .filter { $0.isLetter || $0.isNumber }
               .prefix(8))
    }
}
