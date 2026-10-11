import Observation
import SwiftUI
import simd

enum Tool: String, CaseIterable, Identifiable {
    case drop, swirl, comb

    var id: String { rawValue }

    var title: String {
        switch self {
        case .drop: "Drop"
        case .swirl: "Swirl"
        case .comb: "Comb"
        }
    }

    var symbol: String {
        switch self {
        case .drop: "drop.fill"
        case .swirl: "hurricane"
        case .comb: "line.3.horizontal"
        }
    }

    var hint: String {
        switch self {
        case .drop: "Tap to float ink. Hold to let it spread."
        case .swirl: "Drag through the water to pull the ink."
        case .comb: "Drag across the tray to comb every color at once."
        }
    }
}

/// Everything happening in the tray. Tools turn touches into marbling operations.
@Observable
final class StudioModel {
    private(set) var ops: [MarbleOp] = []
    private var history: [Int] = []

    var palette: InkPalette = InkPalette.all[0]
    var inkIndex = 0
    var tool: Tool = .drop
    var title = "Untitled No. 1"

    /// While combing, where the drag started and where the finger is now.
    private(set) var combGuide: (start: SIMD2<Float>, end: SIMD2<Float>)?
    /// Bumped whenever a touch should be felt.
    private(set) var hapticTick = 0
    private(set) var isComposing = false

    static let maxOps = 700
    var canUndo: Bool { !history.isEmpty && !isComposing }
    var isEmpty: Bool { ops.isEmpty }
    var isFull: Bool { ops.count >= Self.maxOps }

    private var pressing = false
    private var lastPoint: SIMD2<Float>?
    /// Bumped by undo and clear so in-flight drops stop growing.
    private var growthEpoch = 0
    private var composing: Task<Void, Never>?

    // MARK: Touches, in tray coordinates from 0 to 1

    func touchBegan(at point: SIMD2<Float>) {
        guard !isComposing, !isFull else { return }
        pressing = true
        lastPoint = point
        history.append(ops.count)
        switch tool {
        case .drop:
            dropInk(at: point)
        case .swirl:
            break
        case .comb:
            combGuide = (point, point)
        }
    }

    func touchMoved(to point: SIMD2<Float>) {
        guard pressing else { return }
        switch tool {
        case .drop:
            break
        case .swirl:
            guard let last = lastPoint, simd_distance(last, point) > 0.012, !isFull else { return }
            ops.append(.swirl(from: last, to: point, reach: 0.06))
            lastPoint = point
        case .comb:
            if let guide = combGuide { combGuide = (guide.start, point) }
        }
    }

    func touchEnded(at point: SIMD2<Float>) {
        guard pressing else { return }
        pressing = false
        defer { lastPoint = nil }
        switch tool {
        case .drop:
            hapticTick += 1
        case .swirl:
            if let start = history.last, start == ops.count { history.removeLast() }
        case .comb:
            defer { combGuide = nil }
            guard let start = combGuide?.start else { return }
            let drag = point - start
            let length = simd_length(drag)
            guard length > 0.04 else {
                history.removeLast()
                return
            }
            pull(Marbling.comb(direction: drag, strength: 0), to: min(max(length * 0.3, 0.03), 0.17))
            hapticTick += 1
        }
    }

    // MARK: Editing

    func undo() {
        guard canUndo, let count = history.popLast() else { return }
        growthEpoch += 1
        withAnimation(.smooth(duration: 0.25)) {
            ops.removeSubrange(count...)
        }
    }

    func clear() {
        growthEpoch += 1
        composing?.cancel()
        isComposing = false
        ops = []
        history = []
    }

    /// Fills the tray with a classic composition, step by step, so it can be watched.
    func compose(seed: UInt64 = UInt64.random(in: 1...UInt64.max)) {
        clear()
        isComposing = true
        composing = Task { @MainActor [weak self] in
            var random = SeededRandom(seed: seed)
            guard let self else { return }
            let inkCount = palette.inks.count
            for i in 0..<70 {
                if Task.isCancelled { return }
                let center = SIMD2<Float>(Float.random(in: 0.12...0.88, using: &random), Float.random(in: 0.12...0.88, using: &random))
                let radius = Float.random(in: 0.035...0.085, using: &random)
                for step in 1...6 {
                    let r = radius * Float(step) / 6
                    if step == 1 { ops.append(.drop(center: center, radius: r, ink: i % inkCount)) }
                    else { ops[ops.count - 1] = .drop(center: center, radius: r, ink: i % inkCount) }
                    try? await Task.sleep(for: .milliseconds(6))
                }
            }
            let angle = Float.random(in: 0...(2 * .pi), using: &random)
            let first = SIMD2<Float>(cos(angle), sin(angle))
            await animatePull(Marbling.comb(direction: first, strength: 0, spacing: 0.06), to: 0.22, duration: 0.7)
            await animatePull(Marbling.comb(direction: -first, strength: 0, spacing: 0.06), to: 0.2, duration: 0.7)
            await animatePull(Marbling.comb(direction: SIMD2(-first.y, first.x), strength: 0, spacing: 0.11), to: 0.12, duration: 0.6)
            history = [0]
            isComposing = false
            hapticTick += 1
        }
    }

    // MARK: Private

    /// A drop lands fast, then keeps spreading slowly for as long as it's held.
    /// Every drop finishes landing; only undo or clearing the tray (a new epoch) stops it.
    private func dropInk(at point: SIMD2<Float>) {
        let index = ops.count
        let ink = inkIndex
        let epoch = growthEpoch
        ops.append(.drop(center: point, radius: 0.012, ink: ink))
        Task { @MainActor [weak self] in
            var radius: Float = 0.012
            let settled: Float = 0.055
            while let self, epoch == growthEpoch, radius < 0.2, index < ops.count {
                let holding = pressing && index == ops.count - 1
                if radius >= settled && !holding { break }
                radius += radius < settled ? (settled - radius) * 0.22 + 0.0008 : 0.0011
                ops[index] = .drop(center: point, radius: radius, ink: ink)
                try? await Task.sleep(for: .milliseconds(16))
            }
        }
    }

    private func pull(_ comb: [MarbleOp], to strength: Float) {
        Task { @MainActor in await animatePull(comb, to: strength, duration: 0.5) }
    }

    /// Adds comb tines at zero strength and eases them to full strength.
    private func animatePull(_ comb: [MarbleOp], to strength: Float, duration: Double) async {
        let first = ops.count
        ops.append(contentsOf: comb)
        let frames = max(Int(duration * 60), 1)
        for frame in 1...frames {
            let t = Float(frame) / Float(frames)
            let eased = 1 - pow(1 - t, 3)
            for i in first..<min(first + comb.count, ops.count) {
                if case let .comb(origin, direction, _, sharpness, spacing) = ops[i] {
                    ops[i] = .comb(origin: origin, direction: direction, strength: strength * eased, sharpness: sharpness, spacing: spacing)
                }
            }
            try? await Task.sleep(for: .milliseconds(16))
        }
    }
}

/// Repeatable randomness for compositions.
struct SeededRandom: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 0x9E3779B97F4A7C15 : seed }
    mutating func next() -> UInt64 {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return state
    }
}
