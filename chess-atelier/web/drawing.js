// A chess game, drawn by its own moves. Every medium reads the same record:
// each piece starts on its square, each move travels from where it stood to
// where it landed (knights take their L), captures, castling, checks and
// checkmate are marked. Only the marks change: lines, brush strokes, watercolor,
// stars or threads.
//
// Movement is physical: a piece starts at rest, accelerates and settles on its
// square, so it lingers (and lays down more ink) at both ends and thins out at
// speed. Knights lift off mid-jump. Marks are emitted as primitives in board
// units (0 to 8) with the side whose pigment they carry; paint.js mixes those
// pigments physically, and drawingSvg() gives a quick vector approximation for
// thumbnails. The same game and style always make the same picture.
import {inksOf, inkOf, isDark, cleanStyle, mix} from './styles.js';

const at = s => [s.charCodeAt(0) - 97 + 0.5, 8 - Number(s[1]) + 0.5];
const BACK = 'rnbqkbnr';
const r3 = n => Math.round(n * 1000) / 1000;
/** Deterministic noise in [0, 1). */
export const rnd = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };

// ---------- The record ----------

/** A move's path as a quadratic curve {a, c, b}. Knights bend through their corner; others bow slightly. */
function travel(from, to, type, i) {
  const a = at(from), b = at(to);
  if (type === 'n') return {a, c: Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? [b[0], a[1]] : [a[0], b[1]], b, knight: true};
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, bow = (i % 2 ? 1 : -1) * Math.min(0.55, len * 0.12);
  return {a, c: [(a[0] + b[0]) / 2 - (dy / len) * bow, (a[1] + b[1]) / 2 + (dx / len) * bow], b};
}
const qpt = (g, u) => [0, 1].map(k => (1 - u) ** 2 * g.a[k] + 2 * (1 - u) * u * g.c[k] + u * u * g.b[k]);
const qdir = (g, u) => { const d = [0, 1].map(k => 2 * (1 - u) * (g.c[k] - g.a[k]) + 2 * u * (g.b[k] - g.c[k])); return Math.hypot(...d) > 1e-6 ? d : [g.b[0] - g.a[0], g.b[1] - g.a[1]]; };

/**
 * The motion of a piece along its path, sampled at even steps of time. Position follows
 * smoothstep in time (at rest, accelerate, settle), so `v` (0 at rest, 1 at top speed) is
 * low at both ends. `lift` is how far a jumping knight is off the board (0 to 1).
 */
export function motion(g, steps = 36) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, u = t * t * (3 - 2 * t), v = 4 * t * (1 - t), [x, y] = qpt(g, u), [dx, dy] = qdir(g, u);
    out.push({x, y, dx, dy, v, t, lift: g.knight ? Math.sin(Math.PI * t) ** 2 : 0});
  }
  return out;
}

/** A filled band along samples, its width set per sample. */
function band(samples, widthAt, offset = 0) {
  const L = [], R = [];
  samples.forEach((s, k) => {
    const len = Math.hypot(s.dx, s.dy) || 1, nx = -s.dy / len, ny = s.dx / len, hw = Math.max(0.002, widthAt(s, k) / 2);
    const cx = s.x + nx * offset, cy = s.y + ny * offset;
    L.push([cx + nx * hw, cy + ny * hw]); R.push([cx - nx * hw, cy - ny * hw]);
  });
  return {L, R};
}

/** The game as drawable events: the 32 starting squares, then one event per move. */
export function record(history) {
  const starts = [];
  for (const [color, back, pawns] of [['w', '1', '2'], ['b', '8', '7']]) {
    [...BACK].forEach((type, f) => starts.push({color, type, at: at(String.fromCharCode(97 + f) + back)}));
    for (let f = 0; f < 8; f++) starts.push({color, type: 'p', at: at(String.fromCharCode(97 + f) + pawns)});
  }
  const moves = history.map((m, i) => {
    const flags = m.flags || '', paths = [travel(m.from, m.to, m.piece, i)];
    if (flags.includes('k') || flags.includes('q')) {
      const rank = m.color === 'w' ? '1' : '8';
      paths.push({...travel(flags.includes('k') ? 'h' + rank : 'a' + rank, flags.includes('k') ? 'f' + rank : 'd' + rank, 'r', i + 1), rook: true});
    }
    return {i, color: m.color, type: m.piece, paths, to: at(m.to), captured: !!m.captured, promotion: !!m.promotion,
      mate: !!m.san?.endsWith('#'), check: !!m.san?.endsWith('+')};
  });
  return {starts, moves};
}

// ---------- Primitives ----------
// {i, kind, anim, side, w, alpha, shape, ...}
//   side: 'w' or 'b' (whose pigment), or 'n' (neutral decoration in `color`, drawn over the paint)
//   w: pigment strength (pawns carry a thinner load of their side's pigment)
//   anim: 'draw' (grows along its length), 'pop' (springs in) or 'wash' (fades in)
//   shape: 'band' {L, R} · 'line' {pts, width} · 'circle' {cx, cy, r, width?, dash?} · 'stamps' {dots: [[x, y, r, a]]} · 'poly' {pts} · 'lift' {cx, cy, r}

const LOAD = type => type === 'p' ? 0.55 : 1;
const P = (i, kind, anim, side, w, alpha, shape) => ({i, kind, anim, side, w, alpha, ...shape});

function lines({starts, moves}) {
  const W = {p: 0.07, n: 0.09, b: 0.09, r: 0.1, q: 0.12, k: 0.1}, out = [];
  for (const s of starts) out.push(P(-1, 'origin', 'pop', s.color, LOAD(s.type), 0.45, {shape: 'circle', cx: s.at[0], cy: s.at[1], r: 0.06}));
  for (const m of moves) {
    const [x, y] = m.to, w = LOAD(m.type);
    for (const g of m.paths) {
      const base = g.rook ? W.r : W[m.type];
      // Slow ends lay down a fuller line; speed and a knight's jump thin it.
      out.push(P(m.i, 'path', 'draw', m.color, g.rook ? 1 : w, 0.88, {shape: 'band', ...band(motion(g), s => base * (1.15 - 0.45 * s.v) * (1 - 0.7 * s.lift))}));
    }
    out.push(P(m.i, 'dot', 'pop', m.color, w, 1, {shape: 'circle', cx: x, cy: y, r: 0.09}));
    const ring = (r, width, dash) => out.push(P(m.i, 'ring', 'pop', m.color, w, 0.9, {shape: 'circle', cx: x, cy: y, r, width, dash}));
    if (m.captured) ring(0.24, 0.035);
    if (m.promotion) ring(0.17, 0.05);
    if (m.mate) for (const r of [0.22, 0.36, 0.5]) ring(r, 0.04);
    else if (m.check) ring(0.15, 0.025, [0.06, 0.05]);
  }
  return out;
}

function brush({starts, moves}) {
  const W = {p: 0.15, n: 0.19, b: 0.19, r: 0.21, q: 0.25, k: 0.21}, out = [];
  for (const s of starts) out.push(P(-1, 'origin', 'pop', s.color, LOAD(s.type), 0.32, {shape: 'circle', cx: s.at[0], cy: s.at[1], r: 0.05}));
  for (const m of moves) {
    const [x, y] = m.to, w = LOAD(m.type);
    m.paths.forEach((g, p) => {
      const base = g.rook ? W.r : W[m.type], seed = m.i * 7 + p, steps = motion(g, 40);
      // A loaded brush presses down, swells while slow, runs thin at speed and lifts off at the end.
      const profile = (s, k, scale = 1, lift = 0.92) => {
        const press = Math.min(1, s.t / 0.08 + 0.25), fall = 1 - s.t ** 2.6 * lift, wobble = 1 + (rnd(seed, k) - 0.5) * 0.22;
        return base * scale * press * fall * wobble * (1.1 - 0.35 * s.v) * (1 - 0.8 * s.lift);
      };
      out.push(P(m.i, 'stroke', 'draw', m.color, g.rook ? 1 : w, 0.9, {shape: 'band', ...band(steps, (s, k) => profile(s, k))}));
      out.push(P(m.i, 'bristle', 'draw', m.color, g.rook ? 1 : w, 0.45, {shape: 'band', ...band(steps.slice(0, 33), (s, k) => profile(s, k + 50, 0.24, 1), base * 0.3)}));
      out.push(P(m.i, 'bristle', 'draw', m.color, g.rook ? 1 : w, 0.4, {shape: 'band', ...band(steps.slice(0, 30), (s, k) => profile(s, k + 90, 0.2, 1), -base * 0.26)}));
    });
    if (m.captured) {
      const dots = Array.from({length: 7}, (_, k) => { const ang = rnd(m.i, k) * Math.PI * 2, d = 0.16 + rnd(m.i, k + 9) * 0.24;
        return [x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0.018 + rnd(m.i, k + 17) * 0.04, 0.8]; });
      out.push(P(m.i, 'splatter', 'pop', m.color, w, 1, {shape: 'stamps', dots}));
    }
    if (m.promotion) out.push(P(m.i, 'dab', 'pop', m.color, w, 0.55, {shape: 'circle', cx: x, cy: y, r: 0.13}));
    if (m.mate) {
      // An enso: one unbroken brush circle around the final square.
      const R = 0.46, a0 = rnd(m.i, 1) * Math.PI * 2, span = Math.PI * 1.82, n = 60;
      const ring = Array.from({length: n + 1}, (_, k) => { const t = k / n, a = a0 + t * span; return {x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, dx: -Math.sin(a), dy: Math.cos(a), t, v: 0.5, lift: 0}; });
      out.push(P(m.i, 'enso', 'draw', m.color, 1, 0.92, {shape: 'band', ...band(ring, (s, k) => 0.15 * Math.min(1, s.t / 0.06 + 0.3) * (1 - s.t ** 2.4 * 0.85) * (1 + (rnd(m.i + 40, k) - 0.5) * 0.2))}));
    } else if (m.check) out.push(P(m.i, 'dab', 'pop', m.color, w, 0.7, {shape: 'circle', cx: x, cy: y, r: 0.07}));
  }
  return out;
}

function watercolor({starts, moves}) {
  const W = {p: 0.13, n: 0.16, b: 0.16, r: 0.17, q: 0.2, k: 0.17}, out = [];
  for (const s of starts) out.push(P(-1, 'origin', 'pop', s.color, LOAD(s.type), 0.14, {shape: 'circle', cx: s.at[0], cy: s.at[1], r: 0.1}));
  for (const m of moves) {
    const [x, y] = m.to, w = LOAD(m.type);
    for (const g of m.paths) {
      const base = g.rook ? W.r : W[m.type], steps = motion(g, 30), STEP = 0.025, dots = [];
      // The brush deposits water and pigment in proportion to how long it lingers: slow ends pool, speed streaks.
      // Deposits are laid every STEP of distance, so the wash is continuous however fast the piece moves.
      for (let k = 1; k < steps.length; k++) {
        const s0 = steps[k - 1], s1 = steps[k], n = Math.max(1, Math.ceil(Math.hypot(s1.x - s0.x, s1.y - s0.y) / STEP));
        for (let j = 0; j < n; j++) {
          const f = j / n, v = s0.v + (s1.v - s0.v) * f, lift = s0.lift + (s1.lift - s0.lift) * f, dwell = 1 / n;
          dots.push([s0.x + (s1.x - s0.x) * f, s0.y + (s1.y - s0.y) * f, base * (0.85 + 0.6 * (1 - v)) * (1 - 0.6 * lift), Math.min(0.4, (0.016 + 0.028 * (1 - v) + 0.05 * dwell) * (1 - 0.7 * lift))]);
        }
      }
      out.push(P(m.i, 'wash', 'draw', m.color, g.rook ? 1 : w, 1, {shape: 'stamps', dots}));
      out.push(P(m.i, 'pigment', 'draw', m.color, g.rook ? 1 : w, 0.38, {shape: 'line', pts: steps.map(s => [s.x, s.y]), width: 0.026}));
    }
    out.push(P(m.i, 'pool', 'wash', m.color, w, 0.3, {shape: 'circle', cx: x, cy: y, r: 0.24}));
    if (m.captured) {
      // A bloom: fresh water pushes pigment outward and lifts it from the middle (a backrun).
      out.push(P(m.i, 'bloom', 'wash', m.color, w, 0.2, {shape: 'circle', cx: x, cy: y, r: 0.44}));
      out.push(P(m.i, 'backrun', 'wash', 'n', 1, 0.45, {shape: 'lift', cx: x + 0.05, cy: y - 0.04, r: 0.19}));
    }
    if (m.promotion) out.push(P(m.i, 'bloom', 'wash', m.color, w, 0.24, {shape: 'circle', cx: x, cy: y, r: 0.36}));
    if (m.mate) {
      out.push(P(m.i, 'bloom', 'wash', m.color, 1, 0.24, {shape: 'circle', cx: x, cy: y, r: 0.78}));
      out.push(P(m.i, 'tideline', 'wash', m.color, 1, 0.45, {shape: 'circle', cx: x, cy: y, r: 0.5, width: 0.05}));
    }
  }
  return out;
}

function constellation({starts, moves}, inks) {
  const out = [], visits = new Map();
  // Faint background stars, the same for every game.
  for (let k = 0; k < 90; k++) out.push(P(-2, 'dust', 'none', 'n', 1, r3(0.12 + rnd(k, 4) * 0.3), {shape: 'circle', cx: r3(rnd(k, 1) * 8), cy: r3(rnd(k, 2) * 8), r: r3(0.006 + rnd(k, 3) * 0.014), color: inks.contrast}));
  for (const s of starts) out.push(P(-1, 'origin', 'pop', s.color, LOAD(s.type), 0.6, {shape: 'circle', cx: s.at[0], cy: s.at[1], r: 0.035, glow: true}));
  for (const m of moves) {
    const [x, y] = m.to, w = LOAD(m.type), key = `${x},${y}`;
    visits.set(key, (visits.get(key) || 0) + 1);
    for (const g of m.paths) out.push(P(m.i, 'line', 'draw', m.color, g.rook ? 1 : w, 0.55, {shape: 'line', pts: [g.a, g.b], width: 0.018}));
    // A star grows brighter each time a piece lands on it.
    out.push(P(m.i, 'star', 'pop', m.color, w, 1, {shape: 'circle', cx: x, cy: y, r: 0.045 + 0.014 * Math.min(visits.get(key), 6), glow: true}));
    if (m.captured) out.push(P(m.i, 'halo', 'pop', m.color, w, 0.6, {shape: 'circle', cx: x, cy: y, r: 0.15, width: 0.012}));
    if (m.check) out.push(P(m.i, 'halo', 'pop', m.color, w, 0.6, {shape: 'circle', cx: x, cy: y, r: 0.2, width: 0.01, dash: [0.03, 0.05]}));
    if (m.mate || m.promotion) {
      const s = m.mate ? 0.55 : 0.3, n = 48;
      const pts = Array.from({length: n}, (_, k) => { const a = (k / n) * Math.PI * 2, r = s * (0.14 + 0.86 * Math.abs(Math.cos(2 * a)) ** 6); return [x + Math.sin(a) * r, y - Math.cos(a) * r]; });
      out.push(P(m.i, 'sparkle', 'pop', m.color, 1, 1, {shape: 'poly', pts, glow: true}));
    }
  }
  return out;
}

function stringArt({starts, moves}, inks) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) out.push(P(-2, 'pin', 'none', 'n', 1, 1, {shape: 'circle', cx: c + 0.5, cy: r + 0.5, r: 0.032, color: mix(inks.paper, inks.contrast, 0.45)}));
  for (const s of starts) out.push(P(-1, 'knot', 'pop', s.color, LOAD(s.type), 0.8, {shape: 'circle', cx: s.at[0], cy: s.at[1], r: 0.05}));
  const thread = (m, w, pts) => out.push(P(m.i, 'thread', 'draw', m.color, w, 0.85, {shape: 'line', pts, width: 0.014}));
  const loop = (m, w, r) => out.push(P(m.i, 'loop', 'pop', m.color, w, 0.9, {shape: 'circle', cx: m.to[0], cy: m.to[1], r, width: 0.014}));
  for (const m of moves) {
    const w = LOAD(m.type);
    // Threads run taut from pin to pin; a knight's thread turns on the pin at its corner.
    for (const g of m.paths) thread(m, g.rook ? 1 : w, g.knight ? [g.a, g.c, g.b] : [g.a, g.b]);
    if (m.captured) loop(m, w, 0.085);
    if (m.promotion) { loop(m, w, 0.1); loop(m, w, 0.14); }
    if (m.check) loop(m, w, 0.06);
    if (m.mate) {
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        const tx = m.to[0] + dx, ty = m.to[1] + dy;
        if (tx > 0 && tx < 8 && ty > 0 && ty < 8) thread(m, 1, [m.to, [tx, ty]]);
      }
      loop(m, 1, 0.12);
    }
  }
  return out;
}

const MEDIA = {lines, brush, watercolor, constellation, string: stringArt};

/** Every mark a game leaves in a style, in drawing order. `i` is the move it belongs to (-1 = the start, -2 = decoration). */
export function layers(history, style) {
  const s = cleanStyle(style);
  return MEDIA[s.medium](record(history), inksOf(s));
}

/** When each mark starts and how long it takes, for an animation. */
export function timing(prim, {animate, msPerMove, last}) {
  if (prim.anim === 'none') return null;
  if (animate === 'all') {
    const late = prim.anim === 'pop' || prim.kind === 'pool' || prim.kind === 'bloom' || prim.kind === 'backrun' || prim.kind === 'tideline';
    return {delay: prim.i < 0 ? 0 : 400 + prim.i * msPerMove + (late ? msPerMove * 0.7 : 0), dur: Math.max(220, msPerMove * (prim.anim === 'wash' ? 1.3 : 0.9))};
  }
  if (animate === 'last' && last >= 0 && prim.i === last) return {delay: prim.anim === 'pop' ? 320 : 0, dur: prim.anim === 'wash' ? 650 : 480};
  return null;
}

// ---------- Vector approximation (thumbnails) ----------

const fmt = pts => pts.map(([x, y]) => `${r3(x)} ${r3(y)}`).join('L');

function primSvg(p, inks, attrs = '') {
  const color = p.side === 'n' ? p.color : inkOf(inks, p.side, p.w < 1 ? 'p' : 'k'), a = r3(p.alpha);
  switch (p.shape) {
    case 'band': return `<path d="M${fmt(p.L)}L${fmt([...p.R].reverse())}Z" fill="${color}" opacity="${a}"${attrs}/>`;
    case 'poly': return `<path d="M${fmt(p.pts)}Z" fill="${color}" opacity="${a}"${attrs}/>`;
    case 'line': return `<path d="M${fmt(p.pts)}" fill="none" stroke="${color}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${a}"${attrs}/>`;
    case 'stamps': return `<g opacity="${a}"${attrs}>${p.dots.map(([x, y, r, o]) => `<circle cx="${r3(x)}" cy="${r3(y)}" r="${r3(r)}" fill="${color}" opacity="${r3(Math.min(1, o * 2.2))}"/>`).join('')}</g>`;
    case 'lift': return `<circle cx="${r3(p.cx)}" cy="${r3(p.cy)}" r="${p.r}" fill="${inks.paper}" opacity="${a}"${attrs}/>`;
    default: return p.width
      ? `<circle cx="${r3(p.cx)}" cy="${r3(p.cy)}" r="${r3(p.r)}" fill="none" stroke="${color}" stroke-width="${p.width}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''} opacity="${a}"${attrs}/>`
      : `<circle cx="${r3(p.cx)}" cy="${r3(p.cy)}" r="${r3(p.r)}" fill="${color}" opacity="${a}"${attrs}/>`;
  }
}

export function gridSvg(inks, grid) {
  if (grid === 'none') return '';
  if (grid === 'lines') {
    let d = '';
    for (let k = 1; k < 8; k++) d += `M${k} 0V8M0 ${k}H8`;
    return `<path d="${d}" stroke="${inks.contrast}" stroke-opacity=".09" stroke-width=".015" fill="none"/>`;
  }
  let squares = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) squares += `M${x} ${y}h1v1h-1z`;
  return `<path d="${squares}" fill="${inks.contrast}" fill-opacity=".05"/>`;
}

/**
 * A quick vector drawing, used for thumbnails. Overlaps blend with multiply on light
 * paper and screen on dark, a cheap stand-in for the pigment physics in paint.js.
 */
export function drawingSvg(history, style, {grid = 'none', paper = true, size} = {}) {
  const s = cleanStyle(style), inks = inksOf(s), prims = layers(history, s), dark = isDark(s.board);
  const decor = prims.filter(p => p.side === 'n' && p.shape !== 'lift').map(p => primSvg(p, inks)).join('');
  const paint = prims.filter(p => p.side !== 'n' || p.shape === 'lift').map(p => primSvg(p, inks)).join('');
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"${dims}>${paper ? `<rect width="8" height="8" fill="${inks.paper}"/>` : ''}`
    + `${gridSvg(inks, grid)}${decor}<g style="mix-blend-mode:${dark ? 'screen' : 'multiply'}">${paint}</g></svg>`;
}

/** How long an 'all' animation takes, in milliseconds. */
export const drawDuration = (moves, msPerMove = 350) => 400 + moves * msPerMove + msPerMove * 1.4;

/** A pace that fits any game into about `seconds`. */
export const paceFor = (moves, seconds = 6) => Math.max(60, Math.min(420, (seconds * 1000 - 800) / Math.max(1, moves)));
