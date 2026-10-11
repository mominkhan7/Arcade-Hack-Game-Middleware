import SwiftUI

/// Draws marbling operations live, on the GPU.
struct MarbleSurface: View {
    let ops: [MarbleOp]
    let palette: InkPalette

    var body: some View {
        GeometryReader { proxy in
            // Cover the view with a square tray, centered, so nothing is stretched.
            let side = max(proxy.size.width, proxy.size.height)
            Rectangle()
                .fill(palette.paper.color)
                .colorEffect(
                    ShaderLibrary.marble(
                        .float2((proxy.size.width - side) / 2, (proxy.size.height - side) / 2),
                        .float2(side, side),
                        .floatArray(Marbling.encode(ops)),
                        .floatArray(palette.encoded)
                    )
                )
        }
        .accessibilityHidden(true)
    }
}
