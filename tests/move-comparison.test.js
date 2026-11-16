import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { compareMove } from '../src/move-comparison.js';
import { pieceQualityTarget } from '../src/quick-coach.js';
import { editedSession } from '../src/position-editor.js';
const attempt=(fen,played,best,cp=-20,bestCp=35)=>({before:fen,uci:played[0],actual:{cp,pv:played},lines:[{cp:bestCp,pv:best}],grade:{severity:1},depth:18});
test('pawn advance explains the missed capture and shows both legal continuations',()=>{
  const g=new Chess();g.move('e4');g.move('d5');
  const c=compareMove(attempt(g.fen(),['e4e5','c8f5','d2d4'],['e4d5','d8d5','b1c3']));
  assert.match(c.cause,/leaves.*pawn on d5/);assert.match(c.cost,/0.55/);assert.match(c.reply,/Bf5/);
  assert.deepEqual(c.bestLine,['exd5','Qxd5','Nc3']);assert.equal(c.uncertain,false);
});
test('moving the only defender explains the capture it permits',()=>{
  const c=compareMove(attempt('3rk3/8/8/8/3P4/5N2/8/4K3 w - - 0 1',['f3h4','d8d4'],['d4d5','d8d5']));
  assert.match(c.cause,/removes its defence of d4/);assert.match(c.reply,/Rxd4/);
});
test('unknown positional reasons remain explicit while engine evidence stays available',()=>{
  const c=compareMove(attempt(new Chess().fen(),['a2a3','e7e5'],['g1f3','d7d5']));
  assert.equal(c.uncertain,true);assert.equal(c.cause,'');assert.match(c.cost,/0.55/);assert.ok(c.reply);
  assert.equal(compareMove(attempt(new Chess().fen(),['a2a5'],['g1f3'])),null);
});
test('Black evaluation loss is mover-relative and displayed scores are White-relative',()=>{
  const g=new Chess();g.move('e4');const c=compareMove(attempt(g.fen(),['a7a6','d2d4'],['e7e5','g1f3'],-100,20));
  assert.match(c.cost,/1.20/);assert.equal(c.playedScore,'+1.00');assert.equal(c.bestScore,'-0.20');
});
test('mate evidence never becomes a fictitious material loss',()=>{
  const a=attempt(new Chess().fen(),['f2f3','e7e5'],['e2e4']);a.actual={mate:-3,pv:a.actual.pv};
  const c=compareMove(a);assert.match(c.cause,/mating attack/);assert.match(c.cost,/forced mate/);assert.doesNotMatch(c.cost,/pawns/);
});
test('Free play badges follow alternating sides and mode survives position editing',()=>{
  const g=new Chess(),record={id:'free',mode:'free',color:'w',moves:[]};
  for(const san of ['e4','e5','Nf3','Nc6']){const before=g.fen(),m=g.move(san);record.moves.push(m.lan);assert.equal(pieceQualityTarget(record,g,{before,uci:m.lan,ply:record.moves.length-1}),m.to);}
  assert.equal(editedSession(record,g.fen(),'w','edit').mode,'free');
});
