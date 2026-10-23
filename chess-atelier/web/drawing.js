// A chess game, drawn by its own moves. Every piece starts as a dot on its square;
// each move draws a curved line in that piece's ink from where it stood to where
// it landed. Knights trace their L, captures leave a ring, castling draws king and
// rook, promotions and checks are marked, and checkmate leaves three rings.
// The same game always draws the same picture. Pure SVG in board units (0 to 8).
import {inkOf, isDark} from './palettes.js';

const at = s => [s.charCodeAt(0) - 97 + 0.5, 8 - Number(s[1]) + 0.5];
const WIDTH = {p: 0.07, n: 0.09, b: 0.09, r: 0.1, q: 0.12, k: 0.1};
const BACK = 'rnbqkbnr';
const r3 = n => Math.round(n * 1000) / 1000;

function curve(from, to, type, i) {
  const [ax, ay] = at(from), [bx, by] = at(to);
  if (type === 'n') {
    // A knight's L, softened through its corner.
    const [cx, cy] = Math.abs(bx - ax) > Math.abs(by - ay) ? [bx, ay] : [ax, by];
    return `M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`;
  }
  // Everything else bows slightly, alternating sides, so repeated moves stay readable.
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const bow = (i % 2 ? 1 : -1) * Math.min(0.55, len * 0.12);
  return `M${ax} ${ay} Q${r3((ax + bx) / 2 - (dy / len) * bow)} ${r3((ay + by) / 2 + (dx / len) * bow)} ${bx} ${by}`;
}

/** Every mark a game leaves, in drawing order. `i` is the move it belongs to (-1 = the start). */
export function marks(history) {
  const out = [];
  for (const [color, back, pawns] of [['w', '1', '2'], ['b', '8', '7']]) {
    [...BACK].forEach((type, f) => { const [cx, cy] = at(String.fromCharCode(97 + f) + back); out.push({kind: 'origin', cx, cy, color, type, i: -1}); });
    for (let f = 0; f < 8; f++) { const [cx, cy] = at(String.fromCharCode(97 + f) + pawns); out.push({kind: 'origin', cx, cy, color, type: 'p', i: -1}); }
  }
  history.forEach((m, i) => {
    const {color, piece: type} = m, flags = m.flags || '';
    out.push({kind: 'path', d: curve(m.from, m.to, type, i), color, type, width: WIDTH[type], i});
    if (flags.includes('k') || flags.includes('q')) {
      const rank = color === 'w' ? '1' : '8';
      const [rf, rt] = flags.includes('k') ? ['h' + rank, 'f' + rank] : ['a' + rank, 'd' + rank];
      out.push({kind: 'path', d: curve(rf, rt, 'r', i + 1), color, type: 'r', width: WIDTH.r, i});
    }
    const [cx, cy] = at(m.to);
    out.push({kind: 'dot', cx, cy, r: 0.09, color, type, i});
    if (m.captured) out.push({kind: 'ring', cx, cy, r: 0.24, color, type, width: 0.035, i});
    if (m.promotion) out.push({kind: 'ring', cx, cy, r: 0.17, color, type: 'q', width: 0.05, i});
    if (m.san?.endsWith('#')) for (const r of [0.22, 0.36, 0.5]) out.push({kind: 'ring', cx, cy, r, color, type: 'k', width: 0.04, i});
    else if (m.san?.endsWith('+')) out.push({kind: 'ring', cx, cy, r: 0.15, color, type, width: 0.025, dash: true, i});
  });
  return out;
}

function gridSvg(palette, grid) {
  if (grid === 'none') return '';
  const line = isDark(palette) ? '#ffffff' : '#000000';
  if (grid === 'lines') {
    let d = '';
    for (let k = 1; k < 8; k++) d += `M${k} 0V8M0 ${k}H8`;
    return `<path d="${d}" stroke="${line}" stroke-opacity=".09" stroke-width=".015" fill="none"/>`;
  }
  let squares = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) squares += `M${x} ${y}h1v1h-1z`;
  return `<path d="${squares}" fill="${line}" fill-opacity="${isDark(palette) ? '.05' : '.045'}"/>`;
}

/**
 * The drawing as SVG.
 * animate: 'none' (still), 'last' (only the newest move draws itself) or 'all' (the whole game draws itself).
 * grid: 'none' (pure art), 'lines' (a faint 8x8 grid) or 'board' (faint checkerboard).
 */
export function drawingSvg(history, palette, {animate = 'none', msPerMove = 350, grid = 'none', paper = true, size} = {}) {
  const last = history.length - 1;
  const timing = mark => {
    if (animate === 'all') return {cls: mark.kind === 'path' ? 'draw' : 'pop', delay: mark.i < 0 ? 0 : 400 + mark.i * msPerMove + (mark.kind === 'path' ? 0 : msPerMove * 0.7), dur: Math.max(220, msPerMove * 0.9)};
    if (animate === 'last' && last >= 0 && mark.i === last) return {cls: mark.kind === 'path' ? 'draw' : 'pop', delay: mark.kind === 'path' ? 0 : 320, dur: 420};
    return null;
  };
  const body = marks(history).map(mark => {
    const t = timing(mark), anim = t ? ` class="${t.cls}" style="animation-delay:${Math.round(t.delay)}ms;animation-duration:${Math.round(t.dur)}ms"` : '';
    const ink = inkOf(palette, mark.color, mark.type);
    if (mark.kind === 'origin') return `<circle cx="${mark.cx}" cy="${mark.cy}" r=".06" fill="${ink}" opacity=".45"${anim}/>`;
    if (mark.kind === 'path') return `<path d="${mark.d}" fill="none" stroke="${ink}" stroke-width="${mark.width}" stroke-linecap="round" opacity=".88"${t?.cls === 'draw' ? ' pathLength="1"' : ''}${anim}/>`;
    if (mark.kind === 'dot') return `<circle cx="${mark.cx}" cy="${mark.cy}" r="${mark.r}" fill="${ink}"${anim}/>`;
    return `<circle cx="${mark.cx}" cy="${mark.cy}" r="${mark.r}" fill="none" stroke="${ink}" stroke-width="${mark.width}"${mark.dash ? ' stroke-dasharray=".06 .05"' : ''}${anim}/>`;
  }).join('');
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"${dims}>${paper ? `<rect width="8" height="8" fill="${palette.paper}"/>` : ''}${gridSvg(palette, grid)}${body}</svg>`;
}

/** How long an 'all' animation takes, in milliseconds. */
export const drawDuration = (moves, msPerMove = 350) => 400 + moves * msPerMove + msPerMove;

/** A pace that fits any game into about `seconds`. */
export const paceFor = (moves, seconds = 6) => Math.max(60, Math.min(420, (seconds * 1000 - 800) / Math.max(1, moves)));

/** The finished drawing as a PNG (base64, no prefix), for Arcade or a download. Browser only. */
export async function drawingPng(history, palette, {grid = 'none', size = 2048} = {}) {
  const svg = drawingSvg(history, palette, {grid, size});
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').drawImage(img, 0, 0, size, size);
  return canvas.toDataURL('image/png').split(',')[1];
}
