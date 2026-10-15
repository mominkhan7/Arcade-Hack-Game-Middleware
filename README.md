# CraftKit

**Second place at Shopping 3.0: the AI Commerce Hackathon with Arcade, October 11, 2026, during SF Tech Week in San Francisco.**

Three playable experiences and **CraftKit**, a shared middleware layer that turns a player's design or achievement into a saved keepsake and a physical-product commerce journey.

This is an Arcade hackathon project exploring a simple idea: **the object is more meaningful when the player has a story behind it.** Games own the experience and capture the design; CraftKit owns the reusable design-to-order lifecycle.

## What we built and why

| Experience | What the player does | What they keep | Purpose |
| --- | --- | --- | --- |
| **Relic Island** | Explore a 3D island, collect coins, solve a memory encounter, customize a character, and activate a shrine. An optional loom adds a pattern puzzle. | Journey rewards and personalized pendant, scarf, pillow, rug, and trophy concepts. | Demonstrate an adventure that gives a keepsake personal meaning. |
| **Signal Garden** | Rotate nine circuit tiles to connect light from IN to OUT and choose a palette. | A scarf reference carrying the exact solved circuit. | Demonstrate a second game using the same middleware, with a clear relationship between achievement and design. |
| **Pattern Garden** | Fly a luminous moth through a nighttime forest, collecting colors from water, flowers, and a violet grove. | Original abstract artwork derived from the flight, with PNG/SVG/JSON exports and optional physical keepsakes. | Explore player-authored generative art that has value before any purchase. |

Relic Island includes Sun, Moon, Mountain, and Ocean worlds, touch and keyboard controls, forgiving retries, a short three-coin demo, and longer exploration modes. Pattern Garden includes navigation aids, touch controls, animated scenery, bloom, batched geometry, and adaptive rendering quality.

## CraftKit: the shared platform

All three games use an engine-neutral browser SDK and the same forge UI and backend:

```text
Gameplay / player choices
    -> immutable design + reference SVG + story
    -> CraftKit saved keepsake
    -> product generation
    -> quote + options
    -> checkout
    -> order + fulfillment tracking
```

CraftKit saves design snapshots, fingerprints designs, deduplicates repeated submissions, scopes collections to players and games, reconciles generation jobs, validates options and quote expiration, and guards order transitions. Editing a character after saving cannot alter an earlier keepsake. Payment retries return the existing order, and database version checks protect concurrent changes.

Studio attribution is recorded. Revenue settlement, wallets, and payouts are not implemented.

## Current live integration (October 11, 2026)

Relic Island, Pattern Garden, and Chess Atelier now have a native iOS demo launcher in `ios/`. CraftKit has a real server-only Arcade provider. It retrieves the live catalog, uploads game references, reconciles async generation, retrieves actual previews and prices, opens hosted checkout, and confirms orders through Arcade. See [IOS-DEMO.md](IOS-DEMO.md). `npm run preview` still defaults to simulation; `CRAFTKIT_PROVIDER=live` with a server-side `ARCADE_API_KEY` selects the live provider. Existing simulated records remain labeled simulated.

The account catalog currently supports scarves, decorative pillows, and pendant necklaces. Rugs, trophies, and plush are not listed. Textile references are uploaded as PNGs; jewelry uses the game’s sigil brief because Arcade’s jewelry API does not accept reference images. Exact design preservation is not guaranteed: the player reviews Arcade’s actual preview.

## Simulation mode

**Implemented:** playable games, procedural 3D worlds, original deterministic artwork generation, design exports, shared SDK and forge, backend validation, persistent storage, saved collections, and lifecycle/state-transition logic.

**In simulation mode:** vendor product generation, catalog options, prices, taxes/shipping, hosted checkout, payment, manufacturing, fulfillment, and tracking. These fixtures are used only by `DemoProvider`. `ArcadeProvider` performs real network calls and hosted checkout; it never simulates payment or fulfillment.

Pattern Garden's digital collectible is a local browser simulation. It has no blockchain transaction, contract, wallet, or physical redemption entitlement. Its digital art collection and draft flight are browser-local; physical keepsake records persist through CraftKit.

Product and material availability must be checked against a live catalog. Pendant, trophy, plush, and platinum concepts are exploratory. A reference is not a guarantee of exact manufacturing output.

## Run the browser locally

Use **Node.js 22.13+** (or a newer release with `node:sqlite` and `DatabaseSync`) and npm.

```sh
cd /Users/mominkhan/Desktop/ArcadeHack-Game-Middleware
npm ci
npm run preview
```

Open:

- Relic Island: http://127.0.0.1:4174/
- Signal Garden: http://127.0.0.1:4174/signal-garden.html
- Pattern Garden: http://127.0.0.1:4174/pattern-garden.html

For another port:

```sh
CRAFTKIT_PORT=4182 npm run preview
```

The preview binds to loopback and supplies a development player identity. New SQLite databases live in `.sites-runtime/craftkit.sqlite`; existing `.sites-runtime/nexus.sqlite` databases are reused; migrations apply automatically on startup. This folder is ignored by Git. Browser-local artwork stays in the browser and origin where it was created; changing the hostname or port does not transfer it.

## Development and validation

```sh
npm run check       # JavaScript syntax plus shrine, commerce, and CraftKit tests
npm run build       # Bundle the Worker, assets, hosting metadata, and migrations
npm run db:generate # Generate a migration after changing the Drizzle schema
```

Append database migrations rather than modifying applied history.

**Important:** `dist/` contains the editable game source and assets. Despite its name, it must stay in Git. Only `dist/server/` and `dist/.openai/` are generated deployment outputs. Do not delete `dist/` as a routine build cleanup.

## Repository map

```text
README.md                    Whole-project context and setup
RELIC-ISLAND.md               Adventure mechanics and reward details
PATTERN-GARDEN.md             Art journey, controls, rendering, demo walkthrough
ASSETS.md                    Asset provenance and concept boundaries
dist/                        Browser game source, UI, SDK, and assets
  game.js / world.js         Relic Island gameplay and world
  keepsakes.js / sigils.js   Reward references and world symbols
  signal-garden.*            Circuit puzzle
  pattern-garden.*           Art journey and artifact UI
  pattern-garden-world.js    Moth flight and forest rendering
  garden-art.js              Deterministic SVG artwork renderer
  craftkit-client.js            Shared browser SDK
  commerce.js                Shared forge UI
craftkit/                       Middleware API, service, recipes, provider, store
  README.md                  Architecture, API usage, live-integration requirements
  providers/demo.js          Simulated vendor implementation
  stores/d1.js               Persistent database adapter
  worker.js                  Hosted API and asset delivery
db/schema.ts                 Drizzle schema
drizzle/                     Checked-in migrations
scripts/build.mjs            Deployment bundler
preview.mjs                  Local games + API + SQLite server
tests/                       Shrine, commerce, and middleware contract tests
reference-assets/            Earlier generated 2D references, retained for context
.openai/hosting.json         Existing Sites project configuration
```

## Presenter walkthrough

1. **Relic Island:** choose a world, explore the short demo, collect three coins, solve the echo, and activate the shrine. Show customization and a reward's forge flow.
2. **Signal Garden:** connect all nine tiles and show the solved circuit becoming a scarf reference through the same forge.
3. **Pattern Garden:** fly through the living palettes, reveal the artwork, save or export it, and select a scarf, rug, or pillow cover.
4. **CraftKit:** reopen saved keepsakes and advance a demo order to show persistence and the shared lifecycle.

The pitch: different games create different meaningful designs, while one reusable layer handles the path from design to commerce.

## Hosting and the path to live Arcade

The existing Sites configuration is retained. Hosted storage uses a Worker with a D1 `DB` binding and a Sites-authenticated player header. The API rejects unauthenticated requests and requires same-origin JSON mutations. This move does not create or publish a new Site.

Before enabling real commerce:

1. Implement a server-only Arcade provider with verified API contracts, uploads, asynchronous generation, actual product responses, and hosted checkout URLs.
2. Retrieve supported catalog categories, materials, and options; show the actual generated preview before purchase.
3. Establish authenticated studio registration and authoritative gameplay events before trusting external game achievements or attribution.
4. Reconcile payment and fulfillment from trusted vendor events; disable demo payment and fulfillment controls.
5. Confirm merchant, refunds, taxes, shipping, and any studio revenue-share arrangements.

See [CraftKit integration guide](craftkit/README.md), [Relic Island guide](RELIC-ISLAND.md), [Pattern Garden guide](PATTERN-GARDEN.md), and [asset notes](ASSETS.md) for more detail.

## Project home and Git

The canonical local project home is `/Users/mominkhan/Desktop/ArcadeHack-Game-Middleware`. The original `relic-island` repository history is preserved in this folder. Dependencies, runtime data, generated deployment files, OS metadata, and environment secrets are excluded from version control. The GitHub remote is [mominkhan7/Arcade-Hack-Game-Middleware](https://github.com/mominkhan7/Arcade-Hack-Game-Middleware), configured as `origin`. The main development branch is `main`.
