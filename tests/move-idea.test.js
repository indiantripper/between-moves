import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { shortMoveIdea } from '../src/move-idea.js';
test('short next-move ideas describe the current side and verified targets',()=>{
  const g=new Chess();g.move('e4');g.move('d5');g.move('exd5');
  assert.equal(shortMoveIdea(g.fen(),{pv:['g8f6']}),'Attack the pawn on d5.');
  assert.equal(shortMoveIdea(g.fen(),{pv:['d8d5']}),'Capture the pawn on d5.');
  assert.equal(shortMoveIdea(g.fen(),{pv:['g7g6']}),'Make room to develop your bishop.');
  g.move('Nf6');
  assert.equal(shortMoveIdea(g.fen(),{pv:['d2d4']}),'Claim more space in the centre.');
  assert.equal(shortMoveIdea(g.fen(),{pv:['g1f3']}),'Develop a piece; control the centre.');
});
test('compact ideas distinguish mate, check, castling and promotion',()=>{
  assert.match(shortMoveIdea('7k/8/5KQ1/8/8/8/8/8 w - - 0 1',{pv:['g6g7']}),/checkmate/);
  assert.match(shortMoveIdea('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',{pv:['e1g1']}),/Protect your king/);
  assert.match(shortMoveIdea('4k3/P7/8/8/8/8/8/4K3 w - - 0 1',{pv:['a7a8q']}),/Promote/);
});
