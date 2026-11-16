import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { bestMovePreview } from '../src/best-move-preview.js';
import { previewSuggestion,previewLesson } from '../src/ask-coach.js';
function recordAt(moves,played,pv,reply){
  const g=new Chess();for(const m of moves)g.move(m);const before=g.fen(),ply=g.history().length,move=g.move(played);
  const attempt={before,ply,uci:move.lan,lines:[{pv}]};if(reply)g.move(reply);
  return {record:{moves:g.history({verbose:true}).map(m=>m.lan),attempts:[attempt]},attempt,live:g.fen()};
}
test('best preview replaces only the displayed decision and preserves the later opponent move',()=>{
  const {record,attempt,live}=recordAt(['e4','e5','Nf3'],'Na6',['b8c6','f1b5'],'Bc4');
  const saved=JSON.stringify(record),p=bestMovePreview(record,attempt);
  assert.equal(new Chess(p.fen).get('c6').type,'n');assert.equal(new Chess(p.fen).get('a6'),undefined);
  assert.equal(p.step,1);assert.equal(p.line.length,2);
  const reply=previewSuggestion(p.suggestion,2);assert.equal(new Chess(reply.fen).get('b5').type,'b');
  assert.match(previewLesson(p.suggestion,1).reason,/defender.*e5/);
  assert.match(previewLesson(p.suggestion,2).heading,/Opponent’s reply.*Bb5/);
  assert.equal(JSON.stringify(record),saved);
  const replay=new Chess();for(const m of record.moves)replay.move({from:m.slice(0,2),to:m.slice(2,4)});assert.equal(replay.fen(),live);
});
test('White alternatives use the position before the move and short terminal lines remain valid',()=>{
  const {record,attempt}=recordAt([],'a3',['e2e4','e7e5'],'d5');
  const p=bestMovePreview(record,attempt);assert.equal(new Chess(p.fen).get('e4').color,'w');
  assert.equal(new Chess(p.fen).get('a2').type,'p');
  const terminal=new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');const before=terminal.fen(),m=terminal.move('Qg7#');
  const a={before,ply:0,uci:m.lan,lines:[{pv:[m.lan]}]};const r={startFen:before,moves:[m.lan]};
  assert.equal(bestMovePreview(r,a).line.length,1);assert.equal(new Chess(bestMovePreview(r,a).fen).isCheckmate(),true);
});
test('stale, malformed and unrelated saved lines cannot preview another decision',()=>{
  const {record,attempt}=recordAt(['e4'],'a6',['e7e5','g1f3']);
  assert.equal(bestMovePreview(record,{...attempt,uci:'h7h6'}),null);
  assert.equal(bestMovePreview(record,{...attempt,before:new Chess().fen()}),null);
  assert.equal(bestMovePreview(record,{...attempt,lines:[{pv:['a7a4']}]}),null);
});
