import Foundation
#if canImport(CoreHaptics)
import CoreHaptics
#endif
#if os(watchOS)
import WatchKit
#endif

// ── HeartBitHapticEngine ──────────────────────────────────────────────────────
//
// On iOS: CoreHaptics — precise lub-dub timing via CHHapticEngine.
// On watchOS: WKInterfaceDevice.play() — CoreHaptics reports supportsHaptics=false
//             on Watch hardware, so we use the Taptic Engine directly instead.

@MainActor
public final class HeartBitHapticEngine {

    private var isLooping = false

    public var isSupported: Bool {
        #if os(watchOS)
        return true
        #elseif canImport(CoreHaptics)
        return CHHapticEngine.capabilitiesForHardware().supportsHaptics
        #else
        return false
        #endif
    }

    public func prepare() throws {
        #if os(watchOS)
        // Nothing to prepare — WKInterfaceDevice is always ready
        #elseif canImport(CoreHaptics)
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
        #if os(watchOS)
        // S1 (lub) — sharper click
        WKInterfaceDevice.current().play(.click)
        // S2 (dub) — softer notification, offset by ~160ms
        let offset = pattern.events.dropFirst().first?.offset ?? 0.16
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(offset))
            WKInterfaceDevice.current().play(.click)
        }
        #elseif canImport(CoreHaptics)
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

    public func stop() {
        isLooping = false
        #if canImport(CoreHaptics)
        _engine = nil
        #endif
    }

    // MARK: - Private
    #if canImport(CoreHaptics) && !os(watchOS)
    private var _engine: CHHapticEngine?
    #endif
}
