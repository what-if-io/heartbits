import Foundation
import Observation

// ── HeartBitsViewModel ────────────────────────────────────────────────────────
//
// Drives both SenderView and ReceiverView.
// One instance per watch app session; the active role (sender/receiver) is
// determined by which partner's address this device has the private key for.
//
// HealthKit integration is added in lesson/05. For now, bpm is set manually
// or simulated — so this file compiles without the HealthKit entitlement.

@Observable
@MainActor
public final class HeartBitsViewModel {

    // MARK: - State

    /// This device's role in the current session.
    public enum Role { case sender, receiver, idle }
    public var role: Role = .idle

    /// Sender state
    public var myBPM: Double = 0
    public var isBeating: Bool = false        // drives the pulse animation
    public var isSending: Bool = false

    /// Receiver state
    public var partnerBPM: Double = 0
    public var partnerName: String = ""
    public var lastReceived: Date? = nil

    /// Shared
    public var connectionState: ConnectionState = .disconnected

    public enum ConnectionState: Equatable {
        case disconnected
        case connecting
        case connected
        case error(String)
    }

    // MARK: - Private

    private let relay: any HeartBitRelay
    private let hapticEngine = HeartBitHapticEngine()
    private var senderAddress: String
    private var recipientAddress: String

    public init(
        relay: any HeartBitRelay,
        senderAddress: String,
        recipientAddress: String
    ) {
        self.relay = relay
        self.senderAddress = senderAddress
        self.recipientAddress = recipientAddress
    }

    // MARK: - Sender API

    /// Call this when HealthKit delivers a new heart rate sample.
    /// In lesson/05 this is wired directly to an HKAnchoredObjectQuery.
    public func didReceiveHeartRate(_ bpm: Double) async {
        myBPM = bpm
        triggerBeatAnimation()

        guard isSending else { return }

        let heartBit = HeartBit.fromBPM(bpm, sender: senderAddress, recipient: recipientAddress)
        try? await relay.send(heartBit)
    }

    public func updateLocalBPM(_ bpm: Double) {
        myBPM = bpm
        triggerBeatAnimation()
    }

    public func startSending() async {
        guard !isSending else { return }
        isSending = true
        connectionState = .connecting
        try? hapticEngine.prepare()
        await relay.subscribe { [weak self] heartBit in
            await self?.didReceiveHeartBit(heartBit)
        }
        role = .sender
    }

    public func stopSending() {
        isSending = false
        connectionState = .disconnected
        role = .idle
    }

    /// Call when the app moves to background or terminates.
    /// Closes the WebSocket and stops haptics so resources are released promptly.
    public func tearDown() {
        hapticEngine.stop()
        relay.disconnect()
        isSending = false
        connectionState = .disconnected
        role = .idle
    }

    // MARK: - Receiver API

    public func startReceiving(partnerName: String) async {
        self.partnerName = partnerName
        role = .receiver
        // startSending() already opened the relay subscription; just update state
        if connectionState == .disconnected {
            connectionState = .connecting
            try? hapticEngine.prepare()
            await relay.subscribe { [weak self] heartBit in
                await self?.didReceiveHeartBit(heartBit)
            }
            connectionState = .connected
        }
    }

    // MARK: - Private

    private func didReceiveHeartBit(_ heartBit: HeartBit) {
        connectionState = .connected  // first reception confirms the relay is reachable
        partnerBPM = heartBit.bpm
        lastReceived = heartBit.timestamp
        WatchBridge.shared.sendPartnerBeat(bpm: heartBit.bpm, rrIntervalMs: heartBit.rrIntervalMs)

        let pattern = HapticPattern.from(heartBit)
        try? hapticEngine.play(pattern)
        triggerBeatAnimation()
    }

    private func triggerBeatAnimation() {
        isBeating = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(200))
            isBeating = false
        }
    }
}
