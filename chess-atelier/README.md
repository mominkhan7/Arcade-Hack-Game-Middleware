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

1. **Opening page.** Famous games paint themselves on loop, one medium after another. Choose: play a friend, play the computer, or rewatch a famous match.
2. **Make it yours.** Pick the art medium, the board color and the piece colors (presets or any custom color). A live preview repaints with every change, and the pieces on the board take the colors they paint with.
3. **Board.** Every move paints itself under the pieces. "Drawing only" hides the pieces; the color dot reopens the style screen.
4. **Framed.** When the game ends (or you tap Frame it), the painting replays in a print mat. Switch medium, background (pure, grid or board) or colors; download a PNG; it is saved to your gallery.
5. **Make it real.** Pick a silk scarf, linen pillow or pocket square. The server sends the 2048 px painting to Arcade, Arcade designs the pattern, a maker builds it, and you see the price and maker.

## Mediums

| Medium | A move leaves | Captures | Checkmate |
| --- | --- | --- | --- |
| Lines | A curved line, fuller where the piece starts and lands | A ring | Three rings |
| Brush | A tapered calligraphy stroke with dry-brush bristles | Ink splatter | An enso |
| Watercolor | A translucent wash that pools where the piece lingers | A bloom with a backrun | A wide wash and tide line |
| Constellation | Light between stars; a star brightens each visit | A halo | A four-point star |
| String art | A taut thread pin to pin (knights turn on a corner pin) | A loop | Threads to every neighboring pin |

## The physics

- **Motion.** A piece starts at rest, accelerates and settles on its square, so it lingers (and lays down more ink) at both ends and thins at speed. Knights lift off mid-jump.
- **Pigment.** Each side's marks deposit pigment into its own concentration field; marks of one side stack up.
- **Fluid.** Watercolor diffuses through wet paper, gathers at the drying edge, granulates into the paper's grain, and backruns lift it. Brush pigment skips over the grain (dry brush).
- **Optics.** On light boards the two pigments mix subtractively by Kubelka-Munk theory, so blue over yellow reads green and every crossing of the two sides makes a new color. On dark boards marks are light: crossings add up and glow.

The same game and style always make the same picture. `web/paint.js` is the engine; `web/drawing.js` turns moves into marks.

## Files

| Path | What it is |
| --- | --- |
| `web/drawing.js` | Turns a game into marks (and quick SVG thumbnails) |
| `web/paint.js` | The paint engine: pigment, fluid and optics, and the PNG for Arcade |
| `web/app.js` | Screens, board, playback and the Arcade flow |
| `web/classics.js` | Five famous games |
| `web/styles.js` | Boards, piece colors and mediums |
| `web/engine.js`, `web/pieces.js`, `web/vendor/chess.js` | Rules, a small computer opponent and the piece art |
| `server/server.mjs` | Static server plus `/api` for Arcade (simulated or live) |
| `tests/drawing.test.mjs` | `node --test chess-atelier/tests/*.test.mjs` |
