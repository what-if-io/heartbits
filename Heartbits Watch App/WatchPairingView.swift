import SwiftUI

// ── WatchPairingView ──────────────────────────────────────────────────────────
//
// Shown on the Watch until the bond arrives from the paired iPhone.
// If the Watch already has a stored bond (from a previous session) this
// view is skipped entirely — HeartbitsApp goes straight to RootView.

struct WatchPairingView: View {
    @State private var heartPulse = false
    @State private var dotIndex   = 0

    var body: some View {
        ZStack {
            Color.hbBackground.ignoresSafeArea()

            RadialGradient(
                colors: [Color.hbPurple.opacity(0.30), .clear],
                center: .center,
                startRadius: 0, endRadius: 80
            )
            .ignoresSafeArea()

            VStack(spacing: 10) {
                Image(systemName: "heart.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(LinearGradient.hbBrandDiag)
                    .scaleEffect(heartPulse ? 1.12 : 0.90)
                    .shadow(color: .hbCoral.opacity(0.45), radius: heartPulse ? 18 : 6)
                    .onAppear {
                        withAnimation(
                            .easeInOut(duration: 1.2).repeatForever(autoreverses: true)
                        ) { heartPulse = true }
                    }

                Text("Open HeartBits\non iPhone")
                    .font(.system(size: 13, weight: .light))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)

                // Pulsing dots
                HStack(spacing: 5) {
                    ForEach(0..<3) { i in
                        Circle()
                            .fill(i == dotIndex ? Color.hbCoral : Color.white.opacity(0.20))
                            .frame(width: 4, height: 4)
                            .animation(.easeInOut(duration: 0.18), value: dotIndex)
                    }
                }
                .task {
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .milliseconds(560))
                        dotIndex = (dotIndex + 1) % 3
                    }
                }
            }
        }
    }
}

#Preview {
    WatchPairingView()
}
