# CraftKit keepsake middleware

Built for CraftKit, our **second-place project at Shopping 3.0: the AI Commerce Hackathon with Arcade** on October 11, 2026, during SF Tech Week in San Francisco. See the [project overview](../README.md).

CraftKit turns a game-owned design snapshot into a saved keepsake with a product, quote, checkout, and order lifecycle. Relic Island, Pattern Garden, Chess Atelier and Signal Garden use the same SDK and forge UI against the same service.

## What runs where

- `dist/craftkit-client.js`: engine-neutral browser SDK. Game inputs are recipe, source event, immutable design, reference SVG, title, brief, and story events. Player identity comes from the server, not the request body.
- `craftkit/service.js`: validates recipes/options, saves immutable design snapshots, deduplicates repeated unlocks, advances jobs, checks quote expiration, guards state transitions, and records studio attribution.
- `craftkit/providers/demo.js`: simulated generation, catalog, price, checkout, and fulfillment. It contains all simulated vendor orchestration. No Arcade network calls or credentials are used.
- `craftkit/stores/d1.js`: prepared D1 statements with optimistic concurrency. Unique keys and version checks guard repeated and concurrent requests.
- `craftkit/worker.js`: hosted API and game asset delivery. Uses the Sites-authenticated user header and the `DB` binding. Requests without a signed-in user are rejected. Mutations enforce same-origin JSON requests.
- `preview.mjs`: loopback-only local server with persistent SQLite and a development identity. It applies the checked-in migrations once. Data lives in ignored `.sites-runtime/craftkit.sqlite`.
- `dist/commerce.js`: shared presentation adapter; it never calculates a price or invokes a vendor endpoint. Closing it stops observation, not generation.

## Game integration

```js
import {CraftKitClient} from './craftkit-client.js';
const craftkit = new CraftKitClient({gameId: 'relic-island'});
const keepsake = await craftkit.createKeepsake({
  recipe: 'scarf',
  sourceEventId: 'run-42-loom',
  title: 'Ocean journey scarf',
  prompt: 'Preserve the attached scarf pattern and its colors.',
  design: {palette: 'ocean', motifs: ['waves'], referenceSvg: '<svg ...>...</svg>'},
  story: [{event: 'loom-solved'}],
});
await craftkit.generateProduct(keepsake.id);
const ready = await craftkit.waitForProduct(keepsake.id, {onUpdate: renderStatus});
const checkout = await craftkit.openCheckout(ready.id);
```

Recipes and registered game IDs live in `craftkit/recipes.js`. New games capture their own design and enforce their own gameplay unlocks. They can use the shared forge or build another UI with the same SDK. The ID hashes server identity, game, source event, recipe, and canonical design fingerprint. Repeating the same submission returns the existing record. Changing the design creates a new keepsake, preserving earlier ones.

The saved reference is displayed as an image, not injected SVG markup. Editing the character after saving does not change that record. Physical option changes invalidate the product/quote and get a new revision key; quantity changes reprice the saved product. Paid orders lock edits. Quotes last 15 minutes. Checkout/payment retries return the existing order; concurrent writes use compare-and-swap. A retried fulfillment step does not advance twice.

`GET /api/craftkit/keepsakes` lists up to 50 recent records for the signed-in user and selected game. `GET /api/craftkit/keepsakes/:id` reconciles generation. `POST /api/craftkit/keepsakes` saves a design. POST actions beneath a keepsake include `generate`, `options`, `checkout`, `refresh-quote`, `pay-demo`, and `advance-demo`. The SDK supplies `X-CraftKit-Game`; this is a demo game selector, not a trusted third-party tenant credential.

## Live provider

`craftkit/providers/arcade.js` implements the real Arcade commerce API. Set `CRAFTKIT_PROVIDER=live` and the server-only `ARCADE_API_KEY`. The local iOS demo uses the live provider. Hosted runtime values belong in native Sites environment settings, never in the manifest. The provider uses the account catalog, complete manufacturable defaults, real reference uploads, stable request IDs, job reconciliation, product previews/prices, hosted checkout, and upstream order confirmation. See [IOS-DEMO.md](../IOS-DEMO.md).

## Simulation mode and remaining production work

The backend and database are real. `DemoProvider` is a fixture; `ArcadeProvider` makes real calls. Demo jobs use persisted timestamps and reconcile on reads; there is no GPU generation, background Arcade polling, real payment, shipment, or royalty settlement. A closed browser does not lose job state. The next read resolves the simulated result. Availability of pendant, trophy, plush, materials, and every category/option must be verified through the live Arcade catalog.

For production beyond this demo:

1. The server-only live provider, reference uploads, async polling, previews, and checkout are implemented. A background reconciler and signed webhooks remain future work; current reconciliation occurs on reads.
2. Replace fixture recipes/catalog with supported categories and options. Preserve references, validate manufacturability, and show the actual product preview before purchase. A reference image is not a 3D asset or guaranteed exact manufacturing output.
3. Verify signed events from each game's authoritative backend and establish authenticated studio/tenant registration before trusting external game IDs, achievements, or attribution. Current demos permit the signed-in player to submit their own design; they do not attest gameplay.
4. Reconcile orders only through trusted vendor status/webhooks. Disable demo payment/fast-forward actions for live providers. Never mark a payment complete from a client assertion.
5. Confirm merchant, refund, tax/shipping, and studio revenue-share arrangements with Arcade. Attribution is saved, but no payouts or vaulted wallets are implemented.

Production Worker storage is D1. Drizzle owns migrations in `drizzle`; append migrations rather than altering applied history. This deployment preserves the existing private Site audience.

## Development

`npm run preview` starts the games + API at http://127.0.0.1:4174. `npm run check` runs syntax and contract tests. `npm run db:generate` generates migrations after schema changes. `npm run build` bundles the Worker and both games plus migrations for Sites.

## Rename compatibility

CraftKit is the primary brand, SDK (`CraftKitClient`), API (`/api/craftkit`), and configuration prefix (`CRAFTKIT_`). The old SDK import, `/api/nexus` routes, `X-Nexus-Game` header, and `NEXUS_` environment values remain accepted for existing integrations. New configuration takes precedence.

Applied migrations, the physical `nexus_keepsakes` table/index, and existing local `nexus.sqlite` databases are retained to preserve saved designs and orders. New databases use `craftkit.sqlite`. Existing Arcade requests retain their original idempotency namespace; newly created records use `craftkit`. The iOS bundle identifier and saved preference keys remain stable to preserve installed app data. New deep links use `craftkit://`; legacy `nexusarcade://` links remain accepted.

## Game-ready offerings

CraftKit links gameplay to original art in two categories: **accomplishments** (what the player earned) and **play creates design** (what their actions made). The interactive catalog is `/craftkit.html`, also available in the native CraftKit tab. Ten templates live in `dist/craftkit-offerings.js`; they are design use cases, separate from vendor product categories.

| Offering | Gameplay source | Renderer / output | Demo integration |
| --- | --- | --- | --- |
| Achievement emblem | Quest or shrine unlock | Symbol / pendant | Relic Island, 3 coins |
| Evolving relic | Higher personal milestone | Ornate symbol / pendant | Relic Island, 10 coins |
| Match remembered | Finished match | Move art / scarf or pillow | Chess Atelier, completed match |
| Collection mosaic | Collected symbols | Repeating motifs / textile | Reusable template |
| Personal best | Best run's recorded route | Flow art / textile | Reusable template |
| Every move, a mark | Actual match moves | Geometric move art / textile | Chess Atelier, player chooses |
| Journey into art | Movement, hue and discovery | Flow art / textile | Pattern Garden, reveal |
| Your character, your keepsake | Custom appearance | Game-supplied portrait / textile | Relic Island, outfitter |
| Made by your hands | Loom or puzzle composition | Exact game artwork / textile | Relic Island, loom |
| A shared story | Combined cooperative routes | Flow art / textile | Reusable template |

Use the shared UI adapter after a meaningful accomplishment or explicit player choice:

```js
import {openOffering} from './commerce.js';
await openOffering('move-art', {
  sourceEventId: `match-${matchId}-${moves.length}`,
  type: 'pillow',
  activity: {moves}, // from/to chess squares and w/b colors
  story: [{event: 'match-preserved', moves: moves.length}]
});
```

`offeringArtwork(id, activity)` includes deterministic symbol, collected-motif, chess-move and movement renderers. Supply `design.referenceSvg` to preserve a game's own art renderer. Character and crafted-pattern templates require this reference. `buildOffering` validates the source event and output, clones the source, and records the template ID/category/version in the immutable design and story. Commerce is opt-in; templates do not listen to games or trigger purchases. Catalog availability is still enforced by the live provider.

For a custom interface, `CraftKitClient.createFromOffering(id, input)` saves the same design through the SDK. Live textile integrations should rasterize the reference SVG with `rasterizeDesign` before submission; `openOffering` handles this automatically through the shared forge. The renderer supports chess square moves and world-space x/z/hue routes today; other engines can supply their own SVG.

Chess can export its match as SVG poster artwork without buying anything. Physical posters, figurines and playable custom chessboards are future vendor formats, not purchasable demo categories. Additional games require registration and, in production, authenticated studio credentials and trusted gameplay events as described above.
