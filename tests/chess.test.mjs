import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess,chooseMove} from '../dist/chess-engine.js';
import {matchArtwork} from '../dist/chess-art.js';
import {games} from '../nexus/recipes.js';
test('chess rejects illegal moves, recognizes checkmate, and restores persisted matches',()=>{
  const chess=new Chess();assert.throws(()=>chess.move('e5'));for(const move of ['f3','e5','g4','Qh4#'])chess.move(move);assert.ok(chess.isCheckmate());const restored=new Chess();restored.loadPgn(chess.pgn());assert.equal(restored.fen(),chess.fen());assert.ok(restored.isCheckmate());
});
test('computer picks a legal response without changing the player board',()=>{
  const chess=new Chess();chess.move('e4');const before=chess.fen(),history=chess.history();const move=chooseMove(chess,2);assert.ok(chess.moves().includes(move.san));assert.equal(chess.fen(),before);assert.deepEqual(chess.history(),history);chess.move(move);assert.equal(chess.turn(),'w');
});
test('castling, en passant, and all four promotion choices are legal',()=>{
  const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert.ok(castle.moves().includes('O-O'));castle.move('O-O');assert.equal(castle.get('f1').type,'r');
  const enpassant=new Chess();for(const move of ['e4','a6','e5','d5','exd6'])enpassant.move(move);assert.equal(enpassant.get('d5'),undefined);assert.equal(enpassant.get('d6').type,'p');
  const promotion=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.deepEqual(promotion.moves({square:'a7',verbose:true}).map(m=>m.promotion).sort(),['b','n','q','r']);
});
test('third game is authorized and its design is derived from actual match moves',()=>{
  assert.ok(games.has('chess-atelier'));const chess=new Chess();chess.move('e4');const art=matchArtwork(chess.history({verbose:true}));assert.ok(art.startsWith('<svg'));assert.notEqual(art,matchArtwork([]));assert.match(art,/1 MOVES/);
});
