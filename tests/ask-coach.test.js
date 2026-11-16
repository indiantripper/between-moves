import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { coachSuggestion,usedCoachHelp,previewSuggestion,previewLesson } from '../src/ask-coach.js';
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

test('preview steps through the suggestion and reply without touching the game or saved line',()=>{
  const game=new Chess();game.move('e4');game.move('e5');
  const fen=game.fen(),history=game.history(),suggestion=coachSuggestion(fen,{pv:['g1f3','b8c6','f1b5']});
  const saved=structuredClone(suggestion);
  const own=previewSuggestion(suggestion,1),reply=previewSuggestion(suggestion,2);
  assert.equal(new Chess(own.fen).get('f3').type,'n');assert.equal(new Chess(own.fen).turn(),'b');
  assert.equal(new Chess(reply.fen).get('c6').type,'n');assert.equal(new Chess(reply.fen).turn(),'w');
  assert.equal(reply.last.san,'Nc6');assert.equal(reply.next,'f1b5');
  assert.equal(previewSuggestion(suggestion,0).fen,fen);
  assert.equal(previewSuggestion(suggestion,99).step,3);
  assert.equal(previewSuggestion(suggestion,-1).step,0);
  assert.equal(game.fen(),fen);assert.deepEqual(game.history(),history);assert.deepEqual(suggestion,saved);
});
test('Black previews, castling, en passant, promotion and short terminal lines stay legal',()=>{
  const black=new Chess();black.move('e4');
  const suggestion=coachSuggestion(black.fen(),{pv:['c7c5','g1f3']});
  assert.equal(new Chess(previewSuggestion(suggestion,2).fen).turn(),'b');
  const castle=coachSuggestion('r3k2r/ppp2ppp/2n5/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1',{pv:['e1g1','e8c8']});
  const castled=new Chess(previewSuggestion(castle,2).fen);
  assert.equal(castled.get('f1').type,'r');assert.equal(castled.get('d8').type,'r');
  const ep=coachSuggestion('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',{pv:['e5d6','e8d7']});
  assert.equal(new Chess(previewSuggestion(ep,1).fen).get('d5'),undefined);
  const promoted=coachSuggestion('4k3/P7/8/8/8/8/8/4K3 w - - 0 1',{pv:['a7a8n']});
  assert.equal(new Chess(previewSuggestion(promoted,1).fen).get('a8').type,'n');
  const mate=new Chess();['f3','e5','g4'].forEach(m=>mate.move(m));
  const finish=coachSuggestion(mate.fen(),{pv:['d8h4','e1e2']});
  assert.equal(finish.pv.length,1);assert.equal(new Chess(previewSuggestion(finish,2).fen).isCheckmate(),true);
});

test('each preview lesson follows its exact move and restores the same explanation on rewind',()=>{
  const g=new Chess();g.move('e4');g.move('e5');
  const suggestion=coachSuggestion(g.fen(),{pv:['g1f3','b8c6','f1b5','a7a6','b5c6','d7c6']});
  const snapshot=structuredClone(suggestion),first=previewLesson(suggestion,1),reply=previewLesson(suggestion,2);
  assert.equal(first.actor,'you');assert.match(first.heading,/Your move.*White Nf3/);assert.match(first.reason,/pawn on e5/);
  assert.equal(reply.actor,'opponent');assert.match(reply.heading,/Black Nc6/);assert.match(reply.reason,/knight.*c6/);assert.ok(reply.plan);assert.ok(reply.watch);
  assert.match(reply.next,/White: Bb5/);
  const recapture=previewLesson(suggestion,6);assert.match(recapture.reason,/recaptures on c6.*bishop/);
  assert.equal(recapture.next,'');assert.deepEqual(previewLesson(suggestion,2),reply);assert.deepEqual(suggestion,snapshot);
  assert.equal(previewLesson(suggestion,0).actor,'start');assert.equal(previewLesson(null,1),null);
});
test('opponent pins and checks explain the threat from the player’s perspective',()=>{
  const g=new Chess();['d4','Nf6','c4','e6'].forEach(m=>g.move(m));
  const pin=coachSuggestion(g.fen(),{pv:['b1c3','f8b4','g1f3']});
  const lesson=previewLesson(pin,2);assert.match(lesson.reason,/knight on c3.*king behind/);assert.match(lesson.watch,/expose your king/);
  const checks=new Chess();['e4','e5','Nf3','Nc6'].forEach(m=>checks.move(m));
  const line=coachSuggestion(checks.fen(),{pv:['d2d4','f8b4']});
  assert.match(previewLesson(line,1).watch,/Bb4.*gives check/);
  assert.match(previewLesson(line,2).watch,/Your king is in check/);
});
test('Black players get White opponent lessons, captures are conditional, and mate ends the warning',()=>{
  const g=new Chess();g.move('e4');
  const black=coachSuggestion(g.fen(),{pv:['e7e5','g1f3']});
  const whiteReply=previewLesson(black,2);assert.equal(whiteReply.actor,'opponent');assert.match(whiteReply.heading,/White Nf3/);assert.match(whiteReply.reason,/your pawn on e5/);
  const exchange=coachSuggestion(new Chess().fen(),{pv:['e2e4','d7d5','e4d5','d8d5']});
  assert.match(previewLesson(exchange,3).watch,/Qxd5.*capturing your pawn/);
  assert.match(previewLesson(exchange,4).reason,/recaptures/);
  const mate=new Chess();['f3','e5','g4'].forEach(m=>mate.move(m));
  const finish=coachSuggestion(mate.fen(),{pv:['d8h4']});
  const lesson=previewLesson(finish,1);assert.match(lesson.watch,/delivered checkmate/);assert.equal(lesson.next,'');
});
