import Foundation

// ── HeartBitRelay ─────────────────────────────────────────────────────────────
//
// The transmission layer, as a protocol. Two implementations exist:
//
//   SimulatedRelay  — local, in-process. Used for this demo and in tests.
//   OnChainRelay    — Base L2. Implemented in lesson/08.
//                     Writes HeartBit as a signed on-chain event.
//                     Subscribes via eth_subscribe (WebSocket) for near-real-time receive.
//
// Protocol-oriented design: the ViewModel doesn't know which relay is active.
// In production you inject OnChainRelay. In tests you inject SimulatedRelay.
// In lesson/07 you'll see exactly what the Solidity side looks like.

public protocol HeartBitRelay: Sendable {
    /// Transmit a HeartBit to the recipient.
    func send(_ heartBit: HeartBit) async throws

    /// Subscribe to incoming HeartBits for this device/address.
    /// The handler is called on every received beat.
    func subscribe(handler: @Sendable @escaping (HeartBit) async -> Void) async

    /// Release any open connections. Default is a no-op (e.g. SimulatedRelay).
    nonisolated func disconnect()
}

extension HeartBitRelay {
    public nonisolated func disconnect() {}
}

// MARK: - SimulatedRelay

/// In-process relay. Connects two "partners" running in the same process.
/// Simulates ~200ms network latency (realistic for Base L2 on a good connection).
public actor SimulatedRelay: HeartBitRelay {
    private var handlers: [@Sendable (HeartBit) async -> Void] = []
    private let latency: Duration

    public init(latency: Duration = .milliseconds(200)) {
        self.latency = latency
    }

    public func send(_ heartBit: HeartBit) async throws {
        try await Task.sleep(for: latency)
        for handler in handlers {
            await handler(heartBit)
        }
    }

    public func subscribe(handler: @Sendable @escaping (HeartBit) async -> Void) async {
        handlers.append(handler)
    }
}

// MARK: - OnChainRelay (stub — see lesson/08)

// public actor OnChainRelay: HeartBitRelay {
//     private let contractAddress: String
//     private let senderPrivateKey: String
//     private let rpcURL: URL      // Base Sepolia testnet or Base mainnet
//
//     public func send(_ heartBit: HeartBit) async throws {
//         // 1. ABI-encode the HeartBit struct
//         // 2. Sign the transaction with senderPrivateKey
//         // 3. eth_sendRawTransaction → get tx hash
//         // 4. Wait for confirmation (Base: ~2s block time)
//     }
//
//     public func subscribe(handler: @escaping (HeartBit) async -> Void) async {
//         // eth_subscribe("logs", { address: contractAddress, topics: [recipientTopic] })
//         // On each log event: decode ABI → HeartBit → call handler
//     }
// }
