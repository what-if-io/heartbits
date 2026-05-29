import Foundation

/// Build-time relay configuration.
///
/// Override these values by setting matching keys in the scheme's environment
/// variables (Product > Scheme > Edit Scheme > Run > Arguments > Environment Variables)
/// or by adding a Secrets.xcconfig file excluded from version control.
///
/// relay.base  — WebSocket base URL, e.g. wss://relay.heartbits.what-if.io/
/// relay.token — ROOM_TOKEN shared secret (Phase 0 auth); leave empty once JWT auth lands
enum RelayConfig {
    static let base: String = {
        ProcessInfo.processInfo.environment["RELAY_BASE"]
            ?? Bundle.main.infoDictionary?["RELAY_BASE"] as? String
            ?? "wss://relay.heartbits.what-if.io/"
    }()

    static let token: String = {
        ProcessInfo.processInfo.environment["RELAY_TOKEN"]
            ?? Bundle.main.infoDictionary?["RELAY_TOKEN"] as? String
            ?? ""
    }()
}
