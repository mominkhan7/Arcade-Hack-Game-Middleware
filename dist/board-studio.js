// Board Studio: the player pours their own marbled chessboard (Ink & Water),
// tunes its colors and finish, then plays on it. The design is saved as
// marbling operations plus a few style choices, never as pixels.
import {PALETTES, paletteById, isLight, MarbleRenderer, Tray, renderImage, nextFrame} from './marbling.js';
import {pieceSvg} from './chess-pieces.js';
import {feedback} from './tactile.js';

const KEY = 'craftkit-chess-board';
const TOOLS = [
  {id: 'drop', title: 'Drop', hint: 'Tap to float ink. Hold to let it spread.'},
  {id: 'swirl', title: 'Swirl', hint: 'Drag through the water to pull the ink.'},
  {id: 'comb', title: 'Comb', hint: 'Drag across to comb every color at once.'},
];
export const FRAMES = {
  walnut: {name: 'Walnut', bg: 'linear-gradient(145deg,#745039,#352a26)', art: '#3b2a22'},
  ebony: {name: 'Ebony', bg: 'linear-gradient(145deg,#3a3330,#0f0c0b)', art: '#16110f'},
  brass: {name: 'Brass', bg: 'linear-gradient(145deg,#d8b66a,#7a5c2a)', art: '#8a6a33'},
  ivory: {name: 'Ivory', bg: 'linear-gradient(145deg,#f3ead8,#c9b896)', art: '#d9cbb0'},
  ink: {name: 'Ink', bg: null, art: null},
};
const PATTERNS = {all: 'All squares', dark: 'Dark squares', light: 'Light squares'};
const DEFAULT_STYLE = {strength: 0.45, pattern: 'all', frame: 'walnut'};

function normalizeStyle(style = {}) {
  const strength = Number.isFinite(style.strength) ? Math.min(1, Math.max(0, style.strength)) : DEFAULT_STYLE.strength;
  return {strength, pattern: PATTERNS[style.pattern] ? style.pattern : 'all', frame: FRAMES[style.frame] ? style.frame : 'walnut'};
}

/**
 * How a board is shown, so play, the studio preview and the keepsake art agree.
 * Light squares are always lifted toward ivory and dark squares pressed toward
 * espresso, so pieces stay legible even at full strength.
 */
export function boardLook(board) {
  const style = normalizeStyle(board?.style), s = style.strength, palette = paletteById(board?.palette ?? board?.paletteId);
  const light = style.pattern === 'dark' ? {rgb: [239, 229, 210], a: 1} : {rgb: [255, 249, 238], a: +(0.62 - 0.5 * s).toFixed(3)};
  const dark = style.pattern === 'light' ? {rgb: [92, 66, 50], a: 1} : {rgb: [28, 19, 14], a: +(0.64 - 0.28 * s).toFixed(3)};
  const css = t => `rgba(${t.rgb.join(',')},${t.a})`;
  const frame = FRAMES[style.frame];
  const inkFrame = `linear-gradient(145deg,${palette.inks[0][1]},${palette.inks[3][1]})`;
  return {
    style, palette, light, dark,
    lightTint: css(light), darkTint: css(dark),
    saturate: +(0.6 + 0.6 * s).toFixed(3),
    filter: `saturate(${(0.6 + 0.6 * s).toFixed(3)}) contrast(${(0.88 + 0.12 * s).toFixed(3)})`,
    frameBg: frame.bg || inkFrame, frameArt: frame.art || palette.inks[0][1],
  };
}

/** The saved board, or null for the classic board. */
export function loadBoard() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('nexus-chess-board'));
    if (saved && Array.isArray(saved.ops) && saved.ops.length) {
      const palette = paletteById(saved.palette ?? saved.paletteId);
      return {palette: palette.id === 'custom' ? palette : {id: palette.id}, ops: saved.ops, style: normalizeStyle(saved.style)};
    }
  } catch {}
  return null;
}
function saveBoard(board) {
  try { board ? localStorage.setItem(KEY, JSON.stringify(board)) : localStorage.removeItem(KEY); } catch {}
}
/** The board's marbling as an image: JPEG keeps keepsake payloads small. */
export function boardImage(board, size = 640, type = 'image/jpeg') {
  return renderImage(board.ops, paletteById(board.palette), size, type, 0.88);
}

const START = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'];

export function initBoardStudio({onApply}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'board-studio';
  dialog.setAttribute('aria-label', 'Board Studio');
  dialog.innerHTML = `
    <div class="studio-card">
      <div class="studio-head">
        <div><span class="chess-eyebrow">BOARD STUDIO</span><h2>Pour your board.</h2></div>
        <button class="studio-close" data-act="close" aria-label="Close Board Studio">×</button>
      </div>
      <div class="studio-frame">
        <div class="studio-tray" role="img" aria-label="Marbling tray for your chessboard">
          <canvas></canvas>
          <svg class="studio-grid" viewBox="0 0 8 8" preserveAspectRatio="none" aria-hidden="true"></svg>
          <div class="studio-pieces" aria-hidden="true"></div>
          <svg class="studio-guide" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"></svg>
          <div class="studio-empty">Tap the water to float your first drop</div>
        </div>
      </div>
      <div class="studio-tabs" role="tablist">
        <button role="tab" data-tab="pour" aria-selected="true">Pour</button>
        <button role="tab" data-tab="colors" aria-selected="false">Colors</button>
        <button role="tab" data-tab="finish" aria-selected="false">Finish</button>
      </div>

      <section class="studio-panel" data-panel="pour">
        <div class="studio-tools" role="group" aria-label="Tool">${TOOLS.map(t => `<button data-tool="${t.id}">${t.title}</button>`).join('')}</div>
        <div class="studio-inks" role="group" aria-label="Ink"></div>
        <p class="studio-hint"></p>
        <div class="studio-row">
          <button class="quiet-button" data-act="undo">↶ Undo</button>
          <button class="quiet-button" data-act="surprise">✦ Surprise me</button>
          <button class="quiet-button" data-act="clear">Clear water</button>
          <button class="quiet-button" data-act="pieces" aria-pressed="true">Pieces shown</button>
        </div>
      </section>

      <section class="studio-panel" data-panel="colors" hidden>
        <span class="studio-label">PALETTES</span>
        <div class="studio-palettes" role="group" aria-label="Palette">${PALETTES.map(p => `<button data-palette="${p.id}"><span class="chips" style="background:${p.paper}">${p.inks.slice(0, 4).map(([, h]) => `<i style="background:${h}"></i>`).join('')}</span><span>${p.name}</span></button>`).join('')}</div>
        <span class="studio-label">YOUR COLORS <small>Tap a color to change it. Your pour keeps its shape.</small></span>
        <div class="studio-custom"></div>
      </section>

      <section class="studio-panel" data-panel="finish" hidden>
        <label class="studio-label" for="studio-strength">PATTERN STRENGTH</label>
        <div class="studio-slider"><span>Subtle</span><input id="studio-strength" type="range" min="0" max="100" step="1"><span>Bold</span></div>
        <span class="studio-label">PATTERN ON</span>
        <div class="studio-tools" role="group" aria-label="Pattern on">${Object.entries(PATTERNS).map(([id, name]) => `<button data-pattern="${id}">${name}</button>`).join('')}</div>
        <span class="studio-label">FRAME</span>
        <div class="studio-frames" role="group" aria-label="Frame">${Object.entries(FRAMES).map(([id, f]) => `<button data-frame="${id}"><i></i>${f.name}</button>`).join('')}</div>
        <p class="studio-note">Light squares are always lifted and dark squares deepened, so your pieces stay easy to read.</p>
      </section>

      <button class="keep-button" data-act="apply">Play on this board <span>↗</span></button>
      <button class="quiet-button studio-classic" data-act="classic">Use the classic board</button>
    </div>`;
  document.body.append(dialog);

  const $ = sel => dialog.querySelector(sel);
  const canvas = $('canvas'), trayEl = $('.studio-tray'), guide = $('.studio-guide'), grid = $('.studio-grid');
  let renderer, queued = false;
  const saved = loadBoard();
  const tray = new Tray({palette: paletteById(saved?.palette), ops: saved ? structuredClone(saved.ops) : [], onChange: () => draw()});
  let style = normalizeStyle(saved?.style);

  grid.innerHTML = Array.from({length: 64}, (_, i) => `<rect x="${i % 8}" y="${Math.floor(i / 8)}" width="1" height="1" class="${(Math.floor(i / 8) + i % 8) % 2 ? 'dark' : 'light'}"/>`).join('');
  $('.studio-pieces').innerHTML = START.flatMap((rank, r) => [...rank.padEnd(8, ' ')].map((ch, c) => ch === ' ' ? '' :
    `<span class="piece ${ch === ch.toUpperCase() ? 'white' : 'black'}" style="left:${c * 12.5}%;top:${r * 12.5}%">${pieceSvg(ch.toLowerCase(), ch === ch.toUpperCase() ? 'w' : 'b', `studio-${r}-${c}`)}</span>`)).join('');

  const board = () => ({palette: tray.palette.id === 'custom' ? tray.palette : {id: tray.palette.id}, ops: tray.ops, style});
  function applyLook() {
    const look = boardLook(board());
    trayEl.style.setProperty('--light-tint', look.lightTint);
    trayEl.style.setProperty('--dark-tint', look.darkTint);
    trayEl.style.setProperty('--board-filter', look.filter);
    $('.studio-frame').style.background = look.frameBg;
    $('#studio-strength').value = Math.round(style.strength * 100);
    dialog.querySelectorAll('[data-pattern]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pattern === style.pattern));
    dialog.querySelectorAll('[data-frame]').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.frame === style.frame);
      b.querySelector('i').style.background = FRAMES[b.dataset.frame].bg || `linear-gradient(145deg,${tray.palette.inks[0][1]},${tray.palette.inks[3][1]})`;
    });
  }
  function draw() {
    if (queued || !renderer) return;
    queued = true;
    nextFrame(() => {
      queued = false;
      renderer.resize(); renderer.draw(tray.ops, tray.palette);
      $('.studio-empty').style.opacity = tray.ops.length ? 0 : 1;
      $('[data-act="undo"]').disabled = !tray.history.length || tray.composing;
      $('[data-act="apply"]').disabled = !tray.ops.length || tray.composing;
      trayEl.classList.toggle('dark-paper', !isLight(tray.palette.paper));
      drawGuide();
    });
  }
  function drawGuide() {
    const cg = tray.combGuide;
    if (!cg) { guide.innerHTML = ''; return; }
    const [sx, sy] = cg.start, [ex, ey] = cg.end, dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy);
    if (len < 0.01) { guide.innerHTML = ''; return; }
    const mx = dx / len, my = dy / len, nx = -my, ny = mx, color = 'rgba(255,255,255,.6)';
    let lines = '';
    for (let o = -0.75; o <= 0.7501; o += 0.07) {
      const cx = 0.5 + nx * o, cy = 0.5 + ny * o;
      lines += `<line x1="${cx - mx}" y1="${cy - my}" x2="${cx + mx}" y2="${cy + my}" stroke="${color}" stroke-width=".0025" stroke-dasharray=".004 .012"/>`;
    }
    guide.innerHTML = lines + `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width=".006" stroke-linecap="round"/>`;
  }
  function selectTool(id) {
    tray.tool = id;
    dialog.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === id));
    $('.studio-inks').classList.toggle('off', id !== 'drop');
    $('.studio-hint').textContent = TOOLS.find(t => t.id === id).hint;
  }
  function buildInks() {
    $('.studio-inks').innerHTML = tray.palette.inks.map(([name, hex], i) =>
      `<button aria-label="${name}" aria-pressed="${i === tray.ink}"><span style="background:${hex}"></span></button>`).join('');
    $('.studio-inks').querySelectorAll('button').forEach((b, i) => b.onclick = () => { tray.ink = i; buildInks(); feedback('light'); });
    dialog.querySelectorAll('[data-palette]').forEach(b => b.setAttribute('aria-pressed', b.dataset.palette === tray.palette.id));
    // The player's own colors: start from the current palette, edit any ink or the paper.
    $('.studio-custom').innerHTML = [...tray.palette.inks.map(([name, hex], i) => ({key: i, name, hex})), {key: 'paper', name: 'Paper', hex: tray.palette.paper}]
      .map(c => `<label class="custom-color"><input type="color" value="${c.hex.toLowerCase()}" data-color="${c.key}" aria-label="${c.name} color"><span>${c.name}</span></label>`).join('');
    $('.studio-custom').querySelectorAll('[data-color]').forEach(input => input.oninput = () => {
      const palette = {id: 'custom', name: 'Your colors', paper: tray.palette.paper, inks: tray.palette.inks.map(([n, h]) => [n, h])};
      if (input.dataset.color === 'paper') palette.paper = input.value.toUpperCase();
      else palette.inks[Number(input.dataset.color)][1] = input.value.toUpperCase();
      tray.palette = paletteById(palette); tray.changed(); applyLook();
      dialog.querySelectorAll('[data-palette]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      $('.studio-inks').querySelectorAll('span').forEach((span, i) => span.style.background = tray.palette.inks[i][1]);
    });
  }

  const point = e => { const r = trayEl.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  trayEl.addEventListener('pointerdown', e => {
    if (dialog.dataset.tab !== 'pour') selectTab('pour');
    trayEl.setPointerCapture(e.pointerId); tray.begin(...point(e)); if (tray.tool === 'drop') feedback('light');
  });
  trayEl.addEventListener('pointermove', e => tray.move(...point(e)));
  const release = e => { if (tray.end(...point(e)) && tray.tool === 'comb') feedback('medium'); };
  trayEl.addEventListener('pointerup', release);
  trayEl.addEventListener('pointercancel', release);

  function selectTab(id) {
    dialog.dataset.tab = id;
    dialog.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id));
    dialog.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== id);
  }
  dialog.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { selectTab(b.dataset.tab); feedback('light'); });
  dialog.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { selectTool(b.dataset.tool); feedback('light'); });
  dialog.querySelectorAll('[data-palette]').forEach(b => b.onclick = () => { tray.setPalette(paletteById(b.dataset.palette)); buildInks(); applyLook(); feedback('light'); });
  dialog.querySelectorAll('[data-pattern]').forEach(b => b.onclick = () => { style = {...style, pattern: b.dataset.pattern}; applyLook(); feedback('light'); });
  dialog.querySelectorAll('[data-frame]').forEach(b => b.onclick = () => { style = {...style, frame: b.dataset.frame}; applyLook(); feedback('light'); });
  $('#studio-strength').oninput = e => { style = {...style, strength: Number(e.target.value) / 100}; applyLook(); };
  dialog.addEventListener('click', e => {
    const control = e.target.closest('[data-act]'), act = control?.dataset.act;
    if (act === 'close') dialog.close();
    if (act === 'undo') tray.undo();
    if (act === 'clear') tray.clear();
    if (act === 'surprise') tray.compose();
    if (act === 'pieces') {
      const on = trayEl.classList.toggle('no-pieces') === false;
      control.setAttribute('aria-pressed', on);
      control.textContent = on ? 'Pieces shown' : 'Pieces hidden';
    }
    if (act === 'apply' && tray.ops.length) {
      const chosen = structuredClone(board());
      saveBoard(chosen); feedback('success'); dialog.close(); onApply(chosen);
    }
    if (act === 'classic') { saveBoard(null); dialog.close(); onApply(null); }
  });

  selectTool('drop'); selectTab('pour'); buildInks(); applyLook();
  return {
    open() {
      dialog.showModal();
      try { renderer ||= new MarbleRenderer(canvas); } catch (error) { $('.studio-empty').textContent = error.message; return; }
      draw();
    },
  };
}
