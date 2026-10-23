import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../web/vendor/chess.js';
import {layers, motion, drawingSvg, paceFor, timing} from '../web/drawing.js';
import {MEDIUMS, cleanStyle, inksOf, DEFAULT_STYLE} from '../web/styles.js';
import {pigmentMix} from '../web/paint.js';
import {CLASSICS} from '../web/classics.js';

const historyOf = pgn => { const c = new Chess(); c.loadPgn(pgn); return {chess: c, moves: c.history({verbose: true})}; };
const opera = historyOf(CLASSICS[0].pgn).moves;
const style = medium => ({...DEFAULT_STYLE, medium});

test('every famous match is a legal game that ends the way we say', () => {
  for (const legend of CLASSICS) {
    const {chess} = historyOf(legend.pgn);
    if (legend.ending) assert.equal(chess.isGameOver(), false, legend.id);
    else assert.equal(chess.isCheckmate(), true, legend.id);
  }
});

test('lines: 32 starting dots, and every move adds a stroke and a landing dot', () => {
  assert.equal(layers([], style('lines')).filter(p => p.kind === 'origin').length, 32);
  const m = layers(historyOf('1. e4 e5 2. Nf3').moves, style('lines'));
  assert.equal(m.filter(p => p.kind === 'path').length, 3);
  assert.equal(m.filter(p => p.kind === 'dot').length, 3);
});

test('captures, castling and checkmate are marked in every medium', () => {
  const last = opera.length - 1, castle = opera.findIndex(x => x.san === 'O-O-O');
  for (const {id} of MEDIUMS) {
    const prims = layers(opera, style(id));
    assert.ok(prims.filter(p => p.i === castle && p.anim === 'draw').length >= 2, `${id} castling draws king and rook`);
    assert.ok(prims.some(p => p.i === last && ['ring', 'enso', 'bloom', 'sparkle', 'loop'].includes(p.kind)), `${id} marks the mate`);
    assert.ok(prims.every(p => ['w', 'b', 'n'].includes(p.side)), `${id} assigns every mark a pigment`);
  }
});

test('motion: a piece starts at rest, is fastest mid-move, and settles', () => {
  const steps = motion({a: [0.5, 7.5], c: [0.5, 5.5], b: [0.5, 3.5]});
  assert.equal(steps[0].v, 0);
  assert.equal(steps.at(-1).v, 0);
  assert.ok(steps[18].v > 0.95);
  const knight = motion({a: [1.5, 7.5], c: [1.5, 5.5], b: [2.5, 5.5], knight: true});
  assert.ok(knight[18].lift > 0.9 && knight[0].lift === 0, 'a knight lifts off mid-jump');
});

test('the same game and style always make the same picture', () => {
  const s = style('brush');
  assert.equal(drawingSvg(opera, s), drawingSvg(opera, s));
  assert.notEqual(drawingSvg(opera, s), drawingSvg(opera, {...s, white: '#123456'}));
});

test('pigments mix like paint: blue over yellow is green, and crossings make a new color', () => {
  const paper = '#F3EBDD', yellow = '#E8C21E', blue = '#1F4FA0';
  const [r, g, b] = pigmentMix(paper, yellow, 1.5, blue, 1.5);
  assert.ok(g > r && g > b, `expected green, got ${[r, g, b]}`);
  assert.deepEqual(pigmentMix(paper, yellow, 0, blue, 0), pigmentMix(paper, blue, 0, yellow, 0));
  const alone = pigmentMix(paper, '#E0745A', 1.5, '#1F7A72', 0), crossed = pigmentMix(paper, '#E0745A', 1.5, '#1F7A72', 1.5);
  assert.notDeepEqual(alone, crossed);
});

test('styles are validated and pawns paint a softer tint', () => {
  assert.deepEqual(cleanStyle({board: 'red', medium: 'crayon'}), DEFAULT_STYLE);
  const inks = inksOf(DEFAULT_STYLE);
  assert.notEqual(inks.whitePawn, inks.white);
});

test('animation timing fits long games into a few seconds', () => {
  assert.ok(paceFor(80, 6) * 80 < 6000);
  const prims = layers(historyOf('1. e4 e5').moves, style('lines'));
  assert.equal(prims.filter(p => timing(p, {animate: 'last', msPerMove: 300, last: 1})).length, 2);
});
