import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {decisionReplay} from '../src/decision-replay.js';
import {compareMove} from '../src/move-comparison.js';
import {replayLesson} from '../src/replay-lesson.js';
const attempt=(before,best,actual)=>({before,uci:actual[0],lines:[{cp:500,pv:best}],actual:{cp:0,pv:actual},grade:{severity:2}});
test('a missed checking fork replays the attacking move and highlights both targets',()=>{
 const a=attempt('r3k3/8/8/3N4/8/8/8/4K3 w q - 0 1',['d5c7','e8d7','c7a8','d7e6','a8c7'],['d5e3','a8a2','e1f1','a2a8','f1e1']);const saved=JSON.stringify(a),r=decisionReplay(a);
 assert.equal(r.mode,'missed-opportunity');assert.equal(r.kind,'fork');assert.equal(r.materialGain,5);assert.equal(r.fen,a.before);assert.deepEqual(r.pv,a.lines[0].pv);assert.equal(r.punishment,false);assert.match(compareMove(a).cause,/fork|double attack/);
 const lesson=replayLesson(r.fen,r.pv,1,{mode:r.mode});assert.match(lesson.heading,/Your better move/);assert.ok(lesson.lines.some(l=>l.to==='a8'));assert.ok(lesson.lines.some(l=>l.to==='e8'));assert.equal(JSON.stringify(a),saved);
 const capture=replayLesson(r.fen,r.pv,3,{mode:r.mode});assert.match(capture.impact,/gained 5/);assert.doesNotMatch(capture.impact,/since the mistake/);
});
test('a safe missed capture shows the material-winning line for either colour',()=>{
 const white=attempt('4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1',['d1d5','e8f8','e1f1','f8e7','d5e5'],['d1c1','d5d4']);const r=decisionReplay(white);assert.equal(r.kind,'material');assert.match(r.description,/wins the rook on d5/);assert.equal(r.mode,'missed-opportunity');
 const g=new Chess();for(const san of ['e4','e5','Qh5','g6','a3'])g.move(san);const black=attempt(g.fen(),['g6h5'],['a7a6']);const b=decisionReplay(black);assert.equal(b.kind,'material');assert.match(b.description,/queen on h5/);assert.equal(new Chess(b.fen).turn(),'b');
});
test('equal exchanges and unfinished unsafe captures are not called material wins',()=>{
 const g=new Chess();g.move('e4');g.move('d5');const exchange=attempt(g.fen(),['e4d5','d8d5','b1c3','d5e6','g1f3'],['e4e5','c8f5']);assert.equal(decisionReplay(exchange).mode,'punishment');
 const unfinished=attempt('3qk3/8/4p3/3r4/8/8/8/3QK3 w - - 0 1',['d1d5'],['d1c1','d5d4']);assert.equal(decisionReplay(unfinished).mode,'punishment');
});
test('a threatened mate keeps its punishment focus and harmless moves are not missed opportunities',()=>{
 const g=new Chess();for(const san of ['f3','e5'])g.move(san);const a=attempt(g.fen(),['e2e4'],['g2g4','d8h4']);a.actual.mate=-1;assert.equal(decisionReplay(a).mode,'punishment');
 const okay=attempt('4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1',['d1d5'],['d1c1','d5d4']);okay.grade.severity=0;assert.equal(decisionReplay(okay).mode,'punishment');
});
test('an unproven fork is described as a chance, not a guaranteed material win',()=>{
 const a=attempt('3qk3/8/8/8/8/5N2/4P3/R5K1 b - - 0 1',['d8f6','e2e3'],['d8b6','e2e3']);const r=decisionReplay(a);assert.equal(r.kind,'fork');assert.equal(r.materialGain,0);assert.match(r.description,/could work/);assert.doesNotMatch(r.description,/shown line wins material/);
});
