import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { coachSuggestion,usedCoachHelp } from '../src/ask-coach.js';
import { learningSummary } from '../src/coach.js';
test('a suggestion explains the legal move and verified central pawn attack',()=>{
  const g=new Chess();g.move('e4');g.move('e5');
  const result=coachSuggestion(g.fen(),{cp:25,pv:['g1f3','b8c6']});
  assert.equal(result.san,'Nf3');assert.equal(result.from,'g1');assert.equal(result.to,'f3');
  assert.match(result.idea,/pawn on e5/);assert.deepEqual(result.line,['Nf3','Nc6']);
  assert.doesNotMatch(result.hint,/Nf3|f3|g1/);
});
test('Black receives a legal Black move, with check and promotion handled',()=>{
  const g=new Chess();g.move('e4');
  assert.equal(coachSuggestion(g.fen(),{pv:['c7c5']}).san,'c5');
  const check=coachSuggestion('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1',{pv:['e1e2']});
  assert.match(check.hint,/king is in check/);
  const promotion=coachSuggestion('4k3/P7/8/8/8/8/8/4K3 w - - 0 1',{pv:['a7a8q']});
  assert.match(promotion.idea,/Promote.*queen/);
});
test('invalid suggestions and finished positions never produce a move',()=>{
  assert.equal(coachSuggestion(new Chess().fen(),{pv:['e2e5']}),null);
  assert.equal(coachSuggestion(new Chess().fen(),null),null);
  assert.equal(coachSuggestion('4k3/8/8/8/8/8/8/4K3 w - - 0 1',{pv:['e1d1']}),null);
});
test('help survives saving and only marks the exact decision as assisted',()=>{
  const fen=new Chess().fen(),record=JSON.parse(JSON.stringify({hints:[{fen,ply:0}]}));
  assert.equal(usedCoachHelp(record,fen,0),true);assert.equal(usedCoachHelp(record,fen,2),false);
  const g=new Chess();g.move('e4');assert.equal(usedCoachHelp(record,g.fen(),0),false);
  const attempts=[{assisted:usedCoachHelp(record,fen,0),grade:{label:'Good move',severity:0,loss:0}}];
  assert.equal(learningSummary([{attempts}]).unassisted,0);
});
