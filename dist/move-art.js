// Move Art: a chess match, painted by its own moves.
// Every piece starts as a drop of ink on its square. Each move drags that piece's
// ink along its exact path (knights take their L), captures splash, castling moves
// both ink trails, promotions bloom, and checkmate blooms where it ends. The same
// game always paints the same picture; no two games paint alike.
import {MarbleRenderer, paletteById, renderImage, nextFrame} from './marbling.js';

const at = s => [(s.charCodeAt(0) - 97 + 0.5) / 8, (8 - Number(s[1]) + 0.5) / 8];
const REACH = {p: 0.045, n: 0.05, b: 0.055, r: 0.055, q: 0.065, k: 0.05};
const STEP = 0.025;
const BACK = 'rnbqkbnr';
/** Which palette ink a piece paints with: white pieces and pawns, black pieces and pawns. */
export const inkFor = (color, type) => color === 'w' ? (type === 'p' ? 2 : 1) : (type === 'p' ? 3 : 0);
const SPLASH = 4;

const drop = (square, r, ink) => { const [x, y] = at(square); return {kind: 'drop', x, y, r, ink}; };

function trail(from, to, type) {
  const [ax, ay] = at(from), [bx, by] = at(to);
  // Knights travel their L: the long leg first, then the short one.
  const points = type === 'n'
    ? (Math.abs(bx - ax) > Math.abs(by - ay) ? [[ax, ay], [bx, ay], [bx, by]] : [[ax, ay], [ax, by], [bx, by]])
    : [[ax, ay], [bx, by]];
  const ops = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i], steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / STEP));
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps, t1 = (k + 1) / steps;
      ops.push({kind: 'swirl', ax: x0 + (x1 - x0) * t0, ay: y0 + (y1 - y0) * t0, bx: x0 + (x1 - x0) * t1, by: y0 + (y1 - y0) * t1, reach: REACH[type] || 0.05});
    }
  }
  return ops;
}

/** The starting position, as ink: back ranks first, then pawns. */
export function startOps() {
  const ops = [];
  for (const [color, back, pawns] of [['w', '1', '2'], ['b', '8', '7']]) {
    [...BACK].forEach((type, f) => ops.push(drop(String.fromCharCode(97 + f) + back, 0.038, inkFor(color, type))));
    for (let f = 0; f < 8; f++) ops.push(drop(String.fromCharCode(97 + f) + pawns, 0.03, inkFor(color, 'p')));
  }
  return ops;
}

/** One move (chess.js verbose move), as ink. */
export function moveOps(m) {
  const ops = [], flags = m.flags || '';
  if (m.captured) {
    const victim = flags.includes('e') ? m.to[0] + m.from[1] : m.to;
    ops.push(drop(victim, 0.022, SPLASH));
  }
  ops.push(...trail(m.from, m.to, m.piece));
  if (flags.includes('k') || flags.includes('q')) {
    const rank = m.color === 'w' ? '1' : '8';
    ops.push(...(flags.includes('k') ? trail('h' + rank, 'f' + rank, 'r') : trail('a' + rank, 'd' + rank, 'r')));
  }
  if (m.promotion) ops.push(drop(m.to, 0.05, inkFor(m.color, 'q')));
  if (m.san?.endsWith('#')) ops.push(drop(m.to, 0.075, inkFor(m.color, 'k')), drop(m.to, 0.026, SPLASH));
  else if (m.san?.endsWith('+')) ops.push(drop(m.to, 0.014, SPLASH));
  return ops;
}

export function gameOps(history) {
  return [startOps(), ...history.map(moveOps)].flat();
}

/** A live painting of a match, drawn into any number of canvases. */
export class MoveArt {
  constructor(palette) {
    this.palette = paletteById(palette);
    this.ops = []; this.sans = []; this.views = new Set(); this.run = 0; this.queued = false; this.busy = Promise.resolve();
  }
  attach(canvas) {
    const view = new MarbleRenderer(canvas);
    this.views.add(view); this.draw();
    return view;
  }
  setPalette(palette) { this.palette = paletteById(palette); this.draw(); }
  draw() {
    if (this.queued) return;
    this.queued = true;
    nextFrame(() => {
      this.queued = false;
      for (const view of this.views) { view.resize(); view.draw(this.ops, this.palette); }
    });
  }
  /** Shows a match instantly. */
  rebuild(history) {
    this.run++;
    this.ops = gameOps(history); this.sans = history.map(m => m.san);
    this.draw();
  }
  /** Follows a game as it's played: a new move paints itself, anything else redraws at once. */
  sync(history, {animate = true} = {}) {
    const sans = history.map(m => m.san);
    const extends1 = sans.length === this.sans.length + 1 && this.sans.every((s, i) => s === sans[i]);
    if (!this.ops.length || !animate || !extends1) { if (sans.join() !== this.sans.join() || !this.ops.length) this.rebuild(history); return; }
    this.sans = sans;
    const run = this.run;
    this.busy = this.busy.then(() => run === this.run && this.paint(moveOps(history.at(-1)), 420, run));
  }
  /** Repaints a whole match from the first drop, so it can be watched. */
  async replay(history, {msPerMove = 380} = {}) {
    const run = ++this.run;
    this.ops = []; this.sans = []; this.draw();
    await this.paint(startOps(), 600, run);
    for (const m of history) {
      if (run !== this.run) return false;
      await this.paint(moveOps(m), msPerMove, run);
      this.sans.push(m.san);
    }
    return run === this.run;
  }
  async paint(ops, ms, run) {
    const frames = Math.max(1, Math.round(ms / 16)), per = Math.ceil(ops.length / frames);
    for (let i = 0; i < ops.length; i += per) {
      if (run !== this.run) return;
      this.ops.push(...ops.slice(i, i + per)); this.draw();
      await new Promise(r => nextFrame(r));
    }
  }
  image(size = 1024, type = 'image/jpeg') { return renderImage(this.ops, this.palette, size, type, 0.9); }
}

/** Famous games for a quick demo: they play themselves and paint as they go. */
export const CLASSICS = [
  {id: 'opera', name: 'The Opera Game', detail: 'Morphy, Paris 1858 · 17 moves',
    pgn: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#'},
  {id: 'immortal', name: 'The Immortal Game', detail: 'Anderssen, London 1851 · 23 moves',
    pgn: '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#'},
  {id: 'scholar', name: 'Scholar’s Mate', detail: 'The four-move classic',
    pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#'},
];
