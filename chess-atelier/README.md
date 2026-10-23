# Chess Atelier

**Every game draws itself.** Play chess (or replay a famous game) and every move leaves a line in its piece's ink. When the game ends, the drawing is a one-of-one artwork, and Arcade turns it into a real product: a silk scarf, a linen pillow or a pocket square.

A standalone, mobile-first web app. It is separate from the CraftKit games in the rest of this repo.

## Run it

```bash
npm run atelier
```

Then open http://127.0.0.1:8790 (use a phone-sized window).

By default Arcade is **simulated**: no API calls and no key needed. The drawing itself comes back as the "pattern," with real Arcade prices and makers. To use the real Arcade API (it spends generations, and uses `ARCADE_API_KEY` from the repo root `.env`):

```bash
ATELIER_ARCADE=live npm run atelier
```

Checkout is always simulated, so nothing can be bought by accident.

## The flow

1. **Home.** A famous game draws itself on loop. Choose: play a friend, play the computer, or replay a legend.
2. **Board.** Lines draw under the pieces as you play. "Drawing only" hides the pieces. The ink button recolors the whole game.
3. **Framed.** When the game ends (or you tap Frame it), the pieces fall away and the drawing replays in a print mat. Choose inks and a background (pure, grid or board), download a PNG, or save it to your gallery.
4. **Make it real.** Pick a product. The server sends the drawing to Arcade as a reference image, Arcade designs the pattern, a maker builds the product, and you see the price and maker.

## How a game becomes a drawing

| Move | Mark |
| --- | --- |
| Start | A faint dot on each of the 32 starting squares |
| Any move | A curved line in that piece's ink, from where it stood to where it landed |
| Knight | The line traces its L |
| Capture | A ring around the square |
| Castling | Lines for both king and rook |
| Check | A dashed ring |
| Checkmate | Three rings around the final square |

The same game always draws the same picture, so a famous game makes the same artwork for everyone, and your own games are yours alone.

## Files

| Path | What it is |
| --- | --- |
| `web/drawing.js` | Turns a game into SVG (and PNG for Arcade) |
| `web/app.js` | Screens, board, playback and the Arcade flow |
| `web/classics.js` | Five famous games |
| `web/palettes.js` | Ink sets |
| `web/engine.js`, `web/pieces.js`, `web/vendor/chess.js` | Rules, a small computer opponent and the piece art |
| `server/server.mjs` | Static server plus `/api` for Arcade (simulated or live) |
| `tests/drawing.test.mjs` | `node --test chess-atelier/tests/*.test.mjs` |
