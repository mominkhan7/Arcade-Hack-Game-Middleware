import SwiftUI
import WebKit
import ShopifyCheckoutSheetKit
import CryptoKit

@main
struct CraftKitDemoApp: App {
    var body: some Scene { WindowGroup { ArcadeHome().preferredColorScheme(.dark) } }
}
struct Game: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let symbol: String
    let genre: String
    let colors: [Color]
    static let all = [
        Game(id: "relic-island", title: "Relic Island", subtitle: "A hidden island. A story worth keeping.", symbol: "sun.max.fill", genre: "EXPLORE", colors: [Color(red: 0.22, green: 0.46, blue: 0.40), Color(red: 0.035, green: 0.14, blue: 0.16)]),
        Game(id: "pattern-garden", title: "Pattern Garden", subtitle: "Become a brush of light.", symbol: "sparkles", genre: "WANDER", colors: [Color(red: 0.27, green: 0.20, blue: 0.48), Color(red: 0.045, green: 0.08, blue: 0.18)]),
        Game(id: "chess-atelier", title: "Chess Atelier", subtitle: "Every move leaves a mark.", symbol: "square.grid.3x3.fill", genre: "THE CLASSICS", colors: [Color(red: 0.52, green: 0.31, blue: 0.24), Color(red: 0.16, green: 0.11, blue: 0.13)])
    ]
}
struct CraftKitGlass: ViewModifier {
    var radius: CGFloat = 24
    func body(content: Content) -> some View {
        // glassEffect only exists in the iOS 26 SDK (Swift 6.2+); older Xcode builds use the material fallback.
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {content.glassEffect(.regular, in: RoundedRectangle(cornerRadius: radius))}
        else {content.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius))}
        #else
        content.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius))
        #endif
    }
}
struct ArcadeHome: View {
    @AppStorage("nexusServer") private var server = DemoConfiguration.server
    @AppStorage("nexusDemoToken") private var token = DemoConfiguration.token
    @State private var selected: Game?
    @State private var settings = false
    @State private var selectedTab = 0
    var body: some View {
        TabView(selection: $selectedTab) {
            ZStack {
                Color(red: 0.045, green: 0.065, blue: 0.085).ignoresSafeArea()
                RadialGradient(colors: [Color.teal.opacity(0.19), .clear], center: .topTrailing, startRadius: 20, endRadius: 550).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        HStack {
                            HStack(spacing: 9) {Image(systemName: "circle.hexagongrid.fill").font(.system(size: 23)); Text("CraftKit").font(.system(size: 25, weight: .semibold, design: .rounded)).tracking(-1)}
                            Spacer()
                            Button {settings=true} label: {Image(systemName: "slider.horizontal.3").font(.system(size: 16)).frame(width: 43,height: 43).modifier(CraftKitGlass(radius: 22))}.buttonStyle(.plain).accessibilityLabel("Demo connection")
                        }.padding(.top, 8)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("A LITTLE PLAY. SOMETHING TO KEEP.").font(.system(size: 9, weight: .semibold, design: .monospaced)).tracking(1.8).foregroundStyle(.white.opacity(0.46))
                            Text("Your play.\nOriginal art.").font(.system(size: 39, weight: .medium, design: .serif)).tracking(-1.3).lineSpacing(-1)
                            Text("Explore a world. Make your mark.\nBring a piece of the story home.").font(.system(size: 13)).foregroundStyle(.white.opacity(0.56)).lineSpacing(4)
                        }
                        HStack {Text("YOUR NEXT CHAPTER").font(.system(size: 10,weight: .semibold)).tracking(1.6).foregroundStyle(.white.opacity(0.5)); Spacer();Text("03 WORLDS").font(.system(size: 9,design: .monospaced)).foregroundStyle(.white.opacity(0.35))}.padding(.top,8)
                        ForEach(Game.all) {game in
                            Button {UIImpactFeedbackGenerator(style:.soft).impactOccurred();selected=game} label: {GameCard(game: game)}.buttonStyle(.plain).accessibilityIdentifier(game.id)
                        }
                        HStack(alignment: .top, spacing: 13) {
                            Image(systemName: "shippingbox.fill").font(.system(size: 19)).foregroundStyle(Color(red: 0.72,green: 0.85,blue: 0.76))
                            VStack(alignment: .leading, spacing: 6) {Text("Made from the way you play.").font(.system(size: 13,weight: .medium));Text("Achievements and the way you play become personal art. Choose a keepsake when you’re ready.").font(.system(size: 11)).lineSpacing(3).foregroundStyle(.white.opacity(0.5))}
                        }.padding(19).modifier(CraftKitGlass(radius: 20)).padding(.bottom, 20)
                    }.padding(.horizontal, 23)
                }
            }.tabItem {Label("Play",systemImage: "gamecontroller.fill")}.tag(0)
            LibraryScreen(server: server,token: token, destination: "offerings", screenTitle: "CraftKit").tabItem {Label("CraftKit",systemImage: "sparkles")}.tag(2)
            LibraryScreen(server: server,token: token).tabItem {Label("Keepsakes",systemImage: "square.stack.3d.up.fill")}.tag(1)
        }.tint(Color(red: 0.77,green: 0.9,blue: 0.82))
        .fullScreenCover(item: $selected) {game in GameScreen(game:game,server:server,token:token)}
        .task {
            #if DEBUG
            if CommandLine.arguments.contains("--demo-library") {selectedTab=1}
            if let i=CommandLine.arguments.firstIndex(of: "--demo-game"), CommandLine.arguments.count>i+1 {selected=Game.all.first(where: {$0.id==CommandLine.arguments[i+1]})}
            #endif
        }
        .onOpenURL {url in if ["craftkit", "nexusarcade"].contains(url.scheme ?? ""),url.host=="game",let game=Game.all.first(where: {$0.id==url.lastPathComponent}) {selected=game}}
        .sheet(isPresented: $settings) {
            NavigationStack {
                Form {
                    Section("Presenter connection") {TextField("Server URL",text: $server).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL);SecureField("Demo access token",text: $token).textInputAutocapitalization(.never).autocorrectionDisabled()}
                    Section {Text("Keep the demo server running on this Mac. The Arcade API key stays on the server.").font(.footnote)}
                }.navigationTitle("Demo connection").toolbar {ToolbarItem(placement:.confirmationAction) {Button("Done",systemImage:"checkmark") {settings=false}}}
            }.presentationDetents([.medium,.large])
        }
    }
}
struct GameCard: View {
    let game: Game
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            WorldIllustration(game:game)
            LinearGradient(colors: [.clear,.black.opacity(0.12),.black.opacity(0.78)],startPoint: .top,endPoint: .bottom)
            VStack(alignment: .leading, spacing: 7) {
                Text(game.genre).font(.system(size: 8,weight: .bold,design: .monospaced)).tracking(2).foregroundStyle(.white.opacity(0.65))
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading,spacing: 6) {Text(game.title).font(.system(size: 29,weight: .medium,design: .serif)).tracking(-0.6);Text(game.subtitle).font(.system(size: 11)).foregroundStyle(.white.opacity(0.66))}
                    Spacer()
                    Image(systemName:"arrow.up.right").font(.system(size: 16,weight: .medium)).frame(width: 42,height: 42).modifier(CraftKitGlass(radius: 22))
                }
            }.padding(22)
            VStack {HStack {Text(game.id=="chess-atelier" ? "A TIMELESS CLASSIC" : "CRAFTKIT ORIGINAL").font(.system(size: 7,weight: .semibold,design: .monospaced)).tracking(1).padding(.horizontal,11).padding(.vertical,8).modifier(CraftKitGlass(radius: 14));Spacer();Image(systemName:game.symbol).font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))};Spacer()}.padding(18)
        }.frame(height: 244).clipShape(RoundedRectangle(cornerRadius: 27)).overlay(RoundedRectangle(cornerRadius:27).stroke(.white.opacity(0.11),lineWidth:1)).contentShape(RoundedRectangle(cornerRadius:27))
    }
}
struct WorldIllustration: View {
    let game: Game
    var body: some View {
        GeometryReader {geometry in
            ZStack {
                LinearGradient(colors:game.colors,startPoint:.topLeading,endPoint:.bottomTrailing)
                Canvas {context,size in
                    let w=size.width,h=size.height
                    if game.id=="relic-island" {
                        for i in 0..<5 {let y=h*0.36+CGFloat(i)*18;var line=Path();line.move(to:CGPoint(x:0,y:y));line.addQuadCurve(to:CGPoint(x:w,y:y+13),control:CGPoint(x:w*0.5,y:y-22));context.stroke(line,with:.color(.mint.opacity(0.07)),lineWidth:1)}
                        var mountain=Path();mountain.move(to:CGPoint(x:w*0.12,y:h*0.69));mountain.addLine(to:CGPoint(x:w*0.26,y:h*0.39));mountain.addLine(to:CGPoint(x:w*0.45,y:h*0.54));mountain.addLine(to:CGPoint(x:w*0.64,y:h*0.21));mountain.addLine(to:CGPoint(x:w*0.91,y:h*0.69));mountain.closeSubpath();context.fill(mountain,with:.linearGradient(Gradient(colors:[Color(red:0.45,green:0.57,blue:0.34),Color(red:0.09,green:0.26,blue:0.19)]),startPoint:CGPoint(x:0,y:45),endPoint:CGPoint(x:0,y:180)))
                        var ridge=Path();ridge.move(to:CGPoint(x:w*0.64,y:h*0.21));ridge.addLine(to:CGPoint(x:w*0.53,y:h*0.53));ridge.addLine(to:CGPoint(x:w*0.77,y:h*0.51));ridge.closeSubpath();context.fill(ridge,with:.color(.white.opacity(0.13)))
                        let sun=CGRect(x:w*0.24,y:h*0.17,width:39,height:39);context.fill(Path(ellipseIn:sun),with:.color(Color(red:0.96,green:0.82,blue:0.50)));context.draw(Text("✧").font(.system(size:25)).foregroundColor(.yellow.opacity(0.8)),at:CGPoint(x:w*0.77,y:h*0.35))
                    } else if game.id=="pattern-garden" {
                        for i in 0..<34 {let x=CGFloat((i*71+17)%337)/337*w,y=CGFloat((i*37+11)%113)/113*h*0.73;let radius=CGFloat(i%3+1);context.fill(Path(ellipseIn:CGRect(x:x,y:y,width:radius*2,height:radius*2)),with:.color((i%2==0 ? Color.mint:Color.purple).opacity(0.48)))}
                        for i in 0..<7 {let x=CGFloat(i)*w/6;var stem=Path();stem.move(to:CGPoint(x:x,y:h));stem.addQuadCurve(to:CGPoint(x:x+12,y:h*0.28+CGFloat(i%3)*17),control:CGPoint(x:x-22,y:h*0.56));context.stroke(stem,with:.color(Color.mint.opacity(0.16)),lineWidth:2)}
                        for side in [-1.0,1.0] {var wing=Path();let x=w*0.55,y=h*0.36;wing.move(to:CGPoint(x:x,y:y));wing.addCurve(to:CGPoint(x:x,y:y+44),control1:CGPoint(x:x+side*72,y:y-65),control2:CGPoint(x:x+side*69,y:y+28));wing.closeSubpath();context.fill(wing,with:.linearGradient(Gradient(colors:[Color(red:0.62,green:0.83,blue:0.89).opacity(0.8),Color(red:0.59,green:0.39,blue:0.89).opacity(0.25)]),startPoint:CGPoint(x:x,y:y-25),endPoint:CGPoint(x:x,y:y+40)))}
                        context.fill(Path(ellipseIn:CGRect(x:w*0.55-3,y:h*0.34,width:6,height:42)),with:.color(.white.opacity(0.8)))
                    } else {
                        for row in 0..<5 {for col in 0..<8 {let x=CGFloat(col)*w/8,y=h*0.30+CGFloat(row)*25;let rect=CGRect(x:x,y:y,width:w/8,height:25);context.fill(Path(rect),with:.color((row+col)%2==0 ? .white.opacity(0.1):.black.opacity(0.08)))}}
                        context.draw(Text("♞").font(.system(size:124,weight:.regular,design:.serif)).foregroundColor(Color(red:0.91,green:0.78,blue:0.56)),at:CGPoint(x:w*0.60,y:h*0.37));context.draw(Text("♜").font(.system(size:72,design:.serif)).foregroundColor(Color(red:0.30,green:0.18,blue:0.18)),at:CGPoint(x:w*0.28,y:h*0.40))
                    }
                }
            }
        }.accessibilityHidden(true)
    }
}
struct LibraryScreen: View {
    let server: String
    let token: String
    var destination: String = "library"
    var screenTitle: String = "Keepsakes"
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Group {
                if let error {ContentUnavailableView("Connection interrupted",systemImage:"wifi.exclamationmark",description:Text(error))}
                else if var components=URLComponents(string:server) {
                    let _ = {components.path="/mobile-session";components.queryItems=[URLQueryItem(name:"game",value:destination),URLQueryItem(name:"token",value:token)]}()
                    if let url=components.url {GameWebView(url:url,error:$error)}
                }
            }.navigationTitle(screenTitle).navigationBarTitleDisplayMode(.large).background(Color(red:0.045,green:0.065,blue:0.085))
        }
    }
}
struct WorldButtonStyle: ButtonStyle {
    var ink: Color = .white
    func makeBody(configuration: ButtonStyleConfiguration) -> some View {
        configuration.label
            .foregroundStyle(ink)
            // Keep the whole target fixed while only the icon animates.
            .scaleEffect(configuration.isPressed ? 0.88 : 1)
            .frame(width: 54, height: 54)
            .contentShape(Rectangle())
            .modifier(CraftKitGlass(radius: 27))
            .brightness(configuration.isPressed ? 0.1 : 0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
struct GameScreen: View {
    let game: Game
    let server: String
    let token: String
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?
    @State private var menu = false
    @State private var action: String?
    @State private var reload = UUID()
    var url: URL? {
        guard var components = URLComponents(string: server), ["http", "https"].contains(components.scheme), components.host != nil else {return nil}
        components.path = "/mobile-session"
        components.queryItems = [URLQueryItem(name: "token", value: token), URLQueryItem(name: "game", value: game.id)]
        return components.url
    }
    func send(_ value: String) {menu=false;action=value+":"+UUID().uuidString}
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            if let error {
                ContentUnavailableView {Label("Connection interrupted", systemImage: "wifi.exclamationmark")} description: {Text(error)} actions: {Button("Retry") {self.error=nil;reload=UUID()}}
            } else if let url {
                GameWebView(url:url,error:$error,isPaused:menu,gameAction:action).id(reload).ignoresSafeArea()
            }
            HStack(spacing: 12) {
                Button {UIImpactFeedbackGenerator(style:.soft).impactOccurred();dismiss()} label: {Image(systemName:"xmark").font(.system(size:18,weight:.semibold))}.buttonStyle(WorldButtonStyle(ink:game.id=="chess-atelier" ? Color(red:0.2,green:0.16,blue:0.13) : .white)).accessibilityLabel("Return to worlds")
                Spacer(minLength: 0)
                Text(game.title).font(.system(size:17,weight:.medium,design:.serif)).padding(.horizontal,19).frame(height:45).modifier(CraftKitGlass(radius:23)).allowsHitTesting(false)
                Spacer(minLength: 0)
                Button {UIImpactFeedbackGenerator(style:.soft).impactOccurred();menu=true} label: {Image(systemName:"ellipsis").font(.system(size:20,weight:.semibold))}.buttonStyle(WorldButtonStyle(ink:game.id=="chess-atelier" ? Color(red:0.2,green:0.16,blue:0.13) : .white)).accessibilityLabel("World menu")
            }.padding(.horizontal,17).padding(.top,8).zIndex(10)
            .foregroundStyle(game.id=="chess-atelier" ? Color(red:0.2,green:0.16,blue:0.13) : .white)
        }
        .preferredColorScheme(game.id=="chess-atelier" ? .light : .dark)
        .sheet(isPresented:$menu) {
            VStack(alignment:.leading,spacing:22) {
                HStack {Text("TAKE A BREATH").font(.system(size:10,weight:.semibold)).tracking(2).foregroundStyle(.secondary);Spacer();Image(systemName:game.symbol).foregroundStyle(.mint)}
                Text(game.title).font(.system(size:35,weight:.medium,design:.serif))
                Text(game.id=="chess-atelier" ? "Tap a piece, then a highlighted square. White moves first. Your match is saved as you play." : "Move with your left thumb. Your right thumb is for actions."+(game.id=="pattern-garden" ? " Drag the forest to look around. Your flight paints the artwork." : " Follow the golden light, then repeat the echo to wake the shrine.")).font(.system(size:16)).foregroundStyle(.secondary).lineSpacing(4)
                VStack(spacing:12) {
                    Button {menu=false} label:{Label("Keep playing",systemImage:"play.fill").font(.system(size:17,weight:.semibold)).frame(maxWidth:.infinity,minHeight:58)}.buttonStyle(.borderedProminent).tint(Color(red:0.74,green:0.86,blue:0.75))
                    Button {send("keepsakes")} label:{Label("Your saved keepsakes",systemImage:"square.stack.3d.up").frame(maxWidth:.infinity,minHeight:54)}.buttonStyle(.bordered)
                    if game.id=="relic-island" {Button {send("wardrobe")} label:{Label("Customize your explorer",systemImage:"person.crop.square").frame(maxWidth:.infinity,minHeight:54)}.buttonStyle(.bordered)}
                    if game.id=="pattern-garden" {Button {send("collection")} label:{Label("Your artwork collection",systemImage:"photo.stack").frame(maxWidth:.infinity,minHeight:54)}.buttonStyle(.bordered)}
                }.buttonBorderShape(.roundedRectangle(radius:20))
            }.padding(28).presentationDetents([.medium,.large]).presentationDragIndicator(.visible)
        }
    }
}
struct GameWebView: UIViewRepresentable {
    let url: URL
    @Binding var error: String?
    var isPaused: Bool = false
    var gameAction: String? = nil
    func makeCoordinator() -> Coordinator {Coordinator(error: $error, origin: url.host)}
    func makeUIView(context: UIViewRepresentableContext<GameWebView>) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.add(context.coordinator, name: "craftkitCheckout")
        configuration.userContentController.add(context.coordinator, name: "craftkitExport")
        configuration.userContentController.add(context.coordinator, name: "craftkitHaptic")
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "craftkitDigest")
        // LAN HTTP is not a secure Web Crypto context. Bridge SHA-256 to CryptoKit.
        let top=UIApplication.shared.connectedScenes.compactMap {($0 as? UIWindowScene)?.windows.first(where: {$0.isKeyWindow})}.first?.safeAreaInsets.top ?? 59
        let cryptoScript = """
        document.documentElement.classList.add('native-shell');
        document.documentElement.style.setProperty('--native-top','\(Int(top+72))px');
        if (!crypto.randomUUID) crypto.randomUUID = () => {const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128; const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join(''); return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
        if (!crypto.subtle) Object.defineProperty(crypto,'subtle',{value:{digest:async (algorithm,bytes)=>{if(algorithm!=='SHA-256')throw new Error('Unsupported digest');const a=new Uint8Array(bytes);let text='';for(const b of a)text+=String.fromCharCode(b);const hex=await window.webkit.messageHandlers.craftkitDigest.postMessage(btoa(text));return Uint8Array.from(hex.match(/../g),h=>parseInt(h,16)).buffer;}}});
        """
        configuration.userContentController.addUserScript(WKUserScript(source: cryptoScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let webView=WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate=context.coordinator
        webView.isOpaque=false
        webView.backgroundColor = .black
        webView.scrollView.bounces=false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: url))
        return webView
    }
    func updateUIView(_ uiView: WKWebView, context: UIViewRepresentableContext<GameWebView>) {
        if context.coordinator.lastPause != isPaused {
            context.coordinator.lastPause=isPaused
            uiView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('craftkit-native-pause',{detail:{paused:\(isPaused ? "true":"false")}}))",completionHandler:nil)
        }
        if let gameAction,context.coordinator.lastAction != gameAction {
            context.coordinator.lastAction=gameAction
            let value=gameAction.components(separatedBy:":")[0]
            if ["keepsakes","wardrobe","collection"].contains(value) {uiView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('craftkit-game-menu',{detail:'\(value)'}))",completionHandler:nil)}
        }
    }
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {uiView.configuration.userContentController.removeAllScriptMessageHandlers()}
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply, CheckoutDelegate {
        @Binding var error: String?
        let origin: String?
        var lastPause=false
        var lastAction: String?
        var lastHaptic=Date.distantPast
        weak var checkoutWebView: WKWebView?
        weak var checkoutController: UIViewController?
        init(error: Binding<String?>, origin: String?) {_error=error; self.origin=origin}
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "craftkitHaptic",message.frameInfo.isMainFrame,message.frameInfo.securityOrigin.host == origin,let kind=message.body as? String,Date().timeIntervalSince(lastHaptic)>0.045 {
                lastHaptic=Date()
                switch kind {
                case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
                case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
                case "medium": UIImpactFeedbackGenerator(style:.medium).impactOccurred()
                case "light": UIImpactFeedbackGenerator(style:.light).impactOccurred()
                default: UISelectionFeedbackGenerator().selectionChanged()
                }
                return
            }
            if message.name == "craftkitExport", message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == origin,
               let body=message.body as? [String:String], let base64=body["base64"], let data=Data(base64Encoded: base64), data.count <= 8_000_000,
               let name=body["filename"], ["png","svg","json","pgn"].contains(URL(fileURLWithPath: name).pathExtension) {
                let file=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + URL(fileURLWithPath: name).lastPathComponent)
                do {try data.write(to: file)} catch {return}
                let share=UIActivityViewController(activityItems: [file], applicationActivities: nil)
                guard let scene=UIApplication.shared.connectedScenes.first as? UIWindowScene, let root=scene.windows.first(where: {$0.isKeyWindow})?.rootViewController else {return}
                var presenter=root; while let next=presenter.presentedViewController {presenter=next}
                share.popoverPresentationController?.sourceView=presenter.view
                share.popoverPresentationController?.sourceRect=CGRect(x:presenter.view.bounds.midX,y:presenter.view.bounds.midY,width:1,height:1)
                presenter.present(share,animated:true); return
            }
            guard message.name == "craftkitCheckout", message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == origin, let text=message.body as? String, let url=URL(string: text), url.scheme == "https" else {return}
            guard url.host == "checkout.arcade.ai", let scene=UIApplication.shared.connectedScenes.first as? UIWindowScene, let root=scene.windows.first(where: {$0.isKeyWindow})?.rootViewController else {return}
            var presenter=root; while let next=presenter.presentedViewController {presenter=next}
            checkoutWebView=message.webView
            ShopifyCheckoutSheetKit.configuration.title = "Your keepsake"
            checkoutController=ShopifyCheckoutSheetKit.present(checkout: url, from: presenter, delegate: self)
        }
        private func finishCheckout(_ status: String) {
            checkoutController?.dismiss(animated: true)
            checkoutWebView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('craftkit-payment-return',{detail:{status:'\(status)'}}))", completionHandler: nil)
        }
        func checkoutDidComplete(event: CheckoutCompletedEvent) {finishCheckout("completed")}
        func checkoutDidCancel() {finishCheckout("cancelled")}
        func checkoutDidFail(error: CheckoutError) {finishCheckout("failed")}
        func checkoutDidEmitWebPixelEvent(event: PixelEvent) {}
        func checkoutDidClickLink(url: URL) {
            if ["https", "tel", "mailto"].contains(url.scheme) {UIApplication.shared.open(url)}
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.name == "craftkitDigest", message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == origin, let text=message.body as? String, let data=Data(base64Encoded:text), data.count <= 2_000_000 else {replyHandler(nil,"Invalid digest input");return}
            replyHandler(SHA256.hash(data:data).map {String(format:"%02x",$0)}.joined(),nil)
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.targetFrame?.isMainFrame != false, let url = navigationAction.request.url, url.host != origin, url.scheme == "https" {UIApplication.shared.open(url); decisionHandler(.cancel)} else {decisionHandler(.allow)}
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            #if DEBUG
            if let i=CommandLine.arguments.firstIndex(of: "--demo-checkout"), CommandLine.arguments.count>i+1, checkoutWebView == nil {
                let argument=CommandLine.arguments[i+1]
                guard let url=URL(string:argument),url.scheme=="https",url.host=="checkout.arcade.ai" else {return}
                checkoutWebView=webView
                webView.evaluateJavaScript("window.webkit.messageHandlers.craftkitCheckout.postMessage('\(url.absoluteString)')",completionHandler:nil)
            }
            #endif
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {self.error="Keep the demo server running and connect the iPhone to the same Wi-Fi as the Mac. \(error.localizedDescription)"}
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if let response=navigationResponse.response as? HTTPURLResponse, response.statusCode >= 400 {error="The demo connection was rejected (HTTP \(response.statusCode)). Check the access token in Settings."; decisionHandler(.cancel)} else {decisionHandler(.allow)}
        }
    }
}
