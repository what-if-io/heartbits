import SwiftUI

// ── RootView ─────────────────────────────────────────────────────────────────
//
// iOS: horizontal swipe between "My Heart" (sender) and "Their Heart" (receiver).
// visionOS: spatial receiver only — Vision Pro has no heart rate sensor.

struct RootView: View {
    var vm: HeartBitsViewModel
    var store: BondStore

    var body: some View {
        #if os(visionOS)
        VisionFeelView(vm: vm)
        #else
        iOSRootView(vm: vm, store: store)
        #endif
    }
}

// MARK: - iOS tab layout

private struct iOSRootView: View {
    var vm: HeartBitsViewModel
    var store: BondStore
    @State private var selection = 0
    @State private var showSettings = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selection) {
                SendView(vm: vm)
                    .tag(0)
                FeelView(vm: vm)
                    .tag(1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            // Minimal page indicator
            HStack(spacing: 7) {
                dot(active: selection == 0)
                dot(active: selection == 1)
            }
            .padding(.bottom, 18)
            .animation(.easeInOut(duration: 0.2), value: selection)

            // Settings button — top trailing corner
            Button { showSettings = true } label: {
                Image(systemName: "person.2.circle")
                    .font(.system(size: 20))
                    .foregroundStyle(.white.opacity(0.28))
                    .padding(20)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
        .sheet(isPresented: $showSettings) {
            BondSheet(vm: vm, store: store)
                .presentationDetents([.height(320)])
                .presentationDragIndicator(.visible)
        }
    }

    private func dot(active: Bool) -> some View {
        Circle()
            .fill(active ? Color.white : Color.white.opacity(0.22))
            .frame(width: active ? 5 : 4, height: active ? 5 : 4)
    }
}

// MARK: - Bond info sheet

private struct BondSheet: View {
    var vm: HeartBitsViewModel
    var store: BondStore
    @Environment(\.dismiss) private var dismiss
    @State private var confirmingUnpair = false

    var body: some View {
        ZStack {
            Color.hbBackground.ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer().frame(height: 28)

                Image(systemName: "heart.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(LinearGradient.hbBrandDiag)

                Spacer().frame(height: 16)

                if !vm.partnerName.isEmpty {
                    Text(vm.partnerName)
                        .font(.system(size: 26, weight: .ultraLight, design: .rounded))
                        .foregroundStyle(.white)
                }

                Text(store.roomId.map { BondStore.display($0) } ?? "")
                    .font(.system(size: 15, weight: .light, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)

                Spacer().frame(height: 8)

                // Connection status pill
                HStack(spacing: 5) {
                    Circle()
                        .fill(vm.connectionState == .connected ? Color.green : Color.orange)
                        .frame(width: 5, height: 5)
                    Text(vm.connectionState == .connected ? "connected" : "connecting…")
                        .font(.system(size: 12, weight: .light))
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 32)

                Spacer()

                // Sync Watch
                Button {
                    if let roomId = store.roomId {
                        WatchBridge.shared.syncBond(roomId: roomId, partnerName: store.partnerName)
                    }
                } label: {
                    Label("Sync to Watch", systemImage: "applewatch")
                        .font(.system(size: 15))
                        .foregroundStyle(.white.opacity(0.45))
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )
                }
                .padding(.horizontal, 28)

                // Unpair
                Button {
                    confirmingUnpair = true
                } label: {
                    Text("Change partner")
                        .font(.system(size: 15))
                        .foregroundStyle(.white.opacity(0.35))
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 16)
            }
        }
        .confirmationDialog("Change partner?", isPresented: $confirmingUnpair, titleVisibility: .visible) {
            Button("Unpair", role: .destructive) {
                vm.tearDown()
                store.unpair()
                WatchBridge.shared.syncUnpair()
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You'll need to create or join a new bond.")
        }
    }
}
