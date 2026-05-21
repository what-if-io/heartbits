import Foundation

// ── HapticPattern ─────────────────────────────────────────────────────────────
//
// Converts a HeartBit into a sequence of timed haptic events.
//
// A real heartbeat has two distinct sounds: S1 (lub) and S2 (dub).
//   S1 — closure of the mitral and tricuspid valves. Louder, harder, sharper.
//   S2 — closure of the aortic and pulmonary valves. Softer, slightly duller.
//   Gap between S1 and S2: ~70ms (systole, the heart contracting)
//   Gap between S2 and next S1: the R-R interval minus ~70ms (diastole, filling)
//
// Encoding this in CoreHaptics:
//   CHHapticEvent (transient) at offset 0.00s   — the LUB (intensity 0.9, sharpness 0.7)
//   CHHapticEvent (transient) at offset 0.07s   — the dub (intensity 0.6, sharpness 0.4)
//   Silence until next beat (R-R interval)
//   Repeat.
//
// The result is unmistakably a heartbeat. Not a notification buzz. A heartbeat.

public struct HapticEvent: Sendable {
    public let offset: TimeInterval    // seconds from pattern start
    public let intensity: Float        // 0.0 (silent) to 1.0 (full)
    public let sharpness: Float        // 0.0 (thud) to 1.0 (click)

    public init(offset: TimeInterval, intensity: Float, sharpness: Float) {
        self.offset = offset
        self.intensity = intensity
        self.sharpness = sharpness
    }
}

public struct HapticPattern: Sendable {
    public let events: [HapticEvent]
    public let repeatInterval: TimeInterval   // = HeartBit.beatInterval

    private static let lubDubGap: TimeInterval = 0.070   // 70ms systole gap

    public static func from(_ heartBit: HeartBit) -> HapticPattern {
        HapticPattern(
            events: [
                HapticEvent(offset: 0.000, intensity: 0.90, sharpness: 0.70),   // LUB
                HapticEvent(offset: lubDubGap, intensity: 0.60, sharpness: 0.40) // dub
            ],
            repeatInterval: heartBit.beatInterval
        )
    }

    // Simulates the full timeline of a pattern playing N times.
    // Used in the CLI demo and in tests; CoreHapticEngine uses this to schedule events.
    public func timeline(beats: Int) -> [(time: TimeInterval, event: HapticEvent)] {
        (0..<beats).flatMap { beat in
            let offset = TimeInterval(beat) * repeatInterval
            return events.map { (time: offset + $0.offset, event: $0) }
        }
    }
}
