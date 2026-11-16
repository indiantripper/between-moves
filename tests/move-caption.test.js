import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { moveCaption } from '../src/move-caption.js';
function record(moves){const g=new Chess();return {color:'w',moves:moves.map(m=>g.move(m).lan)};}
test('mobile captions show move names for both sides and earlier positions',()=>{
  const r=record(['e4','e5','Nf3','Nc6']);
  assert.equal(moveCaption(r),'2. Nf3  ·  2… Nc6');
  assert.equal(moveCaption(r,{historyPly:1}),'1. e4');
  assert.equal(moveCaption(r,{historyPly:0}),'Starting position · White to move');
  assert.equal(moveCaption(null),'Start a practice to play');
});
test('variation captions retain full move numbers for Black starts and each preview step',()=>{
  const g=new Chess();g.move('e4');const r=record(['e4','e5']);
  const view={base:g.fen(),line:['c7c5','g1f3'],step:0};
  assert.equal(moveCaption(r,view),'Preview · before 1… c5');
  assert.equal(moveCaption(r,{...view,step:1}),'Preview · 1… c5');
  assert.equal(moveCaption(r,{...view,step:2}),'Preview · 1… c5  ·  2. Nf3');
  assert.deepEqual(r.moves,['e2e4','e7e5']);
});
test('replacement instructions name the original reply and the side to drag',()=>{
  const g=new Chess();g.move('e4');const r=record(['e4','e5']);
  assert.equal(moveCaption(r,{fen:g.fen(),opponentEdit:{ply:1,san:'e5'}}),'Instead of 1… e5 · Drag a Black piece');
  assert.equal(moveCaption(r,{fen:new Chess().fen(),opponentEdit:{ply:0,san:'e4'}}),'Instead of 1. e4 · Drag a White piece');
});
