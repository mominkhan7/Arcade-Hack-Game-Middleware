import SwiftUI

@main
struct InkAndWaterApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @State private var hasBegun = false
    @State private var studio = StudioModel()

    var body: some View {
        ZStack {
            if hasBegun {
                StudioView()
                    .environment(studio)
                    .transition(.opacity.combined(with: .scale(scale: 1.04)))
            } else {
                WelcomeView {
                    withAnimation(.smooth(duration: 0.7)) { hasBegun = true }
                }
                .transition(.opacity)
            }
        }
    }
}
