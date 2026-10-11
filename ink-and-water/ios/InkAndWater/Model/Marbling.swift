import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import simd

/// One thing that happened to the water, in tray coordinates from 0 to 1.
/// The picture is never stored: each pixel walks these operations backwards
/// to find which ink it came from (Jaffer, "Mathematical Marbling").
enum MarbleOp: Hashable {
    /// Ink dropped on the surface, pushing everything around it outward.
    case drop(center: SIMD2<Float>, radius: Float, ink: Int)
    /// One tine of a comb dragged straight across the whole tray.
    case tine(origin: SIMD2<Float>, direction: SIMD2<Float>, strength: Float, sharpness: Float)
    /// A short finger stroke that pulls nearby ink along with it.
    case swirl(from: SIMD2<Float>, to: SIMD2<Float>, reach: Float)
    /// A marbler's comb: evenly spaced tines dragged along `direction` across the
    /// whole tray. Each point feels only its nearest tine; midpoints stay put.
    case comb(origin: SIMD2<Float>, direction: SIMD2<Float>, strength: Float, sharpness: Float, spacing: Float)

    /// Floats per operation in the shader buffer.
    static let stride = 8

    var encoded: [Float] {
        switch self {
        case let .drop(c, r, ink):
            return [0, c.x, c.y, r, Float(ink), 0, 0, 0]
        case let .tine(o, m, strength, sharpness):
            return [1, o.x, o.y, m.x, m.y, strength, sharpness, 0]
        case let .swirl(a, b, reach):
            return [2, a.x, a.y, b.x, b.y, reach, 0, 0]
        case let .comb(o, m, strength, sharpness, spacing):
            return [3, o.x, o.y, m.x, m.y, strength, sharpness, spacing]
        }
    }
}

enum Marbling {
    /// The shader buffer for a list of operations. Never empty, because an
    /// empty float array can't be bound; kind 9 is skipped by the shader.
    static func encode(_ ops: [MarbleOp]) -> [Float] {
        ops.isEmpty ? [9, 0, 0, 0, 0, 0, 0, 0] : ops.flatMap(\.encoded)
    }

    /// Which ink ends up at `point`, or nil for bare paper. Mirrors Marbling.metal.
    static func ink(at point: SIMD2<Float>, ops: [MarbleOp]) -> Int? {
        var p = point
        for op in ops.reversed() {
            switch op {
            case let .drop(c, r, ink):
                let d = p - c
                let d2 = simd_length_squared(d)
                let r2 = r * r
                if d2 < r2 { return ink }
                p = c + d * (1 - r2 / d2).squareRoot()
            case let .tine(o, m, strength, sharpness):
                let n = SIMD2<Float>(-m.y, m.x)
                let dist = abs(simd_dot(p - o, n))
                p -= m * (strength * sharpness / (dist + sharpness))
            case let .swirl(a, b, reach):
                let ab = b - a
                let t = simd_clamp(simd_dot(p - a, ab) / max(simd_length_squared(ab), 1e-8), 0, 1)
                let q = a + ab * t
                p -= ab * exp(-simd_length_squared(p - q) / (reach * reach))
            case let .comb(o, m, strength, lambda, spacing):
                let n = SIMD2<Float>(-m.y, m.x)
                let offset = simd_dot(p - o, n) / spacing
                let dn = abs(offset - (offset + 0.5).rounded(.down)) * spacing
                let edge = lambda / (0.5 * spacing + lambda)
                p -= m * (strength * (lambda / (dn + lambda) - edge) / (1 - edge))
            }
        }
        return nil
    }

    /// Renders the tray as a square image, on all cores.
    static func render(_ ops: [MarbleOp], palette: InkPalette, size: Int = 1024) -> CGImage? {
        let bytesPerRow = size * 4
        var pixels = [UInt8](repeating: 255, count: bytesPerRow * size)
        let paper = palette.paper.bytes
        let inks = palette.inks.map(\.bytes)
        pixels.withUnsafeMutableBufferPointer { buffer in
            let base = buffer.baseAddress!
            DispatchQueue.concurrentPerform(iterations: size) { row in
                for column in 0..<size {
                    let point = SIMD2<Float>((Float(column) + 0.5) / Float(size), (Float(row) + 0.5) / Float(size))
                    let color = ink(at: point, ops: ops).map { inks[$0 % inks.count] } ?? paper
                    let at = row * bytesPerRow + column * 4
                    base[at] = color.0
                    base[at + 1] = color.1
                    base[at + 2] = color.2
                }
            }
        }
        guard let provider = CGDataProvider(data: Data(pixels) as CFData) else { return nil }
        return CGImage(
            width: size, height: size, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: bytesPerRow,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
        )
    }

    static func pngData(_ image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    /// A marbler's comb dragged along `direction` across the whole tray.
    static func comb(direction: SIMD2<Float>, strength: Float, spacing: Float = 0.07) -> [MarbleOp] {
        [.comb(origin: SIMD2(0.5, 0.5), direction: simd_normalize(direction), strength: strength, sharpness: 0.012, spacing: spacing)]
    }
}
