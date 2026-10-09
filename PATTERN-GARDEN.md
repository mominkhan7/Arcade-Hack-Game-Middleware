# Pattern Garden / a nocturne in light

Open `/pattern-garden.html` on the existing Relic Island Site. A glowing moth spirit glides through a bioluminescent night forest. Its wings and iridescent trail absorb cyan from Mirrorwater, amber from flowers, and violet from the grove. The journey becomes an original abstract artwork, then an optional demo collectible and physical keepsake through the shared Nexus layer.

## Presenter walkthrough

1. Enter the forest. Use WASD or arrows to glide at 6.2 units/s, Shift to fly at 10 units/s, and drag the scene to orbit the camera. Touch controls provide a movement stick and interaction button.
2. Follow the compass, waypoint, and small map to Violet grove, Mirrorwater, and Amber bloom. Passing close automatically discovers each living palette. Look back to see the color trail.
3. Press E or click View & save artwork anywhere after painting the first stroke. Exploring all three palettes is optional.
4. Inspect the flowing pigment composition. The flight path, sampled hues, and deterministic seed drive the artwork. Art tone changes its dark paper ground; nature controls the flight colors.
5. Save to collection keeps a snapshot in this browser. Download PNG exports 2000 × 2000 pixels; Download SVG preserves a scalable vector; Design record exports JSON. Optionally claim the demo collectible.
6. Choose scarf, rug, or pillow cover. The shared forge saves the exact SVG, design fingerprint, and story, then generates a simulated product, quote, checkout, and accelerated fulfillment.
7. Collection reopens local artworks. Orders reopens server-backed physical keepsakes. The draft flight and digital collection survive reloads in this browser.

## Design and performance

Tonic’s [Rhythm & the Machine](https://tonic.xyz/series/rhythm-and-the-machine/) informed the interest in fluid color fields and generative composition. The artwork renderer is original code and uses no copied Tonic artwork. The scene combines mist, moonlight, luminous plants, animated pond glints, drifting spores, and a translucent moth with a restrained cinematic HUD.

Static meshes are batched by material; foliage, grasses, and light plants use instancing. Grass counts are bounded. A quarter-resolution separable bloom pass adds glow. Pixel ratio starts at up to 1.75 and reduces after sustained low frame rates, shadow maps are disabled, and map/HUD updates are throttled. Local desktop flight tests measured about 60 FPS; other hardware may vary. The pond uses an animated reflection-like water shader rather than planar scene reflection.

The flow-field SVG is deterministic for a fixed design. Renderer version 5 and SHA-256 identify its snapshot. Each new point records flight altitude as well as planar position, biome, and sampled hue. The ribbon floats at that altitude and connects continuously to the moth. Older saved routes are lifted to flight height. Startup builds the ribbon once, movement reuses vectors, and per-point trail discs have been removed to reduce draw calls. The 550-point cap and compact SVG keep the design below Nexus’s 90 KB limit; a 550-point airborne sample was 87,184 bytes.

## Demo boundaries

Commerce uses sample prices and simulated checkout/fulfillment. No real charge, manufacturing request, or shipment occurs. The collectible is a local simulation with a fingerprint-derived token ID; metadata explicitly sets chain and contract to null and grants no physical redemption entitlement. Digital artworks are local to this browser; physical keepsakes and orders persist through Nexus. Live minting and production require real providers and transaction authorization.

## Files and validation

- `dist/pattern-garden-world.js`: Three.js world, movement, biome color absorption, batched rendering, bloom, and interaction.
- `dist/garden-art.js`: deterministic abstract SVG renderer.
- `dist/pattern-garden.js`: draft state, artifact snapshots, collection, demo mint, downloads, WebMCP tools, and commerce adapter.
- `dist/pattern-garden.html` and `.css`: game HUD, dialogs, and touch layout.
- `dist/commerce.js` and `dist/nexus-client.js`: shared integration, reused directly.
- `nexus/recipes.js`: existing Pattern Garden game registration.

`NEXUS_PORT=4182 npm run preview` starts local development. `npm run check` includes syntax checks for the garden and the existing middleware tests. `npm run build` packages the games and Nexus Worker.

The full journey, discovery, artifact reveal, local collectible, save/reopen, and exact-SVG Nexus generation/quote were exercised in the browser. Version 5 also verifies E preview before all three discoveries, saving an airborne flight snapshot, and PNG generation. Higher-resolution flight measured 60 FPS locally at pixel ratio 1.75. Download links use browser Blob downloads; automated download capture was unavailable in the in-app browser.

## Generated foliage asset

Saved asset: `dist/assets/garden-foliage.png` (1254 × 1254, transparent PNG). Generated with the built-in imagegen tool and inspected before use.

Final prompt: “Photorealistic front-facing oak and laurel foliage cluster on slender branching twigs, square composition, muted forest greens, sharp realistic leaf veins, soft neutral illumination, transparent background and gaps; no trunk, pot, ground, text, or cast shadow.”
