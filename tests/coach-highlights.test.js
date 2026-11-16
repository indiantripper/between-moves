import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { coachSuggestion } from '../src/ask-coach.js';
import { previewHighlights } from '../src/coach-highlights.js';
function suggestion(moves,pv){const g=new Chess();moves.forEach(m=>g.move(m));return coachSuggestion(g.fen(),{pv});}
const role=(model,square)=>model.marks.find(m=>m.square===square)?.role;
test('an attack highlights the mover, its target and the key squares described by the coach',()=>{
  const line=suggestion(['e4','e5'],['g1f3','b8c6']);
  const marks=previewHighlights(line,1);
  assert.equal(role(marks,'g1'),'move');assert.equal(role(marks,'f3'),'move');assert.equal(role(marks,'e5'),'threat');assert.equal(role(marks,'d4'),'idea');
  assert.ok(marks.lines.some(l=>l.from==='f3'&&l.to==='e5'&&l.role==='threat'));
  assert.deepEqual(previewHighlights(line,0),{marks:[],lines:[]});assert.deepEqual(previewHighlights(null,1),{marks:[],lines:[]});
});
test('pins identify the attacker, pinned piece and king with the actual pin ray',()=>{
  const line=suggestion(['d4','Nf6','c4','e6'],['b1c3','f8b4','g1f3']);
  const marks=previewHighlights(line,2);
  for(const square of ['b4','c3','e1'])assert.equal(role(marks,square),'pin');
  assert.ok(marks.lines.some(l=>l.from==='b4'&&l.to==='e1'&&l.role==='pin'));
  assert.deepEqual(previewHighlights(line,2),marks);
  assert.equal(previewHighlights(line,1).lines.some(l=>l.role==='pin'),false);
});
test('White pins are explained and highlighted when the player is Black',()=>{
  const line=suggestion(['e4'],['d7d6','f1b5']);
  // The d7 pawn has moved: Bb5+ checks, not pins, the king.
  const checks=previewHighlights(line,2);assert.equal(role(checks,'e8'),'threat');assert.equal(checks.lines.some(l=>l.role==='pin'),false);
  // Start with Black to move before White plays Bg5, targeting Nf6/Qd8.
  const black=suggestion(['d4','Nf6','c4','e6','Nc3'],['d7d5','c1g5']);
  const pins=previewHighlights(black,2);for(const sq of ['g5','f6','d8'])assert.equal(role(pins,sq),'pin');
});
test('check and possible captures are marked on the displayed board without playing the reply',()=>{
  const checks=suggestion(['e4','e5','Nf3','Nc6'],['d2d4','f8b4']);
  const possible=previewHighlights(checks,1);
  assert.ok(possible.lines.some(l=>l.from==='f8'&&l.to==='b4'&&l.conditional));
  const actual=previewHighlights(checks,2);assert.equal(role(actual,'e1'),'threat');assert.ok(actual.lines.some(l=>l.from==='b4'&&l.to==='e1'&&!l.conditional));
  const capture=suggestion([],['e2e4','d7d5','e4d5','d8d5']);
  const beforeReply=previewHighlights(capture,3);assert.equal(role(beforeReply,'d5'),'threat');assert.equal(role(beforeReply,'d8'),'threat');
  assert.ok(beforeReply.lines.some(l=>l.from==='d8'&&l.to==='d5'&&l.conditional));
});
test('support, castling and en passant square highlights track the actual move',()=>{
  const supported=suggestion(['e4','e5','Nf3','Nc6'],['f1c4','d7d6']);
  assert.equal(role(previewHighlights(supported,2),'e5'),'support');
  const castle=coachSuggestion('r3k2r/ppp2ppp/2n5/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1',{pv:['e1g1']});
  for(const sq of ['e1','g1','h1','f1'])assert.equal(role(previewHighlights(castle,1),sq),'move');
  const ep=coachSuggestion('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',{pv:['e5d6']});assert.equal(role(previewHighlights(ep,1),'d5'),'threat');
});
