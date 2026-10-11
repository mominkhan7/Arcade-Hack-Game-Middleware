import Foundation

/// The marbling styles Arcade can finish a piece in.
enum FinishStyle: String, CaseIterable, Identifiable {
    case nonpareil = "nonpareil-hand-marbled"
    case archival = "marbled-paper"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .nonpareil: "Nonpareil"
        case .archival: "Archival"
        }
    }

    var summary: String {
        switch self {
        case .nonpareil: "Keeps your composition and adds fine, feathered combing."
        case .archival: "Freer and painterly. The marbler reinterprets your strokes."
        }
    }
}

struct Money: Decodable, Hashable {
    let amount: String
    let currency: String

    var formatted: String {
        guard let value = Decimal(string: amount) else { return "\(amount) \(currency)" }
        return value.formatted(.currency(code: currency).precision(.fractionLength(0...2)))
    }
}

struct FinishedPiece: Decodable, Hashable {
    let status: String
    let patternId: String?
    let imageUrl: URL?
    let message: String?
}

struct Product: Decodable, Identifiable, Hashable {
    let productId: String
    let kind: String
    let name: String
    let title: String
    let detail: String?
    let maker: String?
    let price: Money
    let images: [URL]
    let description: String

    var id: String { productId }
}

struct Order: Decodable, Hashable {
    let orderNumber: String
    let status: String
    let estimatedShip: String
    let simulated: Bool
}

/// The products the app offers, in display order. The server decides the exact options.
enum ProductKind: String, CaseIterable, Identifiable {
    case scarf, pocketSquare = "pocket-square", pillow

    var id: String { rawValue }

    var name: String {
        switch self {
        case .scarf: "Silk Scarf"
        case .pocketSquare: "Pocket Square"
        case .pillow: "Linen Pillow"
        }
    }

    var symbol: String {
        switch self {
        case .scarf: "wind"
        case .pocketSquare: "square.on.square"
        case .pillow: "sofa"
        }
    }
}

struct ServiceError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private struct ErrorReply: Decodable {
    let message: String
}

/// Talks to the Ink & Water server, which holds the Arcade key.
struct ArcadeService {
    var baseURL: URL

    func createPiece(png: Data, palette: [String], style: FinishStyle, title: String) async throws -> String {
        struct Body: Encodable { let image: String; let palette: [String]; let styleId: String; let title: String }
        struct Reply: Decodable { let pieceId: String }
        let reply: Reply = try await post("api/pieces", Body(image: png.base64EncodedString(), palette: palette, styleId: style.rawValue, title: title))
        return reply.pieceId
    }

    /// Polls until Arcade finishes the piece. Arcade usually takes about a minute.
    func waitForPiece(_ id: String) async throws -> FinishedPiece {
        let started = Date()
        while true {
            let piece: FinishedPiece = try await get("api/pieces/\(id)")
            switch piece.status {
            case "succeeded": return piece
            case "failed": throw ServiceError(message: piece.message ?? "Arcade couldn't finish this piece.")
            default:
                if Date().timeIntervalSince(started) > 600 { throw ServiceError(message: "Arcade is taking longer than usual. Try again.") }
                try await Task.sleep(for: .seconds(3))
            }
        }
    }

    func makeProduct(patternId: String, kind: ProductKind) async throws -> Product {
        struct Body: Encodable { let patternId: String; let kind: String }
        return try await post("api/products", Body(patternId: patternId, kind: kind.rawValue))
    }

    /// Demo checkout: the server never charges or places a real order.
    func checkout(_ product: Product) async throws -> Order {
        struct Body: Encodable { let productId: String; let name: String; let price: [String: String] }
        return try await post("api/checkout", Body(productId: product.productId, name: product.title, price: ["amount": product.price.amount, "currency": product.price.currency]))
    }

    // MARK: Plumbing

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(URLRequest(url: baseURL.appending(path: path)))
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, _ body: B) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await send(request)
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        var request = request
        request.timeoutInterval = 120
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw ServiceError(message: "Can't reach the Ink & Water server at \(baseURL.absoluteString). Is it running?")
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ErrorReply.self, from: data))?.message
            throw ServiceError(message: message ?? "Something went wrong. Try again.")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
