import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { coachSuggestion } from '../src/ask-coach.js';
import { coachQuestion } from '../src/coach-questions.js';
const suggestion=(moves,pv)=>{const game=new Chess();moves.forEach(m=>game.move(m));return coachSuggestion(game.fen(),{pv});};
test('threats describe current attacks without claiming a forced material win',()=>{
  const s=suggestion(['e4','e5','Nf3'],['b8c6','f1b5']);const before=JSON.stringify(s);
  const answer=coachQuestion(s,'threat');
  assert.match(answer.text,/knight on f3 attacks your pawn on e5/);
  assert.ok(answer.lines.some(l=>l.from==='f3'&&l.to==='e5'&&!l.conditional));
  assert.match(answer.text,/does not prove a winning capture/);assert.equal(JSON.stringify(s),before);
});
test('current absolute pins highlight attacker, pinned piece and king for either side',()=>{
  const s=suggestion(['d4','Nf6','c4','e6','Nc3','Bb4'],['g1f3']);const answer=coachQuestion(s,'threat');
  assert.match(answer.text,/pins your knight on c3/);
  for(const square of ['b4','c3','e1'])assert.ok(answer.marks.some(m=>m.square===square&&m.role==='pin'));
  const black=suggestion(['e4','e5','Nf3','Nc6','Bb5','d6','d3'],['a7a6']);assert.match(coachQuestion(black,'threat').text,/king on e8/);
});
test('checks are prioritised and quiet positions never invent a threat',()=>{
  const s=suggestion(['f3','e5','g4','Qh4#'],[]); // terminal suggestions do not exist
  assert.equal(coachQuestion(s,'threat'),null);
  const g=new Chess();for(const m of ['e4','e5','d4','Bb4+'])g.move(m);
  assert.match(coachQuestion(coachSuggestion(g.fen(),{pv:['c2c3']}),'threat').text,/checking your king/);
  assert.match(coachQuestion(suggestion([],['e2e4','e7e5']),'threat').text,/No direct check/);
});
test('why and plan explain the selected legal candidate and mark future lines as conditional',()=>{
  const s=suggestion(['e4','e5'],['g1f3','b8c6']);
  const why=coachQuestion(s,'why');assert.match(why.text,/Nf3/);assert.ok(why.marks.some(m=>m.square==='e5'));
  assert.ok(why.lines.every(l=>l.conditional));
  const plan=coachQuestion(s,'plan');assert.match(plan.text,/If you play Nf3, Black could reply Nc6/);
  assert.ok(plan.lines.some(l=>l.from==='b8'&&l.to==='c6'&&l.conditional));
  assert.ok(plan.marks.every(m=>m.label.startsWith('Possible line:')));
  assert.equal(new Chess(s.fen).get('g1').type,'n');
});
test('short or illegal continuations never produce an invented opponent plan',()=>{
  const s=suggestion([],['e2e4']);assert.match(coachQuestion(s,'plan').text,/no legal reply/);
  const bad={...s,pv:['e2e4','e7e4']};assert.equal(coachQuestion(bad,'plan'),null);
  assert.equal(coachQuestion(null,'why'),null);
});
