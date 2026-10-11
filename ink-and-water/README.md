# Ink & Water

A calm iPhone game about paper marbling. The player floats ink on water, swirls and combs it into a pattern that is theirs alone, and Arcade turns it into a real silk scarf, pocket square or linen pillow made by an independent maker.

```text
Player's tray (ink drops, swirls, comb strokes)
    -> rendered at 1024 x 1024 on the phone
    -> server uploads it to Arcade as a reference image
    -> Arcade patterns/create with a marbling model and the player's palette (about 1 minute)
    -> Arcade products/create for each product (seconds), with real price, maker and photos
    -> demo checkout (simulated; nothing is charged or shipped)
```

## Run it

1. Put an Arcade key in the repo root `.env` as `ARCADE_API_KEY=arcade_sk_live_...`.
2. Start the server (Node 22+, no dependencies):

   ```sh
   node ink-and-water/server/server.mjs
   ```

   It listens on `http://127.0.0.1:8787`. The Arcade key never leaves this computer.
3. Open `ink-and-water/ios/InkAndWater.xcodeproj` in Xcode 16+, pick an iPhone simulator, and run. iOS 17 or later.

To try it on a real phone, start the server with `INK_HOST=0.0.0.0`, then set the server address in the app's More menu to your computer's address, such as `http://192.168.1.20:8787`. Only do this on a network you trust: anyone who can reach the port can spend Arcade generations.

## How the marbling works

The tray stores operations, not pixels: ink drops, finger swirls and comb tines. Each pixel walks the operations backwards to find which ink it came from, using the closed-form marbling transforms from Jaffer's "Mathematical Marbling". `Rendering/Marbling.metal` does this live on the GPU; `Model/Marbling.swift` does the same math on the CPU to export the print image. Keep the two in step.

## What is real and what is simulated

- **Real:** Arcade pattern generation from the player's canvas, real products with real prices, makers and photos.
- **Simulated:** checkout. `/api/checkout` never calls Arcade, so nothing can be bought by accident during a demo. Arcade's real checkout is a hosted Shopify page that cannot be framed, so a production version would open it in an in-app browser sheet.

## Findings from testing (2026-10-11)

- The Nonpareil Hand Marbled model keeps the player's composition, including empty paper. The Archival Hand Marbled model is freer and reinterprets the layout. Nonpareil is the default.
- A pattern takes about 55 to 60 seconds; a product takes about 5 to 10 seconds.
- Square patterns fit the square scarf, pocket square and pillow sizes without cropping.
- Sample prices: silk scarf 36 in $104, silk pocket square $98 (maker: Odette).
