import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/vendor/chess.js';
import {gameOps, moveOps, startOps, inkFor, CLASSICS} from '../dist/move-art.js';

const play = pgn => { const c = new Chess(); c.loadPgn(pgn); return c.history({verbose: true}); };

test('the same match always paints the same picture, and different matches differ', () => {
  const opera = CLASSICS.find(c => c.id === 'opera').pgn;
  assert.deepEqual(gameOps(play(opera)), gameOps(play(opera)));
  assert.notDeepEqual(gameOps(play(opera)), gameOps(play('1. d4 d5 2. c4 e6')));
});

test('every piece starts as a drop of its own ink', () => {
  const drops = startOps();
  assert.equal(drops.length, 32);
  assert.ok(drops.every(d => d.kind === 'drop'));
  assert.equal(drops[0].ink, inkFor('w', 'r'));
});

test('moves drag ink; knights travel an L; captures splash; castling moves the rook too; checkmate blooms', () => {
  const [e4] = play('1. e4');
  assert.ok(moveOps(e4).every(o => o.kind === 'swirl'));
  const knight = moveOps(play('1. Nf3')[0]);
  const turns = new Set(knight.map(o => `${Math.sign(Math.round((o.bx - o.ax) * 1e6))},${Math.sign(Math.round((o.by - o.ay) * 1e6))}`));
  assert.equal(turns.size, 2, 'a knight path has two straight legs');
  const capture = play('1. e4 d5 2. exd5').at(-1);
  assert.equal(moveOps(capture)[0].kind, 'drop');
  const castle = play('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O').at(-1);
  assert.ok(moveOps(castle).length > moveOps(play('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Kf1').at(-1)).length);
  const mate = play(CLASSICS.find(c => c.id === 'scholar').pgn).at(-1);
  assert.equal(moveOps(mate).at(-1).kind, 'drop');
});

test('the classic games are legal from start to checkmate', () => {
  for (const game of CLASSICS) {
    const c = new Chess(); c.loadPgn(game.pgn);
    assert.ok(c.isCheckmate(), `${game.name} ends in checkmate`);
  }
});
