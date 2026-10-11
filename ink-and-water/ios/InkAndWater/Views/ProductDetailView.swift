import SwiftUI

struct ProductDetailView: View {
    let product: Product
    let model: MakeItRealModel

    @State private var showsCheckout = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                TabView {
                    ForEach(product.images, id: \.self) { url in
                        AsyncImage(url: url) { phase in
                            if case let .success(image) = phase {
                                image.resizable().scaledToFill()
                            } else {
                                Rectangle().fill(Color(.tertiarySystemFill)).overlay(ProgressView())
                            }
                        }
                    }
                }
                .tabViewStyle(.page)
                .indexViewStyle(.page(backgroundDisplayMode: .always))
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .accessibilityLabel("Photos of your \(product.name.lowercased())")

                VStack(alignment: .leading, spacing: 8) {
                    Text(product.title)
                        .font(.title2.weight(.semibold))
                        .fontDesign(.serif)
                    if let detail = product.detail {
                        Text(detail).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Text(product.price.formatted)
                        .font(.title3.weight(.semibold))
                        .padding(.top, 4)
                }

                if let maker = product.maker {
                    Label {
                        Text("Made by hand by **\(maker)**, an independent maker on Arcade")
                    } icon: {
                        Image(systemName: "hands.and.sparkles")
                    }
                    .font(.subheadline)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(.secondarySystemGroupedBackground)))
                }

                Text(product.description)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .padding(20)
            .padding(.bottom, 80)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(product.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarRole(.editor)
        .safeAreaInset(edge: .bottom) {
            Button {
                showsCheckout = true
            } label: {
                Text("Buy · \(product.price.formatted)")
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
        .sheet(isPresented: $showsCheckout) {
            DemoCheckoutSheet(product: product, model: model)
        }
    }
}

/// A checkout that looks and feels real but never charges: the server
/// simulates the order so nothing can be bought by accident in a demo.
struct DemoCheckoutSheet: View {
    let product: Product
    let model: MakeItRealModel

    @Environment(\.dismiss) private var dismiss
    @State private var state: CheckoutState = .reviewing

    enum CheckoutState: Equatable {
        case reviewing, placing, placed(Order), failed(String)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                if case let .placed(order) = state {
                    confirmation(order)
                } else {
                    review
                }
            }
            .padding(20)
            .navigationTitle(state.isPlaced ? "" : "Checkout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(state.isPlaced ? "Done" : "Cancel") { dismiss() }
                }
            }
            .animation(.smooth, value: state)
        }
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(28)
        .sensoryFeedback(.success, trigger: state.isPlaced)
    }

    private var review: some View {
        VStack(spacing: 16) {
            HStack(spacing: 14) {
                AsyncImage(url: product.images.first) { phase in
                    if case let .success(image) = phase { image.resizable().scaledToFill() }
                    else { Color(.tertiarySystemFill) }
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.title).font(.headline).lineLimit(2)
                    if let detail = product.detail { Text(detail).font(.footnote).foregroundStyle(.secondary) }
                }
                Spacer()
            }

            VStack(spacing: 10) {
                line("Subtotal", product.price.formatted)
                line("Shipping", "Calculated by Arcade")
                Divider()
                line("Total", product.price.formatted, emphasized: true)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(.secondarySystemGroupedBackground)))

            if case let .failed(message) = state {
                Text(message).font(.footnote).foregroundStyle(.red)
            }

            Spacer(minLength: 0)

            Button {
                Task { await place() }
            } label: {
                HStack {
                    if state == .placing { ProgressView().tint(.white) }
                    Text(state == .placing ? "Placing Order…" : "Place Demo Order")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .tint(.primary)
            .foregroundStyle(Color(.systemBackground))
            .disabled(state == .placing)

            Label("Demo checkout. You won't be charged and nothing ships.", systemImage: "info.circle")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func confirmation(_ order: Order) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
                .symbolEffect(.bounce, value: order.orderNumber)
            Text("Your piece is being made")
                .font(.title2.weight(.semibold))
                .fontDesign(.serif)
            Text("Order \(order.orderNumber)")
                .font(.headline.monospacedDigit())
            Text(order.estimatedShip)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text(order.status)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func line(_ title: String, _ value: String, emphasized: Bool = false) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).foregroundStyle(emphasized ? .primary : .secondary)
        }
        .font(emphasized ? .headline : .subheadline)
    }

    private func place() async {
        state = .placing
        do {
            state = .placed(try await model.checkout(product))
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

private extension DemoCheckoutSheet.CheckoutState {
    var isPlaced: Bool {
        if case .placed = self { return true }
        return false
    }
}
