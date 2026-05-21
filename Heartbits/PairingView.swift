import SwiftUI
import CoreImage.CIFilterBuiltins

// ── PairingView ───────────────────────────────────────────────────────────────
//
// Three-phase flow:
//   .idle    → choose Create or Join
//   .hosting → show QR + code, wait for partner, then commit
//   .joining → enter partner's code + name, then commit
//
// Committing either way sets BondStore.isBonded = true and HeartbitsApp
// transitions to RootView with a crossfade.

struct PairingView: View {
    @State var store: BondStore

    @State private var phase: Phase = .idle
    @State private var pendingCode  = ""    // generated but not yet confirmed
    @State private var rawInput     = ""    // join: user input, raw alphanumeric
    @State private var partnerName  = ""
    @State private var heartPulse   = false
    @State private var waitingDot   = 0

    private enum Phase: Equatable {
        case idle, hosting, joining
    }

    var body: some View {
        ZStack {
            background
            content
                .animation(.easeInOut(duration: 0.38), value: phase)
        }
    }

    // MARK: - Phase content

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .idle:    idleView.id("idle")
        case .hosting: hostingView.id("hosting")
        case .joining: joiningView.id("joining")
        }
    }

    // MARK: - Idle

    private var idleView: some View {
        VStack(spacing: 0) {
            Spacer()

            Image(systemName: "heart.fill")
                .font(.system(size: 76))
                .foregroundStyle(LinearGradient.hbBrandDiag)
                .scaleEffect(heartPulse ? 1.09 : 0.93)
                .shadow(color: .hbCoral.opacity(heartPulse ? 0.5 : 0.2), radius: heartPulse ? 32 : 14)
                .onAppear {
                    withAnimation(.easeInOut(duration: 1.35).repeatForever(autoreverses: true)) {
                        heartPulse = true
                    }
                }

            Spacer().frame(height: 34)

            Text("HeartBits")
                .font(.system(size: 30, weight: .thin, design: .rounded))
                .foregroundStyle(.white)

            Text("Share your heartbeat with someone you love")
                .font(.system(size: 14, weight: .light))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 44)
                .padding(.top, 10)

            Spacer()

            VStack(spacing: 14) {
                Button {
                    pendingCode = BondStore.generateId()
                    phase = .hosting
                } label: {
                    Text("Create a Bond")
                        .hbPrimaryButton()
                }

                Button { phase = .joining } label: {
                    Text("Join with a code")
                        .hbOutlineButton()
                }
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 56)
        }
    }

    // MARK: - Hosting

    private var hostingView: some View {
        ScrollView {
            VStack(spacing: 0) {
                backButton { phase = .idle }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 24)
                    .padding(.top, 56)

                Spacer().frame(height: 28)

                Text("Your bond code")
                    .font(.system(size: 24, weight: .thin, design: .rounded))
                    .foregroundStyle(.white)

                Text("Share this with your partner")
                    .font(.system(size: 13, weight: .light))
                    .foregroundStyle(.secondary)
                    .padding(.top, 6)

                Spacer().frame(height: 32)

                // Gradient QR code
                QRCodeView(content: "heartbits://bond/\(pendingCode)")
                    .frame(width: 196, height: 196)
                    .background(Color.hbBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(LinearGradient.hbBrandDiag, lineWidth: 1.5)
                    )
                    .shadow(color: .hbPurple.opacity(0.35), radius: 28)

                Spacer().frame(height: 28)

                // Large gradient code
                Text(BondStore.display(pendingCode))
                    .font(.system(size: 38, weight: .ultraLight, design: .monospaced))
                    .foregroundStyle(LinearGradient.hbBrandDiag)
                    .onTapGesture { UIPasteboard.general.string = pendingCode }

                Text("tap to copy")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 3)

                Spacer().frame(height: 32)

                // Share sheet
                ShareLink(
                    item: "Join me on HeartBits!\n\nCode: \(BondStore.display(pendingCode))",
                    preview: SharePreview("HeartBits Bond Code", image: Image(systemName: "heart.fill"))
                ) {
                    Label("Share Code", systemImage: "square.and.arrow.up")
                        .hbPrimaryButton()
                }
                .padding(.horizontal, 28)

                // Waiting dots
                HStack(spacing: 7) {
                    ForEach(0..<3) { i in
                        Circle()
                            .fill(i == waitingDot ? Color.hbCoral : Color.white.opacity(0.2))
                            .frame(width: 5, height: 5)
                            .animation(.easeInOut(duration: 0.2), value: waitingDot)
                    }
                    Text("Waiting for partner")
                        .font(.system(size: 12, weight: .light))
                        .foregroundStyle(.tertiary)
                }
                .padding(.top, 18)
                .task {
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .milliseconds(520))
                        waitingDot = (waitingDot + 1) % 3
                    }
                }

                Spacer().frame(height: 28)

                // Confirm — makes the bond live
                Button {
                    store.confirm(pendingCode)
                } label: {
                    Text("We're connected →")
                        .hbPrimaryButton()
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 52)
            }
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Joining

    private var joiningView: some View {
        VStack(spacing: 0) {
            backButton { phase = .idle }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 56)

            Spacer()

            Image(systemName: "heart.fill")
                .font(.system(size: 52))
                .foregroundStyle(LinearGradient.hbBrandDiag)

            Spacer().frame(height: 22)

            Text("Join a bond")
                .font(.system(size: 24, weight: .thin, design: .rounded))
                .foregroundStyle(.white)

            Text("Enter the code your partner shared")
                .font(.system(size: 13, weight: .light))
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            Spacer().frame(height: 36)

            // Code field — auto-uppercase, formats as XXXX·XXXX
            TextField("ABCD·EFGH", text: codeInputBinding)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .keyboardType(.asciiCapable)
                .font(.system(size: 34, weight: .ultraLight, design: .monospaced))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .frame(height: 64)
                .background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(
                            rawInput.count == 8
                                ? LinearGradient.hbBrandDiag
                                : LinearGradient(colors: [.white.opacity(0.1),.white.opacity(0.1)], startPoint: .leading, endPoint: .trailing),
                            lineWidth: 1.5
                        )
                )
                .padding(.horizontal, 28)

            Spacer().frame(height: 14)

            // Partner name
            TextField("Partner's name (optional)", text: $partnerName)
                .font(.system(size: 15, weight: .light))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .frame(height: 50)
                .background(Color.white.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
                .padding(.horizontal, 28)

            Spacer()

            Button {
                store.join(code: rawInput, partnerName: partnerName)
            } label: {
                Text("Connect")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background {
                        Capsule().fill(LinearGradient.hbBrandDiag).opacity(rawInput.count == 8 ? 1 : 0)
                        Capsule().fill(Color.white.opacity(0.12)).opacity(rawInput.count == 8 ? 0 : 1)
                    }
                    .animation(.easeInOut(duration: 0.25), value: rawInput.count == 8)
            }
            .disabled(rawInput.count < 8)
            .padding(.horizontal, 28)
            .padding(.bottom, 52)
        }
    }

    // MARK: - Background

    private var background: some View {
        ZStack {
            Color.hbBackground.ignoresSafeArea()
            RadialGradient(
                colors: [
                    (phase == .hosting ? Color.hbCoral : Color.hbPurple).opacity(0.20),
                    .clear
                ],
                center: .init(x: 0.5, y: 0.25),
                startRadius: 0, endRadius: 380
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 0.6), value: phase)
        }
    }

    // MARK: - Helpers

    private var codeInputBinding: Binding<String> {
        Binding(
            get: {
                let s = rawInput.prefix(8).description
                return s.count > 4 ? "\(s.prefix(4))·\(s.dropFirst(4))" : s
            },
            set: { new in
                rawInput = String(
                    new.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8)
                )
            }
        )
    }

    @ViewBuilder
    private func backButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                Text("Back")
                    .font(.system(size: 16))
            }
            .foregroundStyle(.secondary)
        }
    }
}

// MARK: - QR Code

private struct QRCodeView: View {
    let content: String

    var body: some View {
        if let img = makeQR() {
            LinearGradient.hbBrandDiag
                .mask(
                    Image(uiImage: img)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                )
        }
    }

    private func makeQR() -> UIImage? {
        let ctx = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(content.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cg = ctx.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

// MARK: - Button style helpers

private extension View {
    func hbPrimaryButton() -> some View {
        self
            .font(.system(size: 17, weight: .medium))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(LinearGradient.hbBrandDiag)
            .clipShape(Capsule())
    }

    func hbOutlineButton() -> some View {
        self
            .font(.system(size: 17, weight: .regular))
            .foregroundStyle(.white.opacity(0.75))
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .overlay(Capsule().stroke(Color.white.opacity(0.18), lineWidth: 1))
    }
}

#Preview("Idle") {
    PairingView(store: BondStore())
        .preferredColorScheme(.dark)
}

#Preview("Hosting") {
    let v = PairingView(store: BondStore())
    // Can't easily preview hosting phase from outside — run the app
    return v.preferredColorScheme(.dark)
}
