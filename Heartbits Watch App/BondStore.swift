import Foundation
import Observation

// ── BondStore (watchOS) ───────────────────────────────────────────────────────
// Identical to Heartbits/BondStore.swift — separate file because the Watch
// target is a separate bundle. Bond is delivered via WatchBridge.

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

    func confirm(_ id: String) {
        persist(roomId: id, partnerName: "")
    }

    func join(code: String, partnerName name: String) {
        persist(roomId: canonicalise(code), partnerName: name)
    }

    func receivedFromPhone(roomId id: String, partnerName name: String) {
        persist(roomId: id, partnerName: name)
    }

    func unpair() {
        roomId = nil
        partnerName = ""
        UserDefaults.standard.removeObject(forKey: Keys.roomId)
        UserDefaults.standard.removeObject(forKey: Keys.partnerName)
    }

    static func display(_ id: String) -> String {
        guard id.count >= 8 else { return id }
        return "\(id.prefix(4))·\(id.suffix(4))"
    }

    static func generateId() -> String {
        let chars = Array("ABCDEFGHJKLMNPQRSTUVWXY3456789")
        return String((0..<8).map { _ in chars[Int.random(in: chars.indices)] })
    }

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
