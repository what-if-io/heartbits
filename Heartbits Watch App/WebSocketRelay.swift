import Foundation

// ── WebSocketRelay (watchOS) ──────────────────────────────────────────────────
// Identical to Heartbits/WebSocketRelay.swift — kept as a separate file
// because the Watch target is a separate bundle.
//
// Auth: pass a Bearer token; the server validates it on the HTTP upgrade.

public actor WebSocketRelay: HeartBitRelay {
    private let url: URL
    private let token: String?
    private var socket: URLSessionWebSocketTask?
    private var handlers: [@Sendable (HeartBit) async -> Void] = []
    private var receiveTask: Task<Void, Never>?

    private nonisolated static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .formatted(iso8601Formatter)
        return e
    }()

    private nonisolated static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .formatted(iso8601Formatter)
        return d
    }()

    private nonisolated static let iso8601Formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()

    public init(url: URL, token: String? = nil) {
        self.url   = url
        self.token = token
    }

    // MARK: - HeartBitRelay

    public func send(_ heartBit: HeartBit) async throws {
        let s = ensureConnected()
        let data = try Self.encoder.encode(heartBit)
        try await s.send(.data(data))
    }

    public func subscribe(handler: @Sendable @escaping (HeartBit) async -> Void) async {
        handlers = [handler]  // replace — prevents accumulation across background/foreground cycles
        guard receiveTask == nil || receiveTask!.isCancelled else { return }
        receiveTask?.cancel()
        let s = ensureConnected()
        receiveTask = Task { [weak self] in
            await self?.receiveLoop(s)
        }
    }

    // MARK: - Private

    @discardableResult
    private func ensureConnected() -> URLSessionWebSocketTask {
        if let s = socket, s.state == .running { return s }
        var request = URLRequest(url: url)
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let s = URLSession.shared.webSocketTask(with: request)
        s.resume()
        socket = s
        return s
    }

    private func receiveLoop(_ initial: URLSessionWebSocketTask) async {
        var s = initial
        var backoff: Double = 1
        while !Task.isCancelled {
            do {
                let msg = try await s.receive()
                backoff = 1
                let data: Data
                switch msg {
                case .data(let d):    data = d
                case .string(let str): data = Data(str.utf8)
                @unknown default:    continue
                }
                guard let hb = try? Self.decoder.decode(HeartBit.self, from: data) else { continue }
                for handler in handlers { await handler(hb) }
            } catch {
                guard !Task.isCancelled else { return }
                try? await Task.sleep(for: .seconds(backoff))
                backoff = min(backoff * 2, 5)
                s = ensureConnected()
            }
        }
    }

    public nonisolated func disconnect() {
        Task { await _disconnect() }
    }

    private func _disconnect() {
        receiveTask?.cancel()
        receiveTask = nil
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
    }
}
