// Chess Atelier: choose a way to play, choose how it looks (board, pieces, art
// medium), watch every move paint itself, frame the finished game, and have
// Arcade make it into a real product.
import {Chess, chooseMove} from './engine.js';
import {pieceSvg} from './pieces.js';
import {drawingSvg, drawDuration, paceFor} from './drawing.js';
import {painterIn, paintingPng} from './paint.js';
import {BOARDS, PIECES, MEDIUMS, DEFAULT_STYLE, cleanStyle, styleColors, isDark, mediumName} from './styles.js';
import {CLASSICS} from './classics.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  drop(key) { try { localStorage.removeItem(key); } catch {} },
};
const uid = () => Math.random().toString(36).slice(2, 10);
const historyOf = pgn => { const c = new Chess(); if (pgn) c.loadPgn(pgn); return c.history({verbose: true}); };
const today = () => new Date().toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
const money = p => p ? new Intl.NumberFormat(undefined, {style: 'currency', currency: p.currency || 'USD'}).format(Number(p.amount)) : '';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SPEEDS = [{label: '1×', ms: 900}, {label: '2×', ms: 450}, {label: '4×', ms: 200}];
const FILES = 'abcdefgh';
const OPERA = CLASSICS[0];

const state = {
  view: 'home', stack: [],
  style: cleanStyle(store.get('atelier-style', DEFAULT_STYLE)),
  setup: null,       // {mode, legend, editing}: what the setup screen is choosing for
  game: null,        // {id, mode, chess, legend, full, index, over, drawn}
  selected: null,
  piece: null,       // the framed game shown on the reveal screen
  product: 'scarf',
  config: null,
  make: 0,           // bumps to cancel an in-flight Arcade run
  timers: {hero: 0, play: 0, frame: 0, computer: 0},
  speed: 0,
};

// ---------- Navigation ----------

function go(view) { if (state.view !== view) state.stack.push(state.view); show(view); }
function back() { show(state.stack.pop() || 'home'); }
function show(view) {
  stopPlayback(); clearTimeout(state.timers.frame); clearTimeout(state.timers.hero);
  if (view !== 'make') state.make++;
  state.view = view;
  $$('.view').forEach(v => { v.hidden = v.dataset.view !== view; });
  window.scrollTo(0, 0);
  ({home: showHome, legends: showLegends, setup: showSetup, game: renderGame, reveal: showReveal, make: showMake, gallery: showGallery})[view]?.();
}
$$('[data-back]').forEach(b => b.addEventListener('click', back));
$('#reveal-home').addEventListener('click', () => { state.stack = []; show('home'); });

function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- Home ----------

// The opening page cycles famous games through every medium, each in a look that suits it.
const SHOWCASE = [
  {legend: 'opera', style: {board: '#F3EBDD', white: '#B5583F', black: '#2F241E', medium: 'lines'}},
  {legend: 'immortal', style: {board: '#F3EBDD', white: '#B5583F', black: '#1A1A1A', medium: 'brush'}},
  {legend: 'century', style: {board: '#0F1626', white: '#F2E9DC', black: '#E0B354', medium: 'constellation'}},
  {legend: 'deep-blue', style: {board: '#F3E0DA', white: '#D9798F', black: '#1F3A5F', medium: 'watercolor'}},
  {legend: 'opera', style: {board: '#4A5866', white: '#F2E9DC', black: '#E8A12E', medium: 'string'}},
];
let heroTurn = 0;
function showHome() {
  const playHero = () => {
    const shot = SHOWCASE[heroTurn++ % SHOWCASE.length], legend = CLASSICS.find(l => l.id === shot.legend);
    const moves = historyOf(legend.pgn), pace = paceFor(moves.length, 6);
    painterIn($('#hero-art')).paint(moves, shot.style, {animate: 'all', msPerMove: pace});
    $('#hero-name').textContent = legend.name;
    $('#hero-detail').textContent = mediumName(shot.style.medium);
    state.timers.hero = setTimeout(playHero, drawDuration(moves.length, pace) + 2600);
  };
  playHero();
  const current = store.get('atelier-current', null);
  $('#resume').hidden = !current;
  if (current) $('#resume-detail').textContent = `${current.mode === 'computer' ? 'vs. computer' : 'vs. a friend'} · ${historyOf(current.pgn).length} moves`;
  const count = store.get('atelier-gallery', []).length;
  $('#gallery-count').textContent = count ? `(${count})` : '';
}
$$('[data-start]').forEach(b => b.addEventListener('click', () => {
  const mode = b.dataset.start;
  if (mode === 'legends') go('legends'); else openSetup({mode});
}));
$('#resume').addEventListener('click', () => {
  const c = store.get('atelier-current', null);
  if (c) { if (c.style) state.style = cleanStyle(c.style); startGame(c.mode, {pgn: c.pgn}); }
});
$('#open-gallery').addEventListener('click', () => go('gallery'));

// ---------- Famous matches ----------

function showLegends() {
  $('#legend-list').innerHTML = CLASSICS.map(l => {
    const moves = historyOf(l.pgn);
    return `<button class="legend" data-legend="${l.id}">
      <div class="thumb art">${drawingSvg(moves, state.style)}</div>
      <span><strong>${escape(l.name)}</strong><span class="who">${escape(l.white)} vs. ${escape(l.black)}${l.year ? ` · ${l.year}` : ''} · ${Math.ceil(moves.length / 2)} moves</span><span class="note">${escape(l.note)}</span></span>
    </button>`;
  }).join('');
  $$('[data-legend]').forEach(b => b.addEventListener('click', () => openSetup({mode: 'legend', legend: CLASSICS.find(l => l.id === b.dataset.legend)})));
}

// ---------- Setup: board, pieces, medium ----------

function openSetup(setup) { state.setup = setup; go('setup'); }

function setStyle(patch, {animate = false} = {}) {
  state.style = cleanStyle({...state.style, ...patch});
  store.set('atelier-style', state.style);
  renderSetup(animate);
}

function showSetup() {
  const {mode, legend, editing} = state.setup || {mode: 'friend'};
  $('#setup-sub').textContent = legend ? legend.name : mode === 'computer' ? 'vs. the computer' : 'vs. a friend';
  $('#setup-go').textContent = editing ? 'Done' : legend ? 'Watch it draw' : 'Start the game';
  renderSetup(true);
}

function renderSetup(animate) {
  // Preview the famous match being set up, the player's own game when restyling it, or else the Opera Game.
  const s = state.style, st = state.setup || {}, own = !st.legend && st.pgn && historyOf(st.pgn).length >= 4;
  const moves = historyOf(st.legend ? st.legend.pgn : own ? st.pgn : OPERA.pgn);
  painterIn($('#setup-art')).paint(moves, s, animate ? {animate: 'all', msPerMove: paceFor(moves.length, 3.5)} : {});
  $('#setup-caption').textContent = `${st.legend ? 'Preview: ' + st.legend.name : own ? 'Your game' : 'Preview: ' + OPERA.name} · ${mediumName(s.medium)}`;
  const dark = isDark(s.board) ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
  $('#setup-pieces').innerHTML = [['k', 'w'], ['q', 'w'], ['q', 'b'], ['k', 'b']].map(([t, c], i) =>
    `<span style="background:${s.board};box-shadow:inset 0 0 0 40px ${i % 2 ? dark : 'transparent'}">${pieceSvg(t, c, 'setup-' + t + c, c === 'w' ? s.white : s.black)}</span>`).join('');

  const thumbMoves = historyOf(OPERA.pgn);
  $('#mediums').innerHTML = MEDIUMS.map(m => `<button class="medium" role="radio" data-medium="${m.id}" aria-checked="${m.id === s.medium}">
      <span class="thumb art">${drawingSvg(thumbMoves, {...s, medium: m.id})}</span>
      <strong>${escape(m.name)}</strong><small>${escape(m.blurb)}</small></button>`).join('');
  $$('#mediums .medium').forEach(b => b.addEventListener('click', () => setStyle({medium: b.dataset.medium}, {animate: true})));

  const customBoard = !BOARDS.some(b => b.hex === s.board);
  $('#boards').innerHTML = BOARDS.map(b => `<button class="chip" role="radio" data-board="${b.hex}" aria-checked="${b.hex === s.board}" aria-label="${b.name}"><i style="background:${b.hex}"></i><span>${b.name}</span></button>`).join('')
    + `<label class="chip custom-chip" aria-checked="${customBoard}"><i style="background:${customBoard ? s.board : 'conic-gradient(#e66,#ec6,#6c8,#6ae,#a6e,#e66)'}"></i><span>Custom</span><input type="color" id="custom-board" value="${s.board.toLowerCase()}"></label>`;
  $$('#boards [data-board]').forEach(b => b.addEventListener('click', () => setStyle({board: b.dataset.board})));
  $('#custom-board').addEventListener('input', e => setStyle({board: e.target.value}));

  $('#piece-sets').innerHTML = PIECES.map(p => `<button class="chip" role="radio" data-pieces="${p.id}" aria-checked="${p.white === s.white && p.black === s.black}" aria-label="${p.name}"><i class="pair"><b style="background:${p.white}"></b><b style="background:${p.black}"></b></i><span>${escape(p.name)}</span></button>`).join('');
  $$('#piece-sets [data-pieces]').forEach(b => b.addEventListener('click', () => { const p = PIECES.find(x => x.id === b.dataset.pieces); setStyle({white: p.white, black: p.black}); }));
  $('#custom-white').value = s.white.toLowerCase();
  $('#custom-black').value = s.black.toLowerCase();
}
$('#custom-white').addEventListener('input', e => setStyle({white: e.target.value}));
$('#custom-black').addEventListener('input', e => setStyle({black: e.target.value}));
$('#setup-go').addEventListener('click', () => {
  const {mode, legend, editing} = state.setup || {};
  if (editing) {
    if (state.game) state.game.drawn = -1;
    if (state.piece && state.setup.forPiece) { state.piece.style = {...state.style}; savePiece(state.piece); }
    return back();
  }
  startGame(mode, {legend});
});

// ---------- Game ----------

function startGame(mode, {legend = null, pgn = ''} = {}) {
  const chess = new Chess();
  if (pgn) chess.loadPgn(pgn);
  state.game = {id: uid(), mode, chess, legend, full: legend ? historyOf(legend.pgn) : null, index: 0, over: false, drawn: -1};
  state.selected = null;
  $('#game-title').textContent = legend ? legend.name : mode === 'computer' ? 'You vs. the computer' : 'Play a friend';
  $('#play-controls').hidden = !!legend;
  $('#legend-controls').hidden = !legend;
  $('#legend-note').hidden = !legend;
  if (legend) $('#legend-note').textContent = legend.note;
  setShowArt(false);
  // The setup screen is behind us now: back from the game goes to where the player started.
  if (state.view === 'setup') state.stack.pop();
  go('game');
  if (legend) setTimeout(() => state.view === 'game' && state.game?.legend === legend && play(), 700);
}

function buildSquares() {
  const squares = $('#squares');
  if (squares.children.length) return;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = document.createElement('div');
    sq.dataset.sq = FILES[c] + (8 - r);
    if ((r + c) % 2) sq.className = 'dark';
    squares.append(sq);
  }
}

function renderGame() {
  const g = state.game, s = state.style;
  if (!g) return show('home');
  buildSquares();
  const {chess} = g, history = chess.history({verbose: true}), last = history.at(-1);
  const board = $('#board');
  board.style.background = s.board;
  board.style.setProperty('--square-dark', isDark(s.board) ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)');
  for (const d of $$('#squares div')) {
    d.classList.toggle('from', d.dataset.sq === last?.from);
    d.classList.toggle('to', d.dataset.sq === last?.to);
  }

  // A move that extends the game draws itself; anything else (undo, scrub, restyle) redraws at once.
  const animate = history.length === g.drawn + 1 ? 'last' : 'none';
  painterIn($('#board-art')).paint(history, s, {animate});
  g.drawn = history.length;

  const legal = state.selected ? chess.moves({square: state.selected, verbose: true}) : [];
  const checkSq = chess.inCheck() ? findKing(chess, chess.turn()) : null;
  let html = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = FILES[c] + (8 - r), p = chess.get(sq), target = legal.find(m => m.to === sq);
    const cls = [sq === state.selected && 'sel', target && 'target', target?.captured && 'capture', sq === checkSq && 'check', sq === last?.to && 'moving'].filter(Boolean).join(' ');
    const name = p ? `${p.color === 'w' ? 'White' : 'Black'} ${({p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'})[p.type]} on ${sq}` : sq;
    html += `<button data-sq="${sq}" class="${cls}" aria-label="${name}">${p ? pieceSvg(p.type, p.color, sq, p.color === 'w' ? s.white : s.black) : ''}</button>`;
  }
  $('#pieces').innerHTML = html;
  renderMoves(history);
  $('#ink-dots').innerHTML = [s.board, s.white, s.black, s.board].map(c => `<i style="background:${c}"></i>`).join('');
  $('#game-status').textContent = statusText();
  $('#undo').disabled = !history.length || g.over;
  if (g.legend) {
    $('#lg-play').textContent = state.timers.play ? '❚❚' : '▶';
    $('#lg-play').setAttribute('aria-label', state.timers.play ? 'Pause' : 'Play');
    $('#lg-speed').textContent = SPEEDS[state.speed].label;
  }
}

function findKing(chess, color) {
  for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}

function statusText() {
  const {chess, legend, full, index, mode} = state.game;
  const side = chess.turn() === 'w' ? 'White' : 'Black';
  if (legend) {
    if (index >= full.length) return legend.ending || (chess.isCheckmate() ? 'Checkmate' : 'Game over');
    return `Move ${Math.ceil((index + 1) / 2)} of ${Math.ceil(full.length / 2)}`;
  }
  if (chess.isCheckmate()) return `Checkmate · ${side === 'White' ? 'Black' : 'White'} wins`;
  if (chess.isDraw()) return 'Draw';
  const who = mode === 'computer' ? (side === 'White' ? 'Your move' : 'Computer is thinking…') : `${side} to move`;
  return chess.inCheck() ? `Check · ${who}` : who;
}

function renderMoves(history) {
  const box = $('#moves');
  if (!history.length) { box.innerHTML = '<span class="empty">Make a move. It will paint itself.</span>'; return; }
  box.innerHTML = history.map((m, i) => `<span class="${i === history.length - 1 ? 'now' : ''}">${i % 2 ? '' : `<i>${i / 2 + 1}.</i>`}${m.san}</span>`).join('');
  box.lastElementChild?.scrollIntoView({block: 'nearest', inline: 'end', behavior: 'smooth'});
}

$('#pieces').addEventListener('click', e => {
  const btn = e.target.closest('button[data-sq]'), g = state.game;
  if (!btn || !g || g.legend || g.over) return;
  if (g.mode === 'computer' && g.chess.turn() !== 'w') return;
  const sq = btn.dataset.sq, piece = g.chess.get(sq);
  if (state.selected) {
    const move = g.chess.moves({square: state.selected, verbose: true}).find(m => m.to === sq);
    if (move) return playMove({from: move.from, to: move.to, promotion: move.promotion ? 'q' : undefined});
  }
  state.selected = piece && piece.color === g.chess.turn() && sq !== state.selected ? sq : null;
  renderGame();
});

function playMove(move) {
  const g = state.game;
  g.chess.move(move);
  state.selected = null;
  haptic();
  renderGame();
  saveCurrent();
  if (checkOver()) return;
  if (g.mode === 'computer' && g.chess.turn() === 'b') {
    state.timers.computer = setTimeout(() => {
      if (state.game !== g || g.over) return;
      const reply = chooseMove(g.chess, 2);
      if (reply) { g.chess.move({from: reply.from, to: reply.to, promotion: reply.promotion}); renderGame(); saveCurrent(); checkOver(); }
    }, 500);
  }
}

function checkOver() {
  const g = state.game;
  if (!g.chess.isGameOver()) return false;
  g.over = true;
  store.drop('atelier-current');
  renderGame();
  state.timers.frame = setTimeout(() => state.game === g && frameGame(), 1500);
  return true;
}

function saveCurrent() {
  const g = state.game;
  if (g.legend || g.over) return;
  store.set('atelier-current', {mode: g.mode, pgn: g.chess.pgn(), style: state.style});
}

$('#undo').addEventListener('click', () => {
  const g = state.game;
  if (!g || g.over) return;
  clearTimeout(state.timers.computer);
  g.chess.undo();
  if (g.mode === 'computer' && g.chess.turn() === 'b') g.chess.undo();
  state.selected = null;
  renderGame(); saveCurrent();
});
$('#finish').addEventListener('click', () => {
  if (!state.game.chess.history().length) return toast('Make a few moves first');
  frameGame();
});
$('#style-btn').addEventListener('click', () => {
  state.setup = {mode: state.game.mode, legend: state.game.legend, editing: true, pgn: state.game.chess.pgn()};
  go('setup');
});

function setShowArt(on) {
  $('#board').classList.toggle('art-only', on);
  $$('[data-show]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.show === 'art') === on)));
}
$$('[data-show]').forEach(b => b.addEventListener('click', () => setShowArt(b.dataset.show === 'art')));

// Famous match playback
function stepTo(index) {
  const g = state.game;
  index = Math.max(0, Math.min(g.full.length, index));
  if (index === g.index + 1) g.chess.move(g.full[g.index].san);
  else if (index === g.index - 1) g.chess.undo();
  else if (index !== g.index) { g.chess.reset(); for (let i = 0; i < index; i++) g.chess.move(g.full[i].san); }
  g.index = index;
  clearTimeout(state.timers.frame);
  renderGame();
  if (index === g.full.length) {
    stopPlayback(); renderGame();
    state.timers.frame = setTimeout(() => state.game === g && g.index === g.full.length && frameGame(), 1800);
  }
}
function play() {
  const g = state.game;
  if (!g?.legend) return;
  if (g.index >= g.full.length) stepTo(0);
  stopPlayback();
  state.timers.play = setInterval(() => stepTo(state.game.index + 1), SPEEDS[state.speed].ms);
  renderGame();
}
function stopPlayback() { clearInterval(state.timers.play); state.timers.play = 0; clearTimeout(state.timers.computer); }
$('#lg-play').addEventListener('click', () => { if (state.timers.play) { stopPlayback(); renderGame(); } else play(); });
$('#lg-next').addEventListener('click', () => { stopPlayback(); stepTo(state.game.index + 1); });
$('#lg-prev').addEventListener('click', () => { stopPlayback(); stepTo(state.game.index - 1); });
$('#lg-start').addEventListener('click', () => { stopPlayback(); stepTo(0); });
$('#lg-speed').addEventListener('click', () => {
  state.speed = (state.speed + 1) % SPEEDS.length;
  if (state.timers.play) play(); else renderGame();
});

// ---------- Framing ----------

function frameGame() {
  const g = state.game, {chess, legend, mode} = g;
  const moves = chess.history().length;
  let eyebrow, title, sub, caption;
  if (legend) {
    eyebrow = chess.isCheckmate() ? 'CHECKMATE' : legend.ending ? 'RESIGNATION' : 'FRAMED';
    title = legend.name;
    sub = `${legend.white} vs. ${legend.black}`;
    caption = `${legend.place}${legend.year ? `, ${legend.year}` : ''} · ${Math.ceil(moves / 2)} moves`;
  } else {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    if (chess.isCheckmate()) { eyebrow = 'CHECKMATE'; title = mode === 'computer' ? (winner === 'White' ? 'You won.' : 'The computer won.') : `${winner} wins.`; }
    else if (chess.isDraw()) { eyebrow = 'A DRAW'; title = 'A draw.'; }
    else { eyebrow = 'FRAMED'; title = 'Your game, so far.'; }
    sub = mode === 'computer' ? 'You vs. the computer' : 'White vs. Black';
    caption = `${Math.ceil(moves / 2)} moves · ${today()}`;
    if (g.over || chess.isGameOver()) store.drop('atelier-current');
  }
  state.piece = {id: g.id, eyebrow, title, sub, caption, pgn: chess.pgn(), style: {...state.style}, grid: 'none', saved: Date.now()};
  savePiece(state.piece);
  go('reveal');
}

function savePiece(piece) {
  const gallery = store.get('atelier-gallery', []).filter(p => p.id !== piece.id);
  store.set('atelier-gallery', [piece, ...gallery].slice(0, 60));
}

function showReveal(animate = true) {
  const p = state.piece;
  if (!p) return show('home');
  p.style = cleanStyle(p.style);
  const moves = historyOf(p.pgn);
  $('#reveal-eyebrow').textContent = p.eyebrow;
  $('#reveal-title').textContent = p.title;
  $('#reveal-sub').textContent = p.sub;
  $('#reveal-caption').textContent = `${p.caption} · ${mediumName(p.style.medium)}`;
  painterIn($('#reveal-art')).paint(moves, p.style, {animate: animate ? 'all' : 'none', msPerMove: paceFor(moves.length, 5), grid: p.grid});
  $('#reveal-mediums').innerHTML = MEDIUMS.map(m => `<button role="radio" data-reveal-medium="${m.id}" aria-checked="${m.id === p.style.medium}">${escape(m.name)}</button>`).join('');
  $$('[data-reveal-medium]').forEach(b => b.addEventListener('click', () => {
    p.style = {...p.style, medium: b.dataset.revealMedium}; savePiece(p); showReveal(true);
  }));
  $$('[data-grid]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.grid === p.grid)));
}
$$('[data-grid]').forEach(b => b.addEventListener('click', () => { state.piece.grid = b.dataset.grid; savePiece(state.piece); showReveal(false); }));
$('#reveal-colors').addEventListener('click', () => {
  state.style = cleanStyle(state.piece.style);
  state.setup = {editing: true, forPiece: true, pgn: state.piece.pgn};
  go('setup');
});
$('#replay-drawing').addEventListener('click', () => showReveal(true));
$('#new-game').addEventListener('click', () => { state.stack = []; show('home'); });
$('#download').addEventListener('click', async () => {
  const p = state.piece, png = await paintingPng(historyOf(p.pgn), p.style, {grid: p.grid});
  const a = document.createElement('a');
  a.href = 'data:image/png;base64,' + png;
  a.download = `chess-atelier-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${p.style.medium}.png`;
  a.click();
});
$('#make-it').addEventListener('click', () => go('make'));

// ---------- Make it real ----------

const STEP_ORDER = ['upload', 'pattern', 'product', 'ready'];

async function config() {
  if (!state.config) state.config = await fetch('/api/config').then(r => r.json());
  return state.config;
}

function mock(kind, inner) { return `<div class="mock ${kind}"><div class="surface">${inner}</div></div>`; }

async function showMake() {
  const p = state.piece;
  if (!p) return show('home');
  $('#make-pick').hidden = false; $('#make-progress').hidden = true;
  $('#make-sub').textContent = `${p.title} · ${mediumName(p.style.medium)}`;
  const art = drawingSvg(historyOf(p.pgn), p.style, {grid: p.grid});
  let cfg;
  try { cfg = await config(); } catch { $('#products').innerHTML = '<p class="error">Can’t reach the Chess Atelier server.</p>'; return; }
  $('#mode-chip').hidden = cfg.mode !== 'simulated';
  if (!cfg.products.some(o => o.kind === state.product)) state.product = cfg.products[0]?.kind;
  $('#products').innerHTML = cfg.products.map(o => `<button class="product" role="radio" data-kind="${o.kind}" aria-checked="${o.kind === state.product}">
    ${mock(o.kind, art)}
    <span><strong>${escape(o.name)}</strong><small>${escape(o.detail)}</small><span class="from">${o.price ? money(o.price) : ''}</span></span>
  </button>`).join('');
  $$('.product').forEach(b => b.addEventListener('click', () => {
    state.product = b.dataset.kind;
    $$('.product').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    updateCreateLabel();
  }));
  updateCreateLabel();
}
function updateCreateLabel() {
  const offer = state.config?.products.find(o => o.kind === state.product);
  $('#create').textContent = offer ? `Create my ${offer.name.toLowerCase()} with Arcade` : 'Create with Arcade';
}

function setStep(step, timers = {}) {
  const at = STEP_ORDER.indexOf(step);
  $$('#steps li').forEach(li => {
    const i = STEP_ORDER.indexOf(li.dataset.step);
    li.classList.toggle('done', i < at || step === 'ready' && i === at);
    li.classList.toggle('active', i === at && step !== 'ready');
    const t = li.querySelector('.timer');
    if (t) t.textContent = timers[li.dataset.step] ?? '';
  });
}

$('#create').addEventListener('click', makeIt);
$('#pick-other').addEventListener('click', () => { state.make++; showMake(); });

async function makeIt() {
  const run = ++state.make, live = () => run === state.make && state.view === 'make';
  const p = state.piece, offer = state.config.products.find(o => o.kind === state.product);
  const moves = historyOf(p.pgn);
  $('#make-pick').hidden = true; $('#make-progress').hidden = false;
  $('#price-card').hidden = true; $('#order').hidden = true; $('#pick-other').hidden = true; $('#make-error').hidden = true;
  $$('.pname').forEach(n => { n.textContent = offer.name.toLowerCase(); });
  $('.stage').classList.add('working');
  $('#stage-mock').outerHTML = `<div class="mock big ${offer.kind}" id="stage-mock"><div class="surface"></div></div>`;
  painterIn($('#stage-mock .surface')).paint(moves, p.style, {grid: p.grid, animate: 'all', msPerMove: paceFor(moves.length, 5)});

  const timers = {}, since = {};
  let current = 'upload';
  const tick = setInterval(() => {
    if (!live()) return clearInterval(tick);
    for (const k of Object.keys(since)) timers[k] = `${Math.round((Date.now() - since[k]) / 1000)}s`;
    setStep(current, timers);
  }, 500);
  const step = s => { if (since[current]) timers[current] = `${Math.round((Date.now() - since[current]) / 1000)}s`; delete since[current]; current = s; if (s !== 'ready') since[s] = Date.now(); setStep(s, timers); };

  try {
    step('upload');
    const image = await paintingPng(moves, p.style, {grid: p.grid, size: 2048});
    const {pieceId} = await api('/api/pieces', {image, colors: styleColors(p.style), medium: p.style.medium, title: p.title});
    if (!live()) return;
    step('pattern');
    let piece;
    for (;;) {
      await wait(1500);
      if (!live()) return;
      piece = await fetch(`/api/pieces/${pieceId}`).then(r => r.json());
      if (piece.status !== 'running') break;
    }
    if (piece.status !== 'succeeded') throw new Error(piece.message || 'Arcade could not finish this design');
    $('#stage-mock .surface').innerHTML = `<img src="${escape(piece.imageUrl)}" alt="Arcade pattern">`;
    step('product');
    const product = await api('/api/products', {patternId: piece.patternId, kind: offer.kind});
    if (!live()) return;
    step('ready');
    clearInterval(tick);
    $('.stage').classList.remove('working');
    if (product.images?.[0] && !product.simulated) $('#stage-mock .surface').innerHTML = `<img src="${escape(product.images[0])}" alt="${escape(product.name)} preview">`;
    $('#price').textContent = money(product.price);
    $('#price-detail').textContent = product.detail || '';
    $('#maker').textContent = product.maker ? `Made by ${product.maker}` : '';
    $('#price-card').hidden = false;
    $('#order').hidden = false; $('#pick-other').hidden = false;
    $('#pick-other').textContent = 'Choose a different product';
    $('#order').textContent = `Order · ${money(product.price)}`;
    $('#order').onclick = () => order(product);
    haptic();
  } catch (err) {
    clearInterval(tick);
    if (!live()) return;
    $('.stage').classList.remove('working');
    $('#make-error').textContent = err.message;
    $('#make-error').hidden = false;
    $('#pick-other').hidden = false;
    $('#pick-other').textContent = 'Try again';
  }
}

async function order(product) {
  $('#order').disabled = true;
  try {
    const result = await api('/api/checkout', {productId: product.productId, name: product.name, price: product.price});
    $('#order-title').textContent = `Order ${result.orderNumber}`;
    $('#order-detail').textContent = `${result.name} · ${money(result.price)}. ${result.simulated ? 'Demo order, nothing was charged. ' : ''}${result.estimatedShip}.`;
    $('#order-sheet').showModal();
  } catch (err) { toast(err.message); }
  $('#order').disabled = false;
}

async function api(path, body) {
  const res = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Gallery ----------

function showGallery() {
  const items = store.get('atelier-gallery', []);
  $('#gallery-empty').hidden = items.length > 0;
  $('#gallery-grid').innerHTML = items.map(p => `<button class="gallery-item" data-piece="${p.id}">
    <div class="thumb art">${drawingSvg(historyOf(p.pgn), cleanStyle(p.style), {grid: p.grid})}</div>
    <strong>${escape(p.title)}</strong><small>${escape(p.caption)}</small>
  </button>`).join('');
  $$('[data-piece]').forEach(b => b.addEventListener('click', () => { state.piece = items.find(p => p.id === b.dataset.piece); go('reveal'); }));
}

$$('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
});

function haptic() { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8); } catch {} }

show('home');
