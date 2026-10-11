import CoreGraphics
import Foundation
import Observation

/// Takes one finished tray from a picture on the phone to real products.
@Observable
final class MakeItRealModel {
    enum Phase: Equatable {
        case choosing
        case finishing(started: Date)
        case finished(FinishedPiece)
        case failed(String)
    }

    let artwork: CGImage
    let palette: InkPalette
    let title: String

    var style: FinishStyle = .nonpareil
    private(set) var phase: Phase = .choosing
    /// Products appear as Arcade builds them, so prices fill in one by one.
    private(set) var products: [ProductKind: Result<Product, ServiceError>] = [:]

    private let service: ArcadeService

    init(artwork: CGImage, palette: InkPalette, title: String, service: ArcadeService) {
        self.artwork = artwork
        self.palette = palette
        self.title = title
        self.service = service
    }

    var finishedImageURL: URL? {
        if case let .finished(piece) = phase { return piece.imageUrl }
        return nil
    }

    @MainActor
    func sendToMarbler() async {
        phase = .finishing(started: .now)
        products = [:]
        do {
            guard let png = Marbling.pngData(artwork) else { throw ServiceError(message: "Couldn't prepare your piece.") }
            let id = try await service.createPiece(png: png, palette: palette.hexColors, style: style, title: title)
            let piece = try await service.waitForPiece(id)
            phase = .finished(piece)
            await makeProducts(from: piece)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func retry() {
        phase = .choosing
    }

    @MainActor
    private func makeProducts(from piece: FinishedPiece) async {
        guard let patternId = piece.patternId else { return }
        await withTaskGroup(of: (ProductKind, Result<Product, ServiceError>).self) { group in
            for kind in ProductKind.allCases {
                group.addTask { [service] in
                    do { return (kind, .success(try await service.makeProduct(patternId: patternId, kind: kind))) }
                    catch { return (kind, .failure(ServiceError(message: error.localizedDescription))) }
                }
            }
            for await (kind, result) in group {
                products[kind] = result
            }
        }
    }

    func checkout(_ product: Product) async throws -> Order {
        try await service.checkout(product)
    }
}
