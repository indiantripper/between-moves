import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { moveInWords,moveWords } from '../src/move-language.js';
import { moveTranslation } from '../src/move-caption.js';
test('identical pawn-capture notation uses the actual origin and captured piece',()=>{
  const black=new Chess('4k3/8/3p4/4P3/8/8/8/4K3 b - - 0 1');const b=black.move('dxe5');
  assert.equal(moveInWords(b),'Pawn from d6 captures the pawn on e5.');
  const white=new Chess('4k3/8/8/4n3/3P4/8/8/4K3 w - - 0 1');const w=white.move('dxe5');
  assert.equal(moveInWords(w),'Pawn from d4 captures the knight on e5.');
});
test('piece moves, checks and mate use plain names and exact starting squares',()=>{
  assert.equal(moveWords(new Chess().fen(),'g1f3'),'Knight moves from g1 to f3.');
  assert.equal(moveWords('4k3/8/8/8/8/2B5/8/4K3 w - - 0 1','c3e5'),'Bishop moves from c3 to e5.');
  assert.match(moveWords('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1','f7g7'),/checkmate/);
  assert.equal(moveWords(new Chess().fen(),'e2e5'),'');
});
test('special moves describe the real capture square, rook movement and promotion',()=>{
  assert.equal(moveWords('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2','e5d6'),'Pawn from e5 captures the pawn on d5 and moves to d6 (en passant).');
  assert.equal(moveWords('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1g1'),'King castles kingside: e1 to g1, rook h1 to f1.');
  assert.match(moveWords('7k/P7/8/8/8/8/8/4K3 w - - 0 1','a7a8q'),/Pawn moves from a7 to a8 and promotes to a queen/);
});
test('history and previews translate the displayed move without changing the record',()=>{
  const r={moves:['e2e4','d7d5'],attempts:[]};const saved=JSON.stringify(r);
  assert.equal(moveTranslation(r),'Black: Pawn moves from d7 to d5.');
  assert.equal(moveTranslation(r,{historyPly:1}),'White: Pawn moves from e2 to e4.');
  assert.equal(moveTranslation(r,{base:new Chess().fen(),line:['g1f3','d7d5'],step:1}),'White: Knight moves from g1 to f3.');
  assert.equal(JSON.stringify(r),saved);
});
