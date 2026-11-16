import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { explainOpponentMove } from '../src/opponent-coach.js';

function ideaFor(moves,extra={}){
  const g=new Chess();moves.slice(0,-1).forEach(m=>g.move(m));
  const before=g.fen(),previousMove=g.history({verbose:true}).at(-1),move=g.move(moves.at(-1));
  return explainOpponentMove({before,uci:move.lan,previousMove,...extra});
}
test('explains development together with the concrete central pawn attack',()=>{
  const idea=ideaFor(['e4','e5','Nf3','Nf6']);
  assert.equal(idea.side,'Black');assert.match(idea.reason,/starting square/);assert.match(idea.reason,/pawn on e4/);
  assert.ok(idea.plan.length>10);
});
test('explains an absolute pin and distinguishes a double attack',()=>{
  const pin=ideaFor(['d4','Nf6','c4','e6','Nc3','Bb4']);
  assert.match(pin.reason,/knight on c3/);assert.match(pin.reason,/king behind/);assert.match(pin.watch,/expose your king/);
  const fork=explainOpponentMove({before:'4k1nr/8/8/3Q4/6B1/8/8/4K3 b - - 0 1',uci:'g8f6'});
  assert.match(fork.reason,/fork/);assert.match(fork.reason,/queen on d5/);assert.match(fork.reason,/bishop on g4/);
});
test('recaptures and king checks get specific explanations',()=>{
  const recapture=ideaFor(['e4','e5','Nf3','Nc6','d4','exd4','Nxd4','Nxd4']);
  assert.match(recapture.reason,/recaptures on d4/);assert.match(recapture.reason,/knight/);
  const mate=ideaFor(['f3','e5','g4','Qh4#']);assert.match(mate.reason,/checkmate/);
});
test('identifies pawn support and a bishop fianchetto without inventing a forced plan',()=>{
  const support=ideaFor(['e4','e5','Nf3','Nc6','Bc4','d6']);
  assert.match(support.reason,/defender.*pawn on e5/);
  const bishop=ideaFor(['d4','Nf6','c4','g6']);
  assert.match(bishop.reason,/opens g7.*bishop on f8/);assert.match(bishop.plan,/bishop to g7/);
});
test('engine follow-ups are legal, conditional English and tied to the exact position',()=>{
  const before=new Chess();before.move('e4');
  const after=new Chess(before.fen());after.move('e5');
  const args={before:before.fen(),uci:'e7e5'};
  const analysis={fen:after.fen(),line:{cp:25,pv:['g1f3','b8c6']}};
  const idea=explainOpponentMove({...args,analysis});
  assert.equal(idea.plan,'If you move your knight to f3, Black could move its knight to c6.');
  const stale=explainOpponentMove({...args,analysis:{...analysis,fen:before.fen()}});
  assert.doesNotMatch(stale.plan,/If you/);
  const invalid=explainOpponentMove({...args,analysis:{...analysis,line:{pv:['a1a8','b8c6']}}});
  assert.doesNotMatch(invalid.plan,/If you/);
});
test('also explains White as the opponent, and rejects illegal moves',()=>{
  const white=ideaFor(['d4','Nf6','Nf3']);assert.equal(white.side,'White');assert.match(white.reason,/White/);
  assert.equal(explainOpponentMove({before:new Chess().fen(),uci:'e2e5'}),null);
});
test('explains Sicilian and Caro–Kann pawn moves as central control rather than an unexplained shuffle',()=>{
  const sicilian=ideaFor(['e4','c5']);assert.match(sicilian.reason,/controlling d4/);assert.match(sicilian.plan,/centre/);
  const caro=ideaFor(['e4','c6']);assert.match(caro.reason,/controlling d5/);
});
test('explains Be7 as clearing the castling path only while castling rights remain',()=>{
  const idea=ideaFor(['e4','e5','Nf3','Nc6','c3','Nf6','d4','exd4','e5','Ne4','cxd4','Be7']);
  assert.match(idea.reason,/clears the path for kingside castling/);
  const noRights=explainOpponentMove({before:'4kb1r/8/8/8/8/8/8/4K3 b - - 0 1',uci:'f8e7'});
  assert.doesNotMatch(noRights.reason,/castling/);
});
