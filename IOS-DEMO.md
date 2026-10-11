# Nexus Arcade iOS demo

The SwiftUI launcher contains Relic Island, Pattern Garden (the floating fairy / nighttime art journey), and Chess Atelier. The first two use Three.js; Chess Atelier uses a responsive chess board and the chess.js rules engine. All three run in WKWebView and share the Nexus backend. User-created artwork and progress persist in WKWebView storage. Physical keepsakes persist in SQLite locally or D1 on the hosted Site.

## Start the demo

Use Node 22.13+ and Xcode with an iOS simulator runtime. From the canonical project directory:

```sh
npm ci
npm run ios:configure
read -s 'ARCADE_API_KEY?Arcade API key: '
export ARCADE_API_KEY
npm run demo:ios
```

The hidden-input read command is for zsh. The key is hidden while typed and stays in the server process environment. Do not put it in an Xcode build setting, source file, or command argument. The development script also supports hidden secret JSON on stdin via `--secret-stdin`.

Open `ios/NexusArcade.xcodeproj`, select the NexusArcade scheme and an iPhone simulator, then Run. `ios:configure` writes an ignored access-token file and ignored Xcode connection settings for this Mac’s Wi-Fi address. No Arcade key is written. Both the app and server use that demo token. Settings in the launcher override the defaults; clear saved settings if the network address changes.

For a physical device, select your Apple signing team, enable Developer Mode, and keep iPhone and Mac on the same Wi-Fi. This session was requested to remain simulator-only. Device installation and App Store/TestFlight distribution are not part of the verified result.

## Presenter flow

1. Relic Island: choose a sigil, collect three coins, solve the echo, and wake the shrine. Choose Make my keepsake. A pendant is generated using the sigil and supported jewelry options.
2. Pattern Garden: enter the forest, fly for a few seconds, view the artwork, then choose Preview physical keepsake. A scarf is the default. Nexus rasterizes and uploads the actual flight artwork without asking the player to write a prompt or configure product details.
3. Review the actual Arcade product image, maker, and item price. Tap Bring it home. The iOS app presents Arcade’s payment using Shopify Checkout Kit inside the app; its final total may include shipping, tax, drop-ship fees, and discounts. Nexus does not store cards.
4. Payment completion or cancellation automatically refreshes the order. Only a real response from Arcade marks payment complete. Closing or reloading resumes the saved generation.

Generation can take several minutes. Keep one real generated keepsake ready in Saved keepsakes for a short pitch. No purchase is necessary to demonstrate the product and checkout. The digital achievement is complete whether the player buys anything or not.

## Verified API contract

Official source: [Arcade docs](https://docs.arcade.ai/quickstart) and [OpenAPI](https://docs.arcade.ai/openapi.json). Base URL: `https://platform.arcade.ai/v1`.

Print flow: categories/list → categories/get defaults → references/createUpload → signed PUT → references/create → patterns/create → jobs/get → products/create → jobs/get → products/get → checkouts/create → orders/get. Jewelry uses patterns/create with categoryId and receives productId directly; no referenceIds or products/create.

The live catalog lists scarves, decorative pillows, and pendant necklaces. Rugs, plush, and trophies are unavailable to this account. No fake fallback quote is supplied for unsupported categories. Pattern Garden’s optional collectible remains an explicitly labeled local simulation.

## Image models

The default reference renderer is the game’s deterministic artwork, which is rasterized and uploaded to Arcade. Arcade generates the product preview. `new ArcadeProvider({apiKey, referenceGenerator})` accepts an optional server-side async referenceGenerator(design, prompt) returning a PNG data URL. This is the integration point for your own model. No separate model API/key has been supplied, so a third-party image model is not enabled. Jewelry currently cannot use uploaded references through Arcade’s API.

## Security and limits

The LAN server is a presenter demo with one shared development identity, protected by an HttpOnly access-token cookie. It is not production multi-user authentication. Production Worker requests retain Sites identity and per-player authorization. HTTP LAN transport is only for the local demo; use HTTPS for production. Native CryptoKit supplies SHA-256 when Web Crypto is unavailable on LAN HTTP. PNG, SVG, and design-record exports open the native share sheet. Payment stays in the app via Shopify Checkout Kit; the SDK handles the merchant’s saved payment options.

The supported Arcade integration uses the checkout link returned by checkouts/create. The browser hands off to that link; the iOS demo displays the same hosted checkout through Shopify Checkout Kit. This is not a direct native payment API. Apple Pay was visible in the simulator checkout, but wallet availability depends on Arcade’s checkout and the device. Arcade’s public API does not document native payment or Shopify accelerated checkout access. Treat either as a potential future improvement requiring confirmation from Arcade, not a dependency the presenter needs to obtain. The API does not establish a global Nexus wallet, automatic studio settlement, or free physical redemption. Those remain unimplemented.

## Demo talking point

“Your gameplay creates the design. Nexus chooses the supported product options, generates the keepsake, and brings back the preview and price—without making you write a prompt or build a product. Today, Arcade gives us a checkout link, so payment hands off to their checkout, where available wallets can reduce data entry. If Arcade exposes native payments or Shopify accelerated checkout, Nexus can reduce that handoff to a wallet confirmation. That integration isn’t exposed by the current Arcade API.”

Show the actual product preview first, then the real checkout link. Do not describe a Nexus wallet, automatic charges, or direct Apple Pay integration as implemented. The head of product’s guidance is that checkout links are the currently supported path.

## Three-game mobile app

The native Play tab offers Relic Island, Pattern Garden, and Chess Atelier. The Keepsakes tab brings together saved designs, products, and orders from all three games. The launcher uses SwiftUI glassEffect controls and the system floating tab bar on iOS 26 and later, built with the installed iOS 27 SDK. Older supported iOS versions use a material fallback.

Chess Atelier is an original presentation of chess, with no third-party game branding or assets. Play White against a gentle depth-two computer or choose pass-and-play with a friend. Legal moves, checkmate, castling, en passant, and promotion use the MIT-licensed chess.js rules engine (license included in dist/vendor). Matches persist locally, can be undone, and export as PGN through the iOS share sheet. After four half-moves, Nexus can generate a supported physical keepsake from an SVG of the actual move paths. This is a match-inspired scarf/pillow, not a physical chess set.

## Touch refinement and validation

Game screens now use custom 54-point native glass navigation, a pause/resume world menu, press animations, animated artwork sheets, and native selection/action haptic events. Relic Island and Pattern Garden use 156-point movement pads with 84/86-point action targets. Chess uses custom vector pieces and 280 ms move animations; its squares measure 45.5 points at a 390-point viewport. Reduced Motion disables decorative motion.

Validation: the iOS simulator build succeeded, all 23 existing checks passed, and phone-size browser interaction confirmed legal chess moves and computer replies, both movement pads changing player position, and Garden artwork/pause sheets opening and closing. All three native game layouts were inspected through simulator screenshots. Native simulator UI automation could not attach to Device Hub; the native pause menu has not received a complete hands-on walkthrough, and haptic feel still needs an actual iPhone. These checks do not establish full end-to-end native interaction or physical-device performance.

Close-button hit targets remain fixed during presses and sheet entry. Native navigation explicitly hits the whole 54-point target, with icon-only scaling; title decoration cannot intercept touches. Web close controls have at least 48-point targets, manipulation touch handling, and no target translation/scaling. Phone-size single-click checks passed at all four edges of the saved-keepsakes close control, plus Garden artwork/pause and Relic wardrobe/trail controls. Native Device Hub interaction still cannot attach; simulator build/install verifies compilation but does not establish native tap reliability.
