import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { positionEvaluation, materialBalance, LatestPositionAnalysis } from '../src/evaluation.js';
import { opponentMoveAt, replaceOpponentLine, positionAt, forkSession } from '../src/timeline.js';

function record(moves,color='w'){
  const g=new Chess();moves.forEach(m=>g.move(m));
  return {id:'original',color,moves:g.history({verbose:true}).map(m=>m.lan),attempts:[]};
}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));

test('evaluation normalises Black-to-move scores and bar direction to White',()=>{
  const g=new Chess();g.move('e4');
  const blackBetter=positionEvaluation(g,{line:{cp:220,pv:['c7c5']},depth:14});
  assert.equal(blackBetter.score,'-2.20');assert.match(blackBetter.headline,/Black/);assert.ok(blackBetter.whiteShare<50);
  const whiteBetter=positionEvaluation(g,{line:{cp:-170,pv:['e7e5']},depth:14});
  assert.equal(whiteBetter.score,'+1.70');assert.match(whiteBetter.headline,/White/);assert.ok(whiteBetter.whiteShare>50);
});
test('mate and terminal results override material and engine estimates',()=>{
  const g=new Chess();['f3','e5','g4'].forEach(m=>g.move(m));
  const mate=positionEvaluation(g,{line:{mate:1,pv:['d8h4']},depth:12});
  assert.match(mate.headline,/Black has a forced mate in 1/);assert.equal(mate.whiteShare,0);
  g.move('Qh4#');assert.equal(positionEvaluation(g).headline,'Black wins by checkmate');
  assert.equal(positionEvaluation(new Chess('8/8/8/8/8/8/6k1/4K3 w - - 0 1')).score,'½–½');
});
test('repetition is recognised using game history and material stays separate from evaluation',()=>{
  const g=new Chess();['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'].forEach(m=>g.move(m));
  assert.match(positionEvaluation(g).headline,/threefold repetition/);
  const down=new Chess('r3k2r/pppp1ppp/2n1bn2/4p3/4P3/2N1BN2/PPPP1PPP/R2QK2R w KQkq - 0 1');
  assert.equal(materialBalance(down).difference,9);
  const model=positionEvaluation(down,{line:{cp:-200,pv:['d1e2']},depth:12});
  assert.match(model.headline,/Black/);assert.ok(model.facts.some(f=>f.includes('despite the material')));
});
test('an opponent override preserves the original and returns the turn to the user',()=>{
  const r=record(['e4','e5','Nf3','Nc6']);const before=structuredClone(r);
  const target=opponentMoveAt(r);assert.equal(target.ply,3);assert.equal(target.san,'Nc6');
  const branch=replaceOpponentLine(r,1,'c7c5','variation');
  assert.deepEqual(r,before);assert.deepEqual(positionAt(branch,branch.moves.length).history(),['e4','c5']);
  assert.equal(positionAt(branch,2).turn(),'w');assert.equal(branch.overrides[0].replacedSan,'e5');
  assert.equal(branch.parentId,r.id);assert.equal(branch.finished,false);
  assert.equal(forkSession(branch,1,'earlier').overrides.length,0);
});
test('Black can replace White moves, but illegal or own-side replacements are rejected',()=>{
  const r=record(['e4','e5','Nf3'],'b');
  const branch=replaceOpponentLine(r,0,'d2d4','variation');
  assert.equal(positionAt(branch,1).turn(),'b');assert.deepEqual(positionAt(branch,1).history(),['d4']);
  assert.throws(()=>replaceOpponentLine(r,1,'c7c5','bad'),/your move/);
  assert.throws(()=>replaceOpponentLine(r,0,'e2e5','bad'));
  assert.throws(()=>replaceOpponentLine(r,5,'e2e4','bad'));
});
test('rapid navigation coalesces searches and an old result cannot overwrite the viewed position',async()=>{
  const requests=[],updates=[],pending=new Map();
  const analyser=new LatestPositionAnalysis(fen=>{requests.push(fen);return new Promise(resolve=>pending.set(fen,resolve));},s=>updates.push(s));
  analyser.request('A');analyser.request('B');analyser.request('C');
  pending.get('A')({line:{cp:100,pv:[]},depth:10});await nextTurn();
  assert.deepEqual(requests,['A','C']);assert.equal(analyser.state.fen,'C');assert.equal(analyser.state.loading,true);
  pending.get('C')({line:{cp:-100,pv:[]},depth:10});await nextTurn();
  assert.equal(analyser.state.analysis.line.cp,-100);
  assert.equal(updates.filter(u=>u.analysis).some(u=>u.fen==='A'),false);
  analyser.request('A');assert.equal(analyser.state.analysis.line.cp,100);assert.equal(requests.length,2);
});
test('hidden evaluation stops updates and failed evaluations can be retried',async()=>{
  let resolve,updates=[];
  const analyser=new LatestPositionAnalysis(()=>new Promise(r=>resolve=r),s=>updates.push(s));
  analyser.request('A');analyser.pause();resolve({line:{cp:20,pv:[]}});await nextTurn();
  assert.equal(updates.filter(s=>s.analysis).length,0);
  let attempts=0;
  const retry=new LatestPositionAnalysis(async()=>{if(attempts++===0)throw Error('Temporary failure');return {line:{cp:25,pv:[]}};},()=>{});
  retry.request('A');await nextTurn();assert.equal(retry.state.error,'Temporary failure');
  retry.retry('A');await nextTurn();assert.equal(retry.state.analysis.line.cp,25);
});
