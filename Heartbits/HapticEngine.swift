import Foundation

// CoreHaptics is available on watchOS 6+, iOS 13+, macOS 10.15+.
// The conditional import lets this file compile in any scheme/destination
// without project configuration errors.
#if canImport(CoreHaptics)
import CoreHaptics
#endif

// ── HeartBitHapticEngine ──────────────────────────────────────────────────────
//
// Drives CoreHaptics on watchOS 6+ to play a looping heartbeat pattern.
//
// CoreHaptics gives us two types of events:
//   .hapticTransient  — a single impulse (what we use for lub and dub)
//   .hapticContinuous — a sustained vibration (not used here)
//
// Parameters per event:
//   .hapticIntensity  — how strong (0.0–1.0)
//   .hapticSharpness  — texture: 0.0 feels like a thud, 1.0 feels like a click
//                       S1 (lub) is sharper; S2 (dub) is softer
//
// The engine must be prepared before first use and can be stopped/restarted.
// On watchOS, the system may stop the engine when the display goes to sleep —
// the `stoppedHandler` restarts it for always-on display support.

@MainActor
public final class HeartBitHapticEngine {
    
    private var isLooping = false

    public var isSupported: Bool {
        #if canImport(CoreHaptics)
        return CHHapticEngine.capabilitiesForHardware().supportsHaptics
        #else
        return false
        #endif
    }

    public func prepare() throws {
        #if canImport(CoreHaptics)
        guard isSupported else { return }
        let engine = try CHHapticEngine()
        engine.stoppedHandler = { [weak self] _ in
            Task { @MainActor in try? self?._engine?.start() }
        }
        engine.resetHandler = { [weak self] in
            Task { @MainActor in try? self?._engine?.start() }
        }
        try engine.start()
        _engine = engine
        #endif
    }

    /// Play a single heartbeat pattern (one lub-dub cycle).
    public func play(_ pattern: HapticPattern) throws {
        #if canImport(CoreHaptics)
        guard let engine = _engine, isSupported else { return }

        let events = pattern.events.map { event in
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: event.intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: event.sharpness)
                ],
                relativeTime: event.offset
            )
        }
        let hapticPattern = try CHHapticPattern(events: events, parameters: [])
        let player = try engine.makePlayer(with: hapticPattern)
        try player.start(atTime: CHHapticTimeImmediate)
        #endif
    }

    /// Loop a heartbeat pattern continuously at the correct BPM. Call stop() to end.
    public func startLoop(_ pattern: HapticPattern) {
        guard isSupported else { return }
        isLooping = true
        Task { @MainActor [weak self] in
            while self?.isLooping == true {
                try? self?.play(pattern)
                try? await Task.sleep(for: .seconds(pattern.repeatInterval))
            }
        }
    }
    
    // MARK: - Private
    #if canImport(CoreHaptics)
    private var _engine: CHHapticEngine?
    #endif

    
    public func stop() {
        isLooping = false
        #if canImport(CoreHaptics)
        _engine = nil
        #endif
    }

}
