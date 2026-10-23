// Move Lines: a chess match drawn as lines. Each move draws a curved line in its
// piece's ink from where it stood to where it landed (knights trace their L),
// captures leave a ring, castling draws both pieces, promotions and checks are
// marked, and checkmate leaves concentric rings. Pure SVG in board units (0 to 8),
// so the same drawing sits under the pieces, fills the art panel and prints.
import {paletteById} from './marbling.js';
import {inkFor} from './move-art.js';

const at = s => [s.charCodeAt(0) - 97 + 0.5, 8 - Number(s[1]) + 0.5];
const WIDTH = {p: 0.07, n: 0.09, b: 0.09, r: 0.1, q: 0.12, k: 0.1};
const BACK = 'rnbqkbnr';
const r2 = n => Math.round(n * 1000) / 1000;

function curve(from, to, type, i) {
  const [ax, ay] = at(from), [bx, by] = at(to);
  if (type === 'n') {
    // A knight's L, softened through its corner.
    const [cx, cy] = Math.abs(bx - ax) > Math.abs(by - ay) ? [bx, ay] : [ax, by];
    return `M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`;
  }
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const bow = (i % 2 ? 1 : -1) * Math.min(0.55, len * 0.12);
  return `M${ax} ${ay} Q${r2((ax + bx) / 2 - (dy / len) * bow)} ${r2((ay + by) / 2 + (dx / len) * bow)} ${bx} ${by}`;
}

/** Every mark a match leaves, in drawing order. Each has the move index it belongs to (-1 = start). */
export function lineMarks(history) {
  const marks = [];
  for (const [color, back, pawns] of [['w', '1', '2'], ['b', '8', '7']]) {
    [...BACK].forEach((type, f) => { const [cx, cy] = at(String.fromCharCode(97 + f) + back); marks.push({kind: 'origin', cx, cy, ink: inkFor(color, type), i: -1}); });
    for (let f = 0; f < 8; f++) { const [cx, cy] = at(String.fromCharCode(97 + f) + pawns); marks.push({kind: 'origin', cx, cy, ink: inkFor(color, 'p'), i: -1}); }
  }
  history.forEach((m, i) => {
    const ink = inkFor(m.color, m.piece), flags = m.flags || '';
    marks.push({kind: 'path', d: curve(m.from, m.to, m.piece, i), ink, width: WIDTH[m.piece] || 0.08, i});
    if (flags.includes('k') || flags.includes('q')) {
      const rank = m.color === 'w' ? '1' : '8';
      const [rf, rt] = flags.includes('k') ? ['h' + rank, 'f' + rank] : ['a' + rank, 'd' + rank];
      marks.push({kind: 'path', d: curve(rf, rt, 'r', i + 1), ink: inkFor(m.color, 'r'), width: WIDTH.r, i});
    }
    const [cx, cy] = at(m.to);
    marks.push({kind: 'dot', cx, cy, r: 0.09, ink, i});
    if (m.captured) marks.push({kind: 'ring', cx, cy, r: 0.24, ink, width: 0.035, i});
    if (m.promotion) marks.push({kind: 'ring', cx, cy, r: 0.17, ink, width: 0.05, i});
    if (m.san?.endsWith('#')) for (const r of [0.22, 0.36, 0.5]) marks.push({kind: 'ring', cx, cy, r, ink, width: 0.04, i});
    else if (m.san?.endsWith('+')) marks.push({kind: 'ring', cx, cy, r: 0.15, ink, width: 0.025, dash: true, i});
  });
  return marks;
}

/**
 * The drawing as SVG. animate: 'none' (static, for prints), 'last' (only the newest move draws itself),
 * or 'all' (the whole match draws itself, msPerMove apart). Animation classes live in board-studio.css.
 */
export function linesSvg(history, palette, {animate = 'none', msPerMove = 350, paper = true, size} = {}) {
  const p = paletteById(palette), inks = p.inks.map(([, h]) => h), last = history.length - 1;
  const timing = mark => {
    if (animate === 'all') return {cls: mark.kind === 'path' ? 'mv-draw' : 'mv-pop', delay: mark.i < 0 ? 0 : 400 + mark.i * msPerMove + (mark.kind === 'path' ? 0 : msPerMove * 0.7), dur: Math.max(200, msPerMove * 0.9)};
    if (animate === 'last' && mark.i === last && last >= 0) return {cls: mark.kind === 'path' ? 'mv-draw' : 'mv-pop', delay: mark.kind === 'path' ? 0 : 320, dur: 420};
    return null;
  };
  const body = lineMarks(history).map(mark => {
    const t = timing(mark), anim = t ? ` class="${t.cls}" style="animation-delay:${Math.round(t.delay)}ms;animation-duration:${Math.round(t.dur)}ms"` : '';
    const color = inks[mark.ink] || inks[0];
    if (mark.kind === 'origin') return `<circle cx="${mark.cx}" cy="${mark.cy}" r="0.06" fill="${color}" opacity=".45"${anim}/>`;
    if (mark.kind === 'path') return `<path d="${mark.d}" fill="none" stroke="${color}" stroke-width="${mark.width}" stroke-linecap="round" opacity=".88"${t?.cls === 'mv-draw' ? ' pathLength="1"' : ''}${anim}/>`;
    if (mark.kind === 'dot') return `<circle cx="${mark.cx}" cy="${mark.cy}" r="${mark.r}" fill="${color}"${anim}/>`;
    return `<circle cx="${mark.cx}" cy="${mark.cy}" r="${mark.r}" fill="none" stroke="${color}" stroke-width="${mark.width}"${mark.dash ? ' stroke-dasharray=".06 .05"' : ''}${anim}/>`;
  }).join('');
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"${dims} preserveAspectRatio="none">${paper ? `<rect width="8" height="8" fill="${p.paper}"/>` : ''}${body}</svg>`;
}

/** Milliseconds a full 'all' animation takes, so callers can wait for it. */
export const drawDuration = (moves, msPerMove = 350) => 400 + moves * msPerMove + msPerMove;
