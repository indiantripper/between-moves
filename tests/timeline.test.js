import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { positionAt, forkSession } from '../src/timeline.js';
import { identifyOpening, openingForMove, openingAt } from '../src/openings.js';
import { learningSummary } from '../src/coach.js';

function record(sans) {
  const g=new Chess(),attempts=[];
  for(const san of sans){
    const before=g.fen(),ply=g.history().length,move=g.move(san);
    if(move.color==='w')attempts.push({before,after:g.fen(),ply,uci:move.lan,retry:false,assisted:false,grade:{label:'Good move',severity:0,loss:10},explanation:{tags:[]}});
  }
  return {id:'original',moves:g.history({verbose:true}).map(m=>m.lan),attempts,color:'w',finished:true,result:'saved'};
}
test('rewind one, two, or three plies preserves the correct side and position',()=>{
  const r=record(['e4','e5','Nf3','Nc6','Bc4','Nf6']);
  assert.deepEqual(positionAt(r,5).history(),['e4','e5','Nf3','Nc6','Bc4']);
  assert.equal(positionAt(r,5).turn(),'b');
  assert.deepEqual(positionAt(r,4).history(),['e4','e5','Nf3','Nc6']);
  assert.equal(positionAt(r,4).turn(),'w');
  assert.equal(positionAt(r,3).get('f3').type,'n');
  assert.equal(positionAt(r,0).history().length,0);
});
test('trying an earlier position preserves the original line and excludes inherited decisions',()=>{
  const r=record(['e4','e5','Nf3','Nc6','Bc4','Nf6']);
  const original=structuredClone(r),branch=forkSession(r,2,'variation','2026-11-16');
  assert.deepEqual(r,original);
  assert.equal(branch.parentId,'original');assert.equal(branch.finished,false);assert.equal(branch.branchPly,2);
  const g=positionAt(branch,2);g.move('Bc4');
  branch.moves=g.history({verbose:true}).map(m=>m.lan);
  assert.deepEqual(positionAt(r,6).history(),['e4','e5','Nf3','Nc6','Bc4','Nf6']);
  assert.deepEqual(g.history(),['e4','e5','Bc4']);
  assert.equal(learningSummary([r,branch]).unassisted,3);
  assert.equal(branch.attempts[0].inherited,true);
});
test('history replay preserves castling rights, en passant and checkmate escapes',()=>{
  const r=record(['e4','a6','e5','d5','exd6']);
  const g=positionAt(r,4);assert.ok(g.moves().includes('exd6'));
  const castle=record(['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O']);
  assert.ok(positionAt(castle,6).moves().includes('O-O'));
  const mate=record(['f3','e5','g4','Qh4#']);
  assert.equal(positionAt(mate,4).isCheckmate(),true);
  assert.equal(positionAt(forkSession(mate,2,'escape'),2).isGameOver(),false);
});
test('recognises named openings from moves rather than the selected practice',()=>{
  for(const [moves,name] of [
    [['e4','e5','Nf3','Nc6','c3'],/Ponziani/],
    [['e4','c6'],/Caro.Kann/],
    [['e4','c5'],/Sicilian/],
    [['d4','Nf6'],/Indian/],
    [['d4','d5','Bf4'],/London/],
    [['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6'],/King.s Indian/]
  ]){
    const g=new Chess();moves.forEach(m=>g.move(m));assert.match(identifyOpening(g).name,name);
  }
});
test('candidate book names and identification survive continuations beyond a named position',()=>{
  const g=new Chess();g.move('e4');
  assert.match(openingForMove(g.fen(),'c7c6').name,/Caro.Kann/);
  assert.match(openingForMove(g.fen(),'c7c5').name,/Sicilian/);
  ['c6','h3','h6'].forEach(m=>g.move(m));
  assert.match(identifyOpening(g).name,/Caro.Kann/);
  assert.equal(openingAt(new Chess().fen()),null);
});
