import Foundation

// ── HeartBit ──────────────────────────────────────────────────────────────────
//
// The core data structure. One HeartBit = one heartbeat, encoded for transmission.
//
// A heartbeat has two measurements worth keeping:
//   bpm           — beats per minute (what HealthKit gives you directly)
//   rrIntervalMs  — milliseconds between successive R-peaks on an ECG.
//                   This is what determines the *rhythm*, not just the rate.
//                   At 72 bpm: rrIntervalMs ≈ 833ms
//                   At 90 bpm: rrIntervalMs ≈ 667ms
//
// Both are needed. BPM alone would make every heartbeat feel metronomic.
// The R-R interval captures the human irregularity — Heart Rate Variability (HRV) —
// which is what makes the haptic feel like a real person, not a metronome.
//
// In lesson/08, this struct becomes an on-chain event:
//   event HeartBitSent(address indexed sender, address indexed recipient, HeartBitData data);
// The sender's wallet signs it. The recipient's address gates who can read it.

public struct HeartBit: Sendable, Codable, Identifiable {
    public let id: UUID
    public let senderAddress: String     // wallet address (0x...) or device ID in simulation
    public let recipientAddress: String
    public let bpm: Double
    public let rrIntervalMs: Double      // milliseconds — drives haptic timing
    public let timestamp: Date

    public init(
        id: UUID = UUID(),
        senderAddress: String,
        recipientAddress: String,
        bpm: Double,
        rrIntervalMs: Double,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.senderAddress = senderAddress
        self.recipientAddress = recipientAddress
        self.bpm = bpm
        self.rrIntervalMs = rrIntervalMs
        self.timestamp = timestamp
    }

    // Derived helpers

    /// Seconds between beats. The haptic engine repeats at this interval.
    public var beatInterval: TimeInterval { rrIntervalMs / 1000.0 }

    /// A human-readable BPM label with clinical zone context.
    public var zone: String {
        switch bpm {
        case ..<50:   return "resting deeply"
        case 50..<60: return "resting"
        case 60..<80: return "calm"
        case 80..<100: return "active"
        case 100...: return "elevated"
        default:      return "unknown"
        }
    }

    /// Construct a HeartBit from BPM alone (derives rrIntervalMs).
    /// Use when HealthKit gives you rate without R-R interval.
    public static func fromBPM(
        _ bpm: Double,
        sender: String,
        recipient: String
    ) -> HeartBit {
        HeartBit(
            senderAddress: sender,
            recipientAddress: recipient,
            bpm: bpm,
            rrIntervalMs: (60.0 / bpm) * 1000.0
        )
    }
}
