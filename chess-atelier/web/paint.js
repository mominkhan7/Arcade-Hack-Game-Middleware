// The paint engine: turns a game's marks into a physically mixed painting.
//
// 1. Deposition. Each side's marks lay pigment into its own concentration field.
//    Overlapping marks of one side add up, so a square crossed many times is deeper.
// 2. Fluid. Watercolor pigment diffuses through the wet paper, gathers at the drying
//    edge (the dark rim of a real wash), settles into the paper's grain, and
//    backruns lift it. Brush pigment catches on the grain (dry brush). Light glows.
// 3. Optics. On light boards the two pigments mix subtractively by Kubelka-Munk
//    theory, the model paint makers use: blue over yellow reads green, red over
//    teal reads deep brown-grey, and every crossing of the two sides makes a new
//    color. On dark boards marks are light, and crossings add up and glow.
import {layers, timing, gridSvg} from './drawing.js';
import {cleanStyle, inksOf, isDark} from './styles.js';

const GAIN = 3.2;             // pigment concentration of a fully opaque mark, relative to the paper
const MAX_DISPLAY = 600;      // canvas pixels for on-screen paintings

// ---------- Color science ----------

const toLinear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const SRGB = new Uint8ClampedArray(4097);
for (let i = 0; i <= 4096; i++) { const v = i / 4096; SRGB[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); }
const toSrgb = v => SRGB[Math.max(0, Math.min(4096, Math.round(v * 4096)))];
const rgbLinear = hex => [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16)));
/** Absorption over scattering (K/S) of a pigment with reflectance R, per channel. */
const ks = R => { R = Math.min(0.999, Math.max(0.002, R)); return (1 - R) ** 2 / (2 * R); };
/** Reflectance of a layer with absorption over scattering k. */
const reflect = k => 1 + k - Math.sqrt(k * k + 2 * k);

// ---------- Fields ----------

/** Deterministic paper grain, 0 to 1, as smooth value noise. */
const grainCache = new Map();
function grain(size) {
  if (grainCache.has(size)) return grainCache.get(size);
  const G = 96, cells = new Float32Array((G + 1) * (G + 1)), out = new Float32Array(size * size);
  for (let i = 0; i < cells.length; i++) { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; cells[i] = x - Math.floor(x); }
  const fine = new Float32Array((G + 1) * (G + 1));
  for (let i = 0; i < fine.length; i++) { const x = Math.sin(i * 78.233 + 1.7) * 24634.6345; fine[i] = x - Math.floor(x); }
  const sample = (arr, gx, gy) => {
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = arr[y0 * (G + 1) + x0], b = arr[y0 * (G + 1) + x0 + 1], c = arr[(y0 + 1) * (G + 1) + x0], d = arr[(y0 + 1) * (G + 1) + x0 + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = (x / size) * (G / 4), gy = (y / size) * (G / 4), hx = ((x / size) * G) % G, hy = ((y / size) * G) % G;
    out[y * size + x] = 0.6 * sample(cells, gx, gy) + 0.4 * sample(fine, hx, hy);
  }
  grainCache.set(size, out);
  return out;
}

/** In-place blur of a square field: three box passes approximate a Gaussian of the given radius (pixels). */
function blur(field, size, radius) {
  const r = Math.max(1, Math.round(radius / 1.7)), tmp = new Float32Array(field.length);
  const pass = (src, dst, horizontal) => {
    const norm = 1 / (2 * r + 1);
    for (let line = 0; line < size; line++) {
      const at = k => horizontal ? line * size + k : k * size + line;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[at(Math.min(size - 1, Math.max(0, k)))];
      for (let k = 0; k < size; k++) {
        dst[at(k)] = acc * norm;
        acc += src[at(Math.min(size - 1, k + r + 1))] - src[at(Math.max(0, k - r))];
      }
    }
  };
  for (let n = 0; n < 3; n++) { pass(field, tmp, true); pass(tmp, field, false); }
  return field;
}

// ---------- Deposition ----------

const ease = p => 1 - (1 - p) ** 3;
const spring = p => { const c = 1.7; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };

/** Draws one mark, `progress` of the way in, onto a 2D context scaled to board units. */
function trace(ctx, prim, progress) {
  const grow = prim.anim === 'draw' ? progress : 1;
  const fade = prim.anim === 'wash' ? ease(progress) : prim.anim === 'pop' ? Math.min(1, progress * 2.5) : 1;
  ctx.globalAlpha = Math.min(1, prim.alpha * fade);
  switch (prim.shape) {
    case 'band': {
      const n = Math.max(2, Math.ceil(prim.L.length * grow));
      ctx.beginPath(); ctx.moveTo(...prim.L[0]);
      for (let k = 1; k < n; k++) ctx.lineTo(...prim.L[k]);
      for (let k = n - 1; k >= 0; k--) ctx.lineTo(...prim.R[k]);
      ctx.closePath(); ctx.fill();
      return;
    }
    case 'poly':
      ctx.beginPath(); ctx.moveTo(...prim.pts[0]); for (const p of prim.pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
      return;
    case 'line': {
      const lens = [0];
      for (let k = 1; k < prim.pts.length; k++) lens.push(lens[k - 1] + Math.hypot(prim.pts[k][0] - prim.pts[k - 1][0], prim.pts[k][1] - prim.pts[k - 1][1]));
      const stop = lens.at(-1) * grow;
      ctx.lineWidth = prim.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(...prim.pts[0]);
      for (let k = 1; k < prim.pts.length; k++) {
        if (lens[k] <= stop) { ctx.lineTo(...prim.pts[k]); continue; }
        const f = (stop - lens[k - 1]) / (lens[k] - lens[k - 1] || 1);
        ctx.lineTo(prim.pts[k - 1][0] + (prim.pts[k][0] - prim.pts[k - 1][0]) * f, prim.pts[k - 1][1] + (prim.pts[k][1] - prim.pts[k - 1][1]) * f);
        break;
      }
      ctx.stroke();
      return;
    }
    case 'stamps': {
      const n = Math.max(1, Math.ceil(prim.dots.length * grow)), base = ctx.globalAlpha;
      for (let k = 0; k < n; k++) {
        const [x, y, r, o] = prim.dots[k];
        ctx.globalAlpha = Math.min(1, base * o);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    default: {
      const r = prim.r * (prim.anim === 'pop' ? Math.max(0.05, spring(progress)) : 1);
      ctx.beginPath(); ctx.arc(prim.cx, prim.cy, r, 0, Math.PI * 2);
      if (prim.width) { ctx.lineWidth = prim.width; ctx.setLineDash(prim.dash || []); ctx.stroke(); ctx.setLineDash([]); } else ctx.fill();
    }
  }
}

function canvas2d(size) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), {width: size, height: size});
  return c.getContext('2d', {willReadFrequently: true});
}

/**
 * Paints `prims` at `size` pixels into `out` (a 2D context). `progressOf(prim)` returns 0..1
 * (0 = not yet drawn). Returns nothing; the result is in `out`.
 */
function render(out, size, prims, style, grid, progressOf, scratch) {
  const s = cleanStyle(style), inks = inksOf(s), dark = isDark(s.board), scale = size / 8;
  const sides = {w: scratch.w, b: scratch.b};
  for (const ctx of Object.values(sides)) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, size, size);
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = ctx.strokeStyle = '#ffffff';
  }
  const glow = {w: false, b: false}, decor = [];
  for (const prim of prims) {
    const p = progressOf(prim);
    if (p <= 0) continue;
    if (prim.side === 'n') {
      if (prim.shape === 'lift') {
        // A backrun lifts pigment of both sides off the paper.
        for (const ctx of Object.values(sides)) { ctx.globalCompositeOperation = 'destination-out'; trace(ctx, {...prim, shape: 'circle'}, p); ctx.globalCompositeOperation = 'lighter'; }
      } else decor.push([prim, p]);
      continue;
    }
    // Pawns carry a thinner load of their side's pigment.
    trace(sides[prim.side], {...prim, alpha: prim.alpha * prim.w}, p);
    if (prim.glow) glow[prim.side] = true;
  }

  // Fields of pigment concentration, one per side.
  const n = size * size, fields = {};
  for (const side of ['w', 'b']) {
    const data = sides[side].getImageData(0, 0, size, size).data, f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = (data[i * 4 + 3] / 255) * GAIN;
    fields[side] = f;
  }

  // Fluid behavior per medium.
  const paper = grain(size);
  if (s.medium === 'watercolor') {
    for (const f of Object.values(fields)) {
      const wet = blur(Float32Array.from(f), size, size * 0.013), wide = blur(Float32Array.from(f), size, size * 0.035);
      for (let i = 0; i < n; i++) {
        const rim = Math.max(0, wet[i] - wide[i]);                   // pigment carried to the drying edge
        f[i] = (wet[i] * 0.06 + rim * 0.5) * (0.6 + 0.8 * paper[i]);  // a translucent glaze, darker at its edge // settling into the grain (granulation)
      }
    }
  } else if (s.medium === 'brush') {
    for (const f of Object.values(fields)) for (let i = 0; i < n; i++) {
      // Dry brush: a thin load skips over the paper's high points.
      const load = Math.min(1, f[i] / GAIN), keep = Math.min(1, Math.max(0, (load * 1.4 + paper[i] - 0.55) * 3));
      f[i] *= 0.35 + 0.65 * keep;
    }
  } else if (s.medium === 'constellation' || dark) {
    for (const side of ['w', 'b']) if (glow[side] || s.medium === 'constellation') {
      const f = fields[side], halo = blur(Float32Array.from(f), size, size * 0.012);
      for (let i = 0; i < n; i++) f[i] += halo[i] * 1.6;
    }
  }

  // Optics.
  const img = out.createImageData(size, size), px = img.data, P = rgbLinear(inks.paper), A = rgbLinear(s.white), B = rgbLinear(s.black);
  const fw = fields.w, fb = fields.b;
  if (!dark) {
    const kp = P.map(ks), ka = A.map(ks), kb = B.map(ks);
    const paperOut = P.map(toSrgb);
    for (let i = 0; i < n; i++) {
      const cw = fw[i], cb = fb[i], o = i * 4;
      if (cw + cb < 0.002) { px[o] = paperOut[0]; px[o + 1] = paperOut[1]; px[o + 2] = paperOut[2]; px[o + 3] = 255; continue; }
      const total = 1 + cw + cb;
      for (let c = 0; c < 3; c++) px[o + c] = toSrgb(reflect((kp[c] + cw * ka[c] + cb * kb[c]) / total));
      px[o + 3] = 255;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const cw = fw[i] * 0.55, cb = fb[i] * 0.55, o = i * 4;
      for (let c = 0; c < 3; c++) px[o + c] = toSrgb(P[c] + (1 - P[c]) * (1 - Math.exp(-(cw * A[c] + cb * B[c]) * 1.4)));
      px[o + 3] = 255;
    }
  }
  out.putImageData(img, 0, 0);

  // Decoration over the paint: pins, background stars, the grid.
  out.save(); out.setTransform(scale, 0, 0, scale, 0, 0);
  for (const [prim, p] of decor) { out.fillStyle = out.strokeStyle = prim.color; trace(out, prim, p); }
  out.globalAlpha = 1;
  if (grid !== 'none') {
    out.fillStyle = out.strokeStyle = inks.contrast;
    if (grid === 'lines') { out.globalAlpha = 0.09; out.lineWidth = 0.015; out.beginPath(); for (let k = 1; k < 8; k++) { out.moveTo(k, 0); out.lineTo(k, 8); out.moveTo(0, k); out.lineTo(8, k); } out.stroke(); }
    else { out.globalAlpha = 0.05; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) out.fillRect(x, y, 1, 1); }
  }
  out.restore();
}

/** A live painting in a canvas: shows a game still, or animates it move by move. */
export class Painter {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.frame = 0; this.run = 0; this.scratch = null;
  }
  fit() {
    const size = Math.min(MAX_DISPLAY, Math.max(240, Math.round((this.canvas.clientWidth || 360) * Math.min(2, devicePixelRatio || 1))));
    if (this.canvas.width !== size) { this.canvas.width = this.canvas.height = size; this.scratch = null; }
    if (!this.scratch) this.scratch = {w: canvas2d(size), b: canvas2d(size)};
    return size;
  }
  /** Paints a game. animate: 'none', 'last' (the newest move paints itself) or 'all' (the whole game). */
  paint(history, style, {animate = 'none', msPerMove = 350, grid = 'none'} = {}) {
    cancelAnimationFrame(this.frame);
    const run = ++this.run, size = this.fit(), prims = layers(history, style), last = history.length - 1;
    const plan = new Map(prims.map(p => [p, timing(p, {animate, msPerMove, last})]));
    const start = performance.now(), end = Math.max(0, ...[...plan.values()].filter(Boolean).map(t => t.delay + t.dur));
    const frame = now => {
      if (run !== this.run) return;
      const elapsed = now - start;
      render(this.ctx, size, prims, style, grid, p => { const t = plan.get(p); return t ? Math.min(1, Math.max(0, (elapsed - t.delay) / t.dur)) : 1; }, this.scratch);
      if (elapsed < end) this.frame = requestAnimationFrame(frame);
    };
    if (animate === 'none' || !end || matchMedia('(prefers-reduced-motion: reduce)').matches) frame(start + end + 1);
    else frame(start);
  }
  stop() { cancelAnimationFrame(this.frame); this.run++; }
}

/** A painter living in an element, created on first use. */
export function painterIn(el) {
  if (!el._painter) {
    el.innerHTML = '<canvas class="paint" role="img" aria-label="The game, painted by its moves"></canvas>';
    el._painter = new Painter(el.firstChild);
  }
  return el._painter;
}

/** The finished painting as a PNG (base64, no prefix), for Arcade or a download. */
export async function paintingPng(history, style, {grid = 'none', size = 2048} = {}) {
  const ctx = canvas2d(size);
  render(ctx, size, layers(history, style), style, grid, () => 1, {w: canvas2d(size), b: canvas2d(size)});
  const blob = ctx.canvas.convertToBlob ? await ctx.canvas.convertToBlob({type: 'image/png'}) : await new Promise(r => ctx.canvas.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export {gridSvg};

/** One pixel of the light-board optics: paper with concentrations ca of pigment a and cb of pigment b, as sRGB 0-255. */
export function pigmentMix(paper, a, ca, b, cb) {
  const P = rgbLinear(paper).map(ks), A = rgbLinear(a).map(ks), B = rgbLinear(b).map(ks);
  return [0, 1, 2].map(c => toSrgb(reflect((P[c] + ca * A[c] + cb * B[c]) / (1 + ca + cb))));
}
