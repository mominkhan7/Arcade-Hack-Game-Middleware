import SwiftUI

/// An sRGB color kept as plain numbers so the shader, the exporter and
/// the Arcade request all agree on it exactly.
struct RGB: Hashable {
    var r: Float
    var g: Float
    var b: Float

    init(hex: String) {
        let value = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0
        r = Float((value >> 16) & 0xFF) / 255
        g = Float((value >> 8) & 0xFF) / 255
        b = Float(value & 0xFF) / 255
    }

    var color: Color { Color(.sRGB, red: Double(r), green: Double(g), blue: Double(b)) }

    var hex: String {
        String(format: "#%02X%02X%02X", Int((r * 255).rounded()), Int((g * 255).rounded()), Int((b * 255).rounded()))
    }

    var bytes: (UInt8, UInt8, UInt8) {
        (UInt8((r * 255).rounded()), UInt8((g * 255).rounded()), UInt8((b * 255).rounded()))
    }

    /// Perceived lightness, used to pick readable text over the paper.
    var isLight: Bool { 0.299 * r + 0.587 * g + 0.114 * b > 0.6 }
}

struct Ink: Hashable {
    let name: String
    let rgb: RGB
}

struct InkPalette: Identifiable, Hashable {
    let id: String
    let name: String
    let paper: RGB
    let inkSet: [Ink]

    var inks: [RGB] { inkSet.map(\.rgb) }

    /// Paper first, then each ink, three floats each, for the shader.
    var encoded: [Float] {
        ([paper] + inks).flatMap { [$0.r, $0.g, $0.b] }
    }

    /// Hex colors sent to Arcade so the finished piece keeps the player's palette.
    var hexColors: [String] { inks.map(\.hex) + [paper.hex] }

    init(id: String, name: String, paper: String, inks: [(String, String)]) {
        self.id = id
        self.name = name
        self.paper = RGB(hex: paper)
        self.inkSet = inks.map { Ink(name: $0.0, rgb: RGB(hex: $0.1)) }
    }

    static func == (lhs: InkPalette, rhs: InkPalette) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    static let all: [InkPalette] = [
        InkPalette(id: "harbor", name: "Harbor", paper: "#F4EFE6", inks: [
            ("Indigo", "#1F3A5F"), ("Terracotta", "#C8553D"), ("Saffron", "#E9C46A"), ("Teal", "#2A9D8F"), ("Cream", "#F7F3EA"),
        ]),
        InkPalette(id: "spice", name: "Spice Market", paper: "#FBF3E4", inks: [
            ("Madder", "#9C2F2F"), ("Turmeric", "#E39B2D"), ("Fig", "#3D2B3D"), ("Pine", "#3D5A40"), ("Linen", "#FFF8EC"),
        ]),
        InkPalette(id: "moss", name: "Moss & Pearl", paper: "#EEF0E8", inks: [
            ("Forest", "#31493C"), ("Sage", "#7A9E7E"), ("Lichen", "#B3C5A5"), ("Brass", "#C9A45C"), ("Pearl", "#FBFBF6"),
        ]),
        InkPalette(id: "rose", name: "Rose Quartz", paper: "#FAF1EF", inks: [
            ("Garnet", "#8C2F39"), ("Blush", "#E5989B"), ("Peach", "#FFCDB2"), ("Dusk", "#6D6875"), ("Petal", "#FFF6F3"),
        ]),
        InkPalette(id: "midnight", name: "Midnight Koi", paper: "#0F1626", inks: [
            ("Gold", "#E0B354"), ("Bone", "#F2E9DC"), ("Lake", "#3A6EA5"), ("Koi", "#D9643A"), ("Ink", "#0F1626"),
        ]),
    ]
}
