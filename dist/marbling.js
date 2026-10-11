// Ink & Water marbling, as a module any Nexus game can use.
// The water stores operations, not pixels: ink drops, finger swirls and combs.
// Each pixel walks the operations backwards to find which ink it came from
// (Jaffer, "Mathematical Marbling"). Same math as ink-and-water/ (Metal and WebGL).

export const PALETTES = [
  {id: 'atelier', name: 'Atelier', paper: '#EFE4CF', inks: [['Espresso', '#3A2A22'], ['Terracotta', '#A65A44'], ['Brass', '#C9A45C'], ['Sage', '#7D8C6E'], ['Ivory', '#F8F1E2']]},
  {id: 'harbor', name: 'Harbor', paper: '#F4EFE6', inks: [['Indigo', '#1F3A5F'], ['Terracotta', '#C8553D'], ['Saffron', '#E9C46A'], ['Teal', '#2A9D8F'], ['Cream', '#F7F3EA']]},
  {id: 'lapis', name: 'Lapis & Gold', paper: '#F3EEE2', inks: [['Lapis', '#1C3F8C'], ['Gold', '#D4A63A'], ['Navy', '#14213D'], ['Sky', '#8FB3E0'], ['Bone', '#FAF6EC']]},
  {id: 'verdigris', name: 'Verdigris', paper: '#EEF1EA', inks: [['Patina', '#4E9A8A'], ['Copper', '#B5653A'], ['Bronze', '#7A5A2E'], ['Mint', '#A9D3C2'], ['Chalk', '#F7F7F2']]},
  {id: 'oxblood', name: 'Oxblood', paper: '#F2E8DF', inks: [['Oxblood', '#5E1A1D'], ['Rust', '#A3442D'], ['Mushroom', '#9C8A78'], ['Charcoal', '#2E2A28'], ['Linen', '#F8F1E8']]},
  {id: 'sakura', name: 'Sakura', paper: '#FBF2F2', inks: [['Cherry', '#C2456A'], ['Blossom', '#F2B8C6'], ['Plum', '#5B2A47'], ['Moss', '#7E9A64'], ['Petal', '#FFF7F8']]},
  {id: 'glacier', name: 'Glacier', paper: '#EEF3F7', inks: [['Glacier', '#5E8BB0'], ['Slate', '#3B4A5A'], ['Frost', '#BFD4E6'], ['Silver', '#A3ACB5'], ['Snow', '#FBFDFF']]},
  {id: 'saffron', name: 'Saffron Sun', paper: '#FCF3E2', inks: [['Saffron', '#E8A12E'], ['Paprika', '#C2452D'], ['Turmeric', '#F0C75E'], ['Cocoa', '#5A3A2A'], ['Cream', '#FFF9EE']]},
  {id: 'noir', name: 'Noir', paper: '#ECEAE6', inks: [['Ink', '#1A1A1A'], ['Graphite', '#4A4A4A'], ['Ash', '#8E8E8E'], ['Smoke', '#C9C7C3'], ['Paper', '#FAF9F6']]},
  {id: 'moss', name: 'Moss & Pearl', paper: '#EEF0E8', inks: [['Forest', '#31493C'], ['Sage', '#7A9E7E'], ['Lichen', '#B3C5A5'], ['Brass', '#C9A45C'], ['Pearl', '#FBFBF6']]},
  {id: 'rose', name: 'Rose Quartz', paper: '#FAF1EF', inks: [['Garnet', '#8C2F39'], ['Blush', '#E5989B'], ['Peach', '#FFCDB2'], ['Dusk', '#6D6875'], ['Petal', '#FFF6F3']]},
  {id: 'midnight', name: 'Midnight Koi', paper: '#0F1626', inks: [['Gold', '#E0B354'], ['Bone', '#F2E9DC'], ['Lake', '#3A6EA5'], ['Koi', '#D9643A'], ['Ink', '#0F1626']]},
];
const hexOk = h => typeof h === 'string' && /^#[0-9A-Fa-f]{6}$/.test(h);
/** A palette by id, or a validated custom palette object (the player's own colors). */
export const paletteById = id => {
  if (id && typeof id === 'object') {
    if (hexOk(id.paper) && Array.isArray(id.inks) && id.inks.length === 5 && id.inks.every(i => Array.isArray(i) && hexOk(i[1])))
      return {id: 'custom', name: 'Your colors', paper: id.paper, inks: id.inks.map(([n, h]) => [String(n).slice(0, 20), h])};
    id = id.id;
  }
  return PALETTES.find(p => p.id === id) || PALETTES[0];
};
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
export const isLight = hex => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 0.6; };

// Frames that keep running when the page is hidden, so a pour never stalls.
export const nextFrame = cb => document.hidden ? setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame(cb);
const frame = () => new Promise(r => nextFrame(r));

const FRAG = `#version 300 es
precision highp float;
uniform highp sampler2D uOps;
uniform int uCount;
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform vec3 uPaper;
uniform vec3 uInks[8];
uniform int uInkCount;
out vec4 outColor;
void main() {
  vec2 local = gl_FragCoord.xy - uOrigin;
  vec2 p = vec2(local.x, uSize.y - local.y) / uSize;
  for (int i = uCount - 1; i >= 0; i--) {
    vec4 a = texelFetch(uOps, ivec2(i * 2, 0), 0);
    vec4 b = texelFetch(uOps, ivec2(i * 2 + 1, 0), 0);
    int kind = int(a.x + 0.5);
    if (kind == 0) {
      vec2 c = a.yz; float r2 = a.w * a.w; vec2 d = p - c; float d2 = dot(d, d);
      if (d2 < r2) { int ink = int(b.x + 0.5) % max(uInkCount, 1); outColor = vec4(uInks[ink], 1.0); return; }
      p = c + d * sqrt(1.0 - r2 / d2);
    } else if (kind == 3) {
      // A comb: each point feels only its nearest tine; midpoints between tines stay put.
      vec2 o = a.yz; vec2 m = vec2(a.w, b.x); vec2 n = vec2(-m.y, m.x);
      float spacing = b.w, lambda = b.z;
      float off = dot(p - o, n) / spacing;
      float dn = abs(off - floor(off + 0.5)) * spacing;
      float edge = lambda / (0.5 * spacing + lambda);
      p -= m * (b.y * (lambda / (dn + lambda) - edge) / (1.0 - edge));
    } else if (kind == 2) {
      vec2 s = a.yz; vec2 ab = vec2(a.w, b.x) - s;
      float t = clamp(dot(p - s, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
      vec2 q = s + ab * t; float reach = b.y;
      p -= ab * exp(-dot(p - q, p - q) / (reach * reach));
    }
  }
  outColor = vec4(uPaper, 1.0);
}`;
const VERT = `#version 300 es
in vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

function encode(op) {
  switch (op.kind) {
    case 'drop': return [0, op.x, op.y, op.r, op.ink, 0, 0, 0];
    case 'swirl': return [2, op.ax, op.ay, op.bx, op.by, op.reach, 0, 0];
    case 'comb': return [3, op.ox, op.oy, op.mx, op.my, op.strength, op.sharp, op.spacing];
    default: return [9, 0, 0, 0, 0, 0, 0, 0];
  }
}

export class MarbleRenderer {
  constructor(canvas, {preserve = false} = {}) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', {antialias: false, preserveDrawingBuffer: preserve});
    if (!gl) throw new Error('This device cannot draw the marbling tray (WebGL 2 is unavailable).');
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.u = name => gl.getUniformLocation(prog, name);
  }
  // Layout size, not on-screen size, so CSS transforms don't blur it.
  resize(scale = Math.min(window.devicePixelRatio || 1, 2) * 1.25) {
    const w = Math.max(1, Math.round(this.canvas.clientWidth * scale)), h = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  draw(ops, palette) {
    const gl = this.gl, count = Math.max(ops.length, 1);
    const data = new Float32Array(count * 8);
    ops.forEach((op, i) => data.set(encode(op), i * 8));
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, count * 2, 1, 0, gl.RGBA, gl.FLOAT, data);
    const side = Math.max(this.canvas.width, this.canvas.height);
    const x0 = (this.canvas.width - side) / 2, y0 = (this.canvas.height - side) / 2;
    gl.viewport(x0, y0, side, side);
    gl.uniform1i(this.u('uOps'), 0);
    gl.uniform1i(this.u('uCount'), ops.length);
    gl.uniform2f(this.u('uSize'), side, side);
    gl.uniform2f(this.u('uOrigin'), x0, y0);
    gl.uniform3fv(this.u('uPaper'), rgb(palette.paper));
    const inks = new Float32Array(24);
    palette.inks.forEach(([, hex], i) => inks.set(rgb(hex), i * 3));
    gl.uniform3fv(this.u('uInks'), inks);
    gl.uniform1i(this.u('uInkCount'), palette.inks.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

let exporter;
/** Renders a tray as a square image data URL (PNG or JPEG). */
export function renderImage(ops, palette, size = 768, type = 'image/png', quality = 0.9) {
  exporter ||= new MarbleRenderer(document.createElement('canvas'), {preserve: true});
  exporter.canvas.width = exporter.canvas.height = size;
  exporter.draw(ops, palette);
  return exporter.canvas.toDataURL(type, quality);
}

// ---------------------------------------------------------------------------
// The tray: touches become marbling operations.
// ---------------------------------------------------------------------------
export const MAX_OPS = 700;

export function combOps(dx, dy, spacing = 0.07) {
  const len = Math.hypot(dx, dy) || 1;
  return [{kind: 'comb', ox: 0.5, oy: 0.5, mx: dx / len, my: dy / len, strength: 0, sharp: 0.012, spacing}];
}

export class Tray {
  constructor({palette = PALETTES[0], ops = [], onChange = () => {}} = {}) {
    Object.assign(this, {palette, ops, history: ops.length ? [0] : [], ink: 0, tool: 'drop', pressing: false, last: null, combGuide: null, composing: false, epoch: 0, onChange});
  }
  changed() { this.onChange(this); }
  begin(x, y) {
    if (this.composing || this.ops.length >= MAX_OPS) return;
    this.pressing = true; this.last = [x, y];
    this.history.push(this.ops.length);
    if (this.tool === 'drop') this.dropInk(x, y);
    if (this.tool === 'comb') this.combGuide = {start: [x, y], end: [x, y]};
    this.changed();
  }
  move(x, y) {
    if (!this.pressing) return;
    if (this.tool === 'swirl') {
      const [lx, ly] = this.last;
      if (Math.hypot(x - lx, y - ly) > 0.012 && this.ops.length < MAX_OPS) {
        this.ops.push({kind: 'swirl', ax: lx, ay: ly, bx: x, by: y, reach: 0.06});
        this.last = [x, y]; this.changed();
      }
    } else if (this.tool === 'comb' && this.combGuide) {
      this.combGuide.end = [x, y]; this.changed();
    }
  }
  end(x, y) {
    if (!this.pressing) return false;
    this.pressing = false;
    let felt = this.tool === 'drop';
    if (this.tool === 'swirl' && this.history.at(-1) === this.ops.length) this.history.pop();
    if (this.tool === 'comb' && this.combGuide) {
      const [sx, sy] = this.combGuide.start, dx = x - sx, dy = y - sy, len = Math.hypot(dx, dy);
      this.combGuide = null;
      if (len > 0.04) { this.pull(combOps(dx, dy), Math.min(Math.max(len * 0.3, 0.03), 0.17), 500); felt = true; }
      else this.history.pop();
    }
    this.changed();
    return felt;
  }
  // A drop lands fast, then keeps spreading for as long as it's held. Only undo or clear stops it.
  dropInk(x, y) {
    const op = {kind: 'drop', x, y, r: 0.012, ink: this.ink}, epoch = this.epoch, settled = 0.055;
    this.ops.push(op);
    const step = () => {
      if (epoch !== this.epoch || !this.ops.includes(op) || op.r >= 0.2) return;
      if (op.r >= settled && !(this.pressing && this.ops.at(-1) === op)) return;
      op.r += op.r < settled ? (settled - op.r) * 0.22 + 0.0008 : 0.0011;
      this.changed(); nextFrame(step);
    };
    nextFrame(step);
  }
  async pull(tines, strength, ms) {
    this.ops.push(...tines);
    const start = performance.now();
    for (;;) {
      const t = Math.min((performance.now() - start) / ms, 1), e = 1 - Math.pow(1 - t, 3);
      tines.forEach(tine => tine.strength = strength * e);
      this.changed(); if (t >= 1) break; await frame();
    }
  }
  undo() {
    if (!this.history.length || this.composing) return;
    this.epoch++; this.ops.length = this.history.pop(); this.changed();
  }
  clear() { this.epoch++; this.ops = []; this.history = []; this.changed(); }
  setPalette(palette) { this.palette = palette; this.ink = 0; this.changed(); }
  // Fills the tray with a classic composition, step by step, so it can be watched.
  async compose(seed) {
    let s = seed || Math.floor(Math.random() * 1e9) + 1;
    const rand = (lo, hi) => { s = (s * 16807) % 2147483647; return lo + (s / 2147483647) * (hi - lo); };
    this.epoch++; this.composing = true; this.ops = []; this.history = [];
    const inkCount = this.palette.inks.length;
    for (let i = 0; i < 70; i++) {
      const op = {kind: 'drop', x: rand(0.12, 0.88), y: rand(0.12, 0.88), r: 0, ink: i % inkCount}, full = rand(0.035, 0.085);
      this.ops.push(op);
      for (let k = 1; k <= 4; k++) { op.r = full * k / 4; this.changed(); await frame(); }
    }
    const angle = rand(0, Math.PI * 2), mx = Math.cos(angle), my = Math.sin(angle);
    await this.pull(combOps(mx, my, 0.06), 0.16, 700);
    await this.pull(combOps(-mx, -my, 0.06), 0.14, 700);
    await this.pull(combOps(-my, mx, 0.11), 0.08, 600);
    this.history = [0]; this.composing = false; this.changed();
  }
}
