import SwiftUI

struct WelcomeView: View {
    var onBegin: () -> Void

    @State private var water = StudioModel()
    @State private var showsText = false

    var body: some View {
        ZStack(alignment: .bottom) {
            MarbleSurface(ops: water.ops, palette: water.palette)
                .ignoresSafeArea()

            LinearGradient(
                colors: [.clear, .black.opacity(0.35), .black.opacity(0.75)],
                startPoint: .center, endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: 14) {
                Text("Ink & Water")
                    .font(.system(size: 52, weight: .semibold, design: .serif))
                    .accessibilityAddTraits(.isHeader)
                Text("Float ink on water and comb it into a pattern that's yours alone. Then have it made into silk, by hand.")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: onBegin) {
                    Text("Begin")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .tint(.white)
                .foregroundStyle(.black)
                .padding(.top, 12)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 28)
            .padding(.bottom, 24)
            .opacity(showsText ? 1 : 0)
            .offset(y: showsText ? 0 : 24)
        }
        .onAppear {
            water.palette = InkPalette.all[0]
            water.compose(seed: 2_026)
            withAnimation(.smooth(duration: 1.2).delay(0.4)) { showsText = true }
        }
    }
}
