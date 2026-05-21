import Foundation

// ── WebSocketRelay ────────────────────────────────────────────────────────────
//
// Live relay over a plain WebSocket.
// Both partners connect to the same room URL — the server fans every message
// out to every other client in that room.
//
// URL format:  ws://host:port/<roomId>
//   local dev  ws://localhost:8765/alice-bob
//   real LAN   ws://192.168.1.x:8765/alice-bob
//
// HeartBit is JSON-encoded (already Codable). No dependency on the server
// wire format — change the encode/decode pair here if you swap to MessagePack
// or a binary ABI later.

public actor WebSocketRelay: HeartBitRelay {
    private let url: URL
    private var socket: URLSessionWebSocketTask?
    private var handlers: [@Sendable (HeartBit) async -> Void] = []
    private var receiveTask: Task<Void, Never>?

    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()

    public init(url: URL) { self.url = url }

    // MARK: - HeartBitRelay

    public func send(_ heartBit: HeartBit) async throws {
        let s = ensureConnected()
        let data = try Self.encoder.encode(heartBit)
        try await s.send(.data(data))
    }

    public func subscribe(handler: @Sendable @escaping (HeartBit) async -> Void) async {
        handlers = [handler]
        guard receiveTask == nil else { return }
        let s = ensureConnected()
        receiveTask = Task { [weak self] in
            await self?.receiveLoop(s)
        }
    }

    // MARK: - Private

    @discardableResult
    private func ensureConnected() -> URLSessionWebSocketTask {
        if let s = socket, s.state == .running { return s }
        let s = URLSession.shared.webSocketTask(with: url)
        s.resume()
        socket = s
        return s
    }

    // Runs on the actor — suspends at each receive(), releasing the actor lock
    // so send() can interleave freely. Auto-reconnects on drop.
    private func receiveLoop(_ initial: URLSessionWebSocketTask) async {
        var s = initial
        while !Task.isCancelled {
            do {
                let msg = try await s.receive()
                let data: Data
                switch msg {
                case .data(let d):    data = d
                case .string(let str): data = Data(str.utf8)
                @unknown default:    continue
                }
                guard let hb = try? Self.decoder.decode(HeartBit.self, from: data) else { continue }
                for handler in handlers { await handler(hb) }
            } catch {
                // Disconnected — wait then reconnect
                try? await Task.sleep(for: .seconds(2))
                s = ensureConnected()
            }
        }
    }

    public func disconnect() {
        receiveTask?.cancel()
        receiveTask = nil
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
    }
}
