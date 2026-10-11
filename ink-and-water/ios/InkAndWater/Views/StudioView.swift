import SwiftUI
import simd

struct StudioView: View {
    @Environment(StudioModel.self) private var studio
    @AppStorage("serverURL") private var serverURL = "http://localhost:8787"

    @State private var flow: MakeItRealModel?
    @State private var isPreparing = false
    @State private var showsSettings = false
    @State private var confirmsClear = false
    @State private var isTouching = false

    var body: some View {
        @Bindable var studio = studio
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    tray
                    ToolPicker(selection: $studio.tool)
                    InkPicker(palette: studio.palette, selection: $studio.inkIndex)
                        .opacity(studio.tool == .drop ? 1 : 0.35)
                        .disabled(studio.tool != .drop)
                        .animation(.smooth, value: studio.tool)
                    Text(studio.tool.hint)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .contentTransition(.opacity)
                        .animation(.smooth, value: studio.tool)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 120)
            }
            .scrollDisabled(true)
            .background(Color(.systemGroupedBackground))
            .navigationTitle($studio.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarRole(.editor)
            .toolbar { toolbar }
            .safeAreaInset(edge: .bottom) { makeItRealButton }
            .navigationDestination(item: $flow) { flow in
                MakeItRealView(model: flow)
            }
            .sheet(isPresented: $showsSettings) {
                ServerSettingsView(serverURL: $serverURL)
            }
            .confirmationDialog("Start over with clear water?", isPresented: $confirmsClear, titleVisibility: .visible) {
                Button("Clear the Tray", role: .destructive) { studio.clear() }
            }
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: studio.hapticTick)
    }

    // MARK: Tray

    private var tray: some View {
        GeometryReader { proxy in
            let side = Float(proxy.size.width)
            ZStack {
                MarbleSurface(ops: studio.ops, palette: studio.palette)
                if let guide = studio.combGuide {
                    CombGuide(start: guide.start, end: guide.end, isLight: !studio.palette.paper.isLight)
                }
                if studio.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "drop")
                            .font(.system(size: 34, weight: .light))
                            .symbolEffect(.pulse, options: .repeating)
                        Text("Tap the water to float your first drop")
                            .font(.subheadline)
                    }
                    .foregroundStyle(studio.palette.paper.isLight ? Color.black.opacity(0.45) : Color.white.opacity(0.6))
                    .allowsHitTesting(false)
                    .transition(.opacity)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if !isTouching {
                            isTouching = true
                            let start = SIMD2(Float(value.startLocation.x) / side, Float(value.startLocation.y) / side)
                            studio.touchBegan(at: start)
                        }
                        studio.touchMoved(to: SIMD2(Float(value.location.x) / side, Float(value.location.y) / side))
                    }
                    .onEnded { value in
                        isTouching = false
                        studio.touchEnded(at: SIMD2(Float(value.location.x) / side, Float(value.location.y) / side))
                    }
            )
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.black.opacity(0.06), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.12), radius: 24, y: 12)
        .animation(.smooth, value: studio.isEmpty)
        .accessibilityElement()
        .accessibilityLabel("Marbling tray")
        .accessibilityHint(studio.tool.hint)
    }

    // MARK: Chrome

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button("Undo", systemImage: "arrow.uturn.backward") { studio.undo() }
                .disabled(!studio.canUndo)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu("More", systemImage: "ellipsis.circle") {
                Picker("Palette", selection: Binding(get: { studio.palette }, set: { studio.palette = $0 })) {
                    ForEach(InkPalette.all) { palette in
                        Text(palette.name).tag(palette)
                    }
                }
                .pickerStyle(.menu)
                Button("Surprise Me", systemImage: "sparkles") { studio.compose() }
                Button("Start Over", systemImage: "trash", role: .destructive) { confirmsClear = true }
                    .disabled(studio.isEmpty)
                Divider()
                Button("Server", systemImage: "server.rack") { showsSettings = true }
            }
        }
    }

    private var makeItRealButton: some View {
        Button {
            prepare()
        } label: {
            HStack(spacing: 10) {
                if isPreparing {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "sparkles")
                }
                Text("Make It Real")
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.large)
        .disabled(studio.isEmpty || isPreparing || studio.isComposing)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.bar)
    }

    /// Renders the tray at print resolution off the main thread, then opens the flow.
    private func prepare() {
        guard let base = URL(string: serverURL) else {
            showsSettings = true
            return
        }
        isPreparing = true
        let ops = studio.ops
        let palette = studio.palette
        let title = studio.title
        Task {
            let image = await Task.detached(priority: .userInitiated) {
                Marbling.render(ops, palette: palette, size: 1024)
            }.value
            isPreparing = false
            guard let image else { return }
            flow = MakeItRealModel(artwork: image, palette: palette, title: title, service: ArcadeService(baseURL: base))
        }
    }
}

extension MakeItRealModel: Hashable {
    static func == (lhs: MakeItRealModel, rhs: MakeItRealModel) -> Bool { lhs === rhs }
    func hash(into hasher: inout Hasher) { hasher.combine(ObjectIdentifier(self)) }
}

// MARK: - Pieces

/// The dotted tines a comb will draw, shown while dragging.
private struct CombGuide: View {
    let start: SIMD2<Float>
    let end: SIMD2<Float>
    let isLight: Bool

    var body: some View {
        Canvas { context, size in
            let drag = end - start
            guard simd_length(drag) > 0.01 else { return }
            let m = simd_normalize(drag)
            let n = SIMD2<Float>(-m.y, m.x)
            let side = Float(size.width)
            var path = Path()
            for offset in stride(from: Float(-0.75), through: 0.75, by: 0.07) {
                let a = (SIMD2<Float>(0.5, 0.5) + n * offset - m) * side
                let b = (SIMD2<Float>(0.5, 0.5) + n * offset + m) * side
                path.move(to: CGPoint(x: CGFloat(a.x), y: CGFloat(a.y)))
                path.addLine(to: CGPoint(x: CGFloat(b.x), y: CGFloat(b.y)))
            }
            let color: Color = isLight ? .white.opacity(0.5) : .black.opacity(0.25)
            context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: 1, dash: [2, 5]))
            var arrow = Path()
            arrow.move(to: CGPoint(x: CGFloat(start.x * side), y: CGFloat(start.y * side)))
            arrow.addLine(to: CGPoint(x: CGFloat(end.x * side), y: CGFloat(end.y * side)))
            context.stroke(arrow, with: .color(color.opacity(2)), style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
        .allowsHitTesting(false)
    }
}

private struct ToolPicker: View {
    @Binding var selection: Tool
    @Namespace private var highlight

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Tool.allCases) { tool in
                Button {
                    withAnimation(.snappy) { selection = tool }
                } label: {
                    Label(tool.title, systemImage: tool.symbol)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(selection == tool ? Color.primary : Color.secondary)
                        .background {
                            if selection == tool {
                                Capsule()
                                    .fill(.background)
                                    .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                                    .matchedGeometryEffect(id: "tool", in: highlight)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == tool ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Capsule().fill(Color(.tertiarySystemFill)))
        .sensoryFeedback(.selection, trigger: selection)
    }
}

private struct InkPicker: View {
    let palette: InkPalette
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 14) {
            ForEach(Array(palette.inkSet.enumerated()), id: \.offset) { index, ink in
                Button {
                    withAnimation(.snappy) { selection = index }
                } label: {
                    Circle()
                        .fill(ink.rgb.color.gradient)
                        .frame(width: 40, height: 40)
                        .overlay(Circle().strokeBorder(.black.opacity(0.1), lineWidth: 1))
                        .padding(4)
                        .overlay {
                            Circle()
                                .strokeBorder(Color.primary, lineWidth: 2)
                                .opacity(selection == index ? 1 : 0)
                        }
                        .scaleEffect(selection == index ? 1.08 : 1)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(ink.name)
                .accessibilityAddTraits(selection == index ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}

private struct ServerSettingsView: View {
    @Binding var serverURL: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Server address", text: $serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Ink & Water server")
                } footer: {
                    Text("The server holds the Arcade key and makes every Arcade request. In the Simulator, use http://localhost:8787. On a phone, use your computer's address on the same Wi-Fi.")
                }
            }
            .navigationTitle("Server")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
    }
}
