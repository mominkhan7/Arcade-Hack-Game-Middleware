import SwiftUI

struct MakeItRealView: View {
    @Bindable var model: MakeItRealModel
    @State private var openProduct: Product?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                switch model.phase {
                case .choosing:
                    choosing
                case let .finishing(started):
                    FinishingView(artwork: model.artwork, started: started)
                case .finished:
                    finished
                case let .failed(message):
                    ContentUnavailableView {
                        Label("The marbler hit a snag", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try Again") { model.retry() }
                            .buttonStyle(.borderedProminent)
                    }
                    .padding(.top, 60)
                }
            }
            .padding(20)
            .animation(.smooth(duration: 0.5), value: model.phase)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(model.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarRole(.editor)
        .navigationDestination(item: $openProduct) { product in
            ProductDetailView(product: product, model: model)
        }
        .safeAreaInset(edge: .bottom) {
            if model.phase == .choosing {
                Button {
                    Task { await model.sendToMarbler() }
                } label: {
                    Label("Send to the Marbler", systemImage: "paperplane.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.bar)
            }
        }
    }

    // MARK: Choosing a finish

    private var choosing: some View {
        VStack(alignment: .leading, spacing: 28) {
            Artwork(image: Image(decorative: model.artwork, scale: 1))
            VStack(alignment: .leading, spacing: 6) {
                Text("Choose a finish")
                    .font(.title2.weight(.semibold))
                    .fontDesign(.serif)
                Text("Arcade's marbling model turns your tray into a print-ready pattern in your colors. It takes about a minute.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            VStack(spacing: 12) {
                ForEach(FinishStyle.allCases) { style in
                    StyleCard(style: style, isSelected: model.style == style) {
                        withAnimation(.snappy) { model.style = style }
                    }
                }
            }
        }
    }

    // MARK: Finished

    @State private var showsOriginal = false

    private var finished: some View {
        VStack(alignment: .leading, spacing: 28) {
            ZStack {
                Artwork(image: Image(decorative: model.artwork, scale: 1))
                    .opacity(showsOriginal ? 1 : 0)
                RemoteArtwork(url: model.finishedImageURL)
                    .opacity(showsOriginal ? 0 : 1)
            }
            .animation(.smooth, value: showsOriginal)

            Picker("Show", selection: $showsOriginal) {
                Text("Finished").tag(false)
                Text("Your Tray").tag(true)
            }
            .pickerStyle(.segmented)

            VStack(alignment: .leading, spacing: 6) {
                Text("Have it made")
                    .font(.title2.weight(.semibold))
                    .fontDesign(.serif)
                Text("Each piece is printed and finished by hand by an independent maker, just for you.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 0) {
                ForEach(ProductKind.allCases) { kind in
                    ProductRow(kind: kind, result: model.products[kind]) { openProduct = $0 }
                    if kind != ProductKind.allCases.last { Divider().padding(.leading, 92) }
                }
            }
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color(.secondarySystemGroupedBackground)))
        }
    }
}

// MARK: - Pieces

private struct Artwork: View {
    let image: Image

    var body: some View {
        image
            .resizable()
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 20, y: 10)
            .accessibilityLabel("Your marbled piece")
    }
}

private struct RemoteArtwork: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .smooth(duration: 0.8))) { phase in
            switch phase {
            case let .success(image):
                image.resizable().transition(.opacity.combined(with: .scale(scale: 0.98)))
            default:
                Rectangle().fill(Color(.tertiarySystemFill)).overlay(ProgressView())
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 20, y: 10)
        .accessibilityLabel("Your piece, finished by Arcade")
    }
}

private struct StyleCard: View {
    let style: FinishStyle
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .contentTransition(.symbolEffect(.replace))
                VStack(alignment: .leading, spacing: 4) {
                    Text(style.title).font(.headline)
                    Text(style.summary).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: isSelected)
    }
}

/// The minute Arcade spends finishing the piece, made calm instead of a spinner.
private struct FinishingView: View {
    let artwork: CGImage
    let started: Date

    private let stages = [
        (0.0, "Preparing your inks"),
        (8.0, "Floating them on the water"),
        (22.0, "Combing the pattern"),
        (40.0, "Laying down the paper"),
        (55.0, "Lifting the print"),
    ]

    var body: some View {
        TimelineView(.animation) { context in
            let elapsed = context.date.timeIntervalSince(started)
            let stage = stages.last { $0.0 <= elapsed }?.1 ?? stages[0].1
            VStack(spacing: 28) {
                Image(decorative: artwork, scale: 1)
                    .resizable()
                    .aspectRatio(1, contentMode: .fit)
                    .saturation(0.8 + 0.2 * (0.5 + 0.5 * sin(elapsed * 1.4)))
                    .overlay {
                        LinearGradient(
                            colors: [.clear, .white.opacity(0.22), .clear],
                            startPoint: UnitPoint(x: (elapsed * 0.35).truncatingRemainder(dividingBy: 2) - 0.5, y: 0),
                            endPoint: UnitPoint(x: (elapsed * 0.35).truncatingRemainder(dividingBy: 2) + 0.1, y: 1)
                        )
                        .blendMode(.softLight)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.12), radius: 20, y: 10)
                    .scaleEffect(0.96 + 0.01 * sin(elapsed * 1.4))

                VStack(spacing: 8) {
                    Text(stage)
                        .font(.title3.weight(.semibold))
                        .fontDesign(.serif)
                        .contentTransition(.opacity)
                        .animation(.smooth, value: stage)
                    Text("Arcade is finishing your piece. This usually takes about a minute.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    ProgressView(value: min(elapsed / 65, 0.95))
                        .progressViewStyle(.linear)
                        .padding(.top, 8)
                        .padding(.horizontal, 40)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct ProductRow: View {
    let kind: ProductKind
    let result: Result<Product, ServiceError>?
    let onOpen: (Product) -> Void

    var body: some View {
        switch result {
        case let .success(product):
            Button {
                onOpen(product)
            } label: {
                row(image: product.images.first, detail: product.detail, trailing: Text(product.price.formatted).font(.headline))
            }
            .buttonStyle(.plain)
        case let .failure(error):
            row(image: nil, detail: error.message, trailing: Image(systemName: "exclamationmark.circle").foregroundStyle(.secondary))
        case nil:
            row(image: nil, detail: "Building with the maker…", trailing: ProgressView())
        }
    }

    private func row(image: URL?, detail: String?, trailing: some View) -> some View {
        HStack(spacing: 14) {
            AsyncImage(url: image) { phase in
                if case let .success(picture) = phase {
                    picture.resizable().scaledToFill()
                } else {
                    Image(systemName: kind.symbol).font(.title2).foregroundStyle(.secondary)
                }
            }
            .frame(width: 62, height: 62)
            .background(Color(.tertiarySystemFill))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(kind.name).font(.headline)
                if let detail {
                    Text(detail).font(.footnote).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            trailing
            if case .success = result {
                Image(systemName: "chevron.forward")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
