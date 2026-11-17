import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {decisionReplay} from '../src/decision-replay.js';
import {compareMove} from '../src/move-comparison.js';
import {miniLineFrames,miniLineMarkup} from '../src/mini-line.js';
import {replayLesson} from '../src/replay-lesson.js';
function missedMate(){
 const g=new Chess();for(const m of ['f3','e5','g4'])g.move(m);
 return {before:g.fen(),uci:'e8e7',actual:{cp:150,pv:['e8e7','e2e3']},lines:[{mate:1,pv:['d8h4']}],grade:{label:'Missed mate',severity:2}};
}
test('a missed mate replays the winning move from before the decision, not the opponent reply',()=>{
 const a=missedMate(),saved=JSON.stringify(a),model=decisionReplay(a);
 assert.equal(model.mode,'missed-mate');assert.equal(model.punishment,false);assert.equal(model.fen,a.before);assert.deepEqual(model.pv,['d8h4']);
 const frames=miniLineFrames(model.fen,model.pv,model.limit);assert.equal(frames[1].label,'Qh4#');assert.equal(new Chess(frames[1].fen).isCheckmate(),true);
 const comparison=compareMove(a);assert.equal(comparison.missedMate,true);assert.match(comparison.cause,/Qh4# starts a forced mate in 1 move/);assert.doesNotMatch(comparison.cause,/punish|allows/);
 const lesson=replayLesson(model.fen,model.pv,1,{mode:model.mode});assert.match(lesson.heading,/Your mating move/);assert.match(lesson.reason,/finish you missed/);assert.doesNotMatch(lesson.heading,/Opponent/);
 assert.match(miniLineMarkup(model.fen,model.pv,false,{mode:model.mode,limit:model.limit}),/data-mini-mode="missed-mate"/);assert.equal(JSON.stringify(a),saved);
});
test('a White missed mate uses White as the attacking side and Black as the defence',()=>{
 const g=new Chess();for(const m of ['e4','f6','d4','g5'])g.move(m);
 const a={before:g.fen(),uci:'b1c3',actual:{cp:80,pv:['b1c3','h7h6']},lines:[{mate:1,pv:['d1h5']}]};const r=decisionReplay(a),lesson=replayLesson(r.fen,r.pv,1,{mode:r.mode});assert.match(lesson.reason,/White gives checkmate/);assert.equal(r.mode,'missed-mate');
 const defence=replayLesson(new Chess().fen(),['e2e4','e7e5'],2,{mode:'missed-mate'});assert.match(defence.heading,/Opponent’s defence/);assert.doesNotMatch(defence.impact,/damage/);
});
test('actual punishment still starts after the mistake and includes the mating reply',()=>{
 const g=new Chess();for(const m of ['f3','e5'])g.move(m);const a={before:g.fen(),uci:'g2g4',actual:{mate:-1,pv:['g2g4','d8h4']},lines:[{cp:-20,pv:['e2e4']}]};
 const r=decisionReplay(a);assert.equal(r.mode,'punishment');assert.equal(r.punishment,true);assert.equal(new Chess(r.fen).get('g4').type,'p');assert.deepEqual(r.pv,['d8h4']);assert.equal(new Chess(miniLineFrames(r.fen,r.pv)[1].fen).isCheckmate(),true);
});
test('longer missed mates retain enough plies and stale analysis cannot create one',()=>{
 const a=missedMate();a.lines[0].mate=8;assert.equal(decisionReplay(a).limit,15);a.actual.pv[0]='a7a6';assert.equal(decisionReplay(a),null);
});
test('a mating line includes the opponent defence and finishes at mate',()=>{
 const a={before:'7k/8/5K2/4Q3/8/8/8/8 w - - 0 1',uci:'e5e1',actual:{cp:800,pv:['e5e1','h8g8']},lines:[{mate:2,pv:['e5c7','h8g8','c7g7']}],grade:{severity:2,label:'Missed mate'}};
 const r=decisionReplay(a),frames=miniLineFrames(r.fen,r.pv,r.limit);assert.deepEqual(frames.map(f=>f.label),['Before','Qc7','Kg8','Qg7#']);
 assert.match(replayLesson(r.fen,r.pv,2,{mode:r.mode}).heading,/Opponent’s defence/);assert.equal(new Chess(frames.at(-1).fen).isCheckmate(),true);
});
