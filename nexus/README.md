# Nexus keepsake middleware

Nexus turns a game-owned design snapshot into a saved keepsake with a product, quote, checkout, and order lifecycle. Relic Island and Signal Garden use the same SDK and forge UI against the same service.

## What runs where

- `dist/nexus-client.js`: engine-neutral browser SDK. Game inputs are recipe, source event, immutable design, reference SVG, title, brief, and story events. Player identity comes from the server, not the request body.
- `nexus/service.js`: validates recipes/options, saves immutable design snapshots, deduplicates repeated unlocks, advances jobs, checks quote expiration, guards state transitions, and records studio attribution.
- `nexus/providers/demo.js`: simulated generation, catalog, price, checkout, and fulfillment. It contains all simulated vendor orchestration. No Arcade network calls or credentials are used.
- `nexus/stores/d1.js`: prepared D1 statements with optimistic concurrency. Unique keys and version checks guard repeated and concurrent requests.
- `nexus/worker.js`: hosted API and game asset delivery. Uses the Sites-authenticated user header and the `DB` binding. Requests without a signed-in user are rejected. Mutations enforce same-origin JSON requests.
- `preview.mjs`: loopback-only local server with persistent SQLite and a development identity. It applies the checked-in migrations once. Data lives in ignored `.sites-runtime/nexus.sqlite`.
- `dist/commerce.js`: shared presentation adapter; it never calculates a price or invokes a vendor endpoint. Closing it stops observation, not generation.

## Game integration

```js
import {NexusClient} from './nexus-client.js';
const nexus = new NexusClient({gameId: 'relic-island'});
const keepsake = await nexus.createKeepsake({
  recipe: 'scarf',
  sourceEventId: 'run-42-loom',
  title: 'Ocean journey scarf',
  prompt: 'Preserve the attached scarf pattern and its colors.',
  design: {palette: 'ocean', motifs: ['waves'], referenceSvg: '<svg ...>...</svg>'},
  story: [{event: 'loom-solved'}],
});
await nexus.generateProduct(keepsake.id);
const ready = await nexus.waitForProduct(keepsake.id, {onUpdate: renderStatus});
const checkout = await nexus.openCheckout(ready.id);
```

Recipes and registered game IDs live in `nexus/recipes.js`. New games capture their own design and enforce their own gameplay unlocks. They can use the shared forge or build another UI with the same SDK. The ID hashes server identity, game, source event, recipe, and canonical design fingerprint. Repeating the same submission returns the existing record. Changing the design creates a new keepsake, preserving earlier ones.

The saved reference is displayed as an image, not injected SVG markup. Editing the character after saving does not change that record. Physical option changes invalidate the product/quote and get a new revision key; quantity changes reprice the saved product. Paid orders lock edits. Quotes last 15 minutes. Checkout/payment retries return the existing order; concurrent writes use compare-and-swap. A retried fulfillment step does not advance twice.

`GET /api/nexus/keepsakes` lists up to 50 recent records for the signed-in user and selected game. `GET /api/nexus/keepsakes/:id` reconciles generation. `POST /api/nexus/keepsakes` saves a design. POST actions beneath a keepsake include `generate`, `options`, `checkout`, `refresh-quote`, `pay-demo`, and `advance-demo`. The SDK supplies `X-Nexus-Game`; this is a demo game selector, not a trusted third-party tenant credential.

## Live provider

`nexus/providers/arcade.js` implements the real Arcade commerce API. Set `NEXUS_PROVIDER=live` and the server-only `ARCADE_API_KEY`. The local iOS demo uses the live provider. Hosted runtime values belong in native Sites environment settings, never in the manifest. The provider uses the account catalog, complete manufacturable defaults, real reference uploads, stable request IDs, job reconciliation, product previews/prices, hosted checkout, and upstream order confirmation. See [IOS-DEMO.md](../IOS-DEMO.md).

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
