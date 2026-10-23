import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../web/vendor/chess.js';
import {marks, drawingSvg, paceFor} from '../web/drawing.js';
import {PALETTES, paletteById} from '../web/palettes.js';
import {CLASSICS} from '../web/classics.js';

const historyOf = pgn => { const c = new Chess(); c.loadPgn(pgn); return {chess: c, moves: c.history({verbose: true})}; };

test('every legend is a legal game that ends the way we say', () => {
  for (const legend of CLASSICS) {
    const {chess} = historyOf(legend.pgn);
    if (legend.ending) assert.equal(chess.isGameOver(), false, legend.id);
    else assert.equal(chess.isCheckmate(), true, legend.id);
  }
});

test('the start is 32 dots, and every move adds a line and a landing dot', () => {
  assert.equal(marks([]).filter(m => m.kind === 'origin').length, 32);
  const {moves} = historyOf('1. e4 e5 2. Nf3');
  const m = marks(moves);
  assert.equal(m.filter(x => x.kind === 'path').length, 3);
  assert.equal(m.filter(x => x.kind === 'dot').length, 3);
});

test('captures ring, castling draws the rook too, mate leaves three rings', () => {
  const {moves} = historyOf(CLASSICS.find(l => l.id === 'opera').pgn);
  const m = marks(moves);
  const castle = moves.findIndex(x => x.san === 'O-O-O');
  assert.equal(m.filter(x => x.kind === 'path' && x.i === castle).length, 2);
  assert.ok(m.some(x => x.kind === 'ring' && x.r === 0.24));
  assert.equal(m.filter(x => x.kind === 'ring' && x.i === moves.length - 1).length, 3);
});

test('the same game always draws the same picture', () => {
  const {moves} = historyOf(CLASSICS[1].pgn);
  assert.equal(drawingSvg(moves, PALETTES[2]), drawingSvg(moves, PALETTES[2]));
  assert.notEqual(drawingSvg(moves, PALETTES[2]), drawingSvg(moves, PALETTES[3]));
});

test('the drawing is a square SVG with the paper and optional grid', () => {
  const {moves} = historyOf('1. d4 d5');
  const svg = drawingSvg(moves, paletteById('harbor'), {grid: 'lines', size: 512});
  assert.match(svg, /^<svg[^>]+viewBox="0 0 8 8" width="512" height="512"/);
  assert.match(svg, /fill="#F4EFE6"/);
  assert.match(svg, /stroke-opacity="\.09"/);
  assert.doesNotMatch(drawingSvg(moves, paletteById('harbor'), {paper: false}), /<rect/);
});

test('animation timing fits long games into a few seconds', () => {
  assert.ok(paceFor(80, 6) * 80 < 6000);
  assert.ok(paceFor(4, 6) <= 420);
  const {moves} = historyOf('1. e4 e5');
  assert.equal((drawingSvg(moves, PALETTES[0], {animate: 'last'}).match(/class="(draw|pop)"/g) || []).length, 2);
});
