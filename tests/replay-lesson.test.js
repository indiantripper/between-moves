import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {replayLesson} from '../src/replay-lesson.js';
import {miniLineMarkup} from '../src/mini-line.js';
test('punishment lessons explain mate and highlight the checking line and king',()=>{
 const g=new Chess();for(const m of ['f3','e5','g4'])g.move(m);const fen=g.fen(),pv=['d8h4'],saved=JSON.stringify(pv);
 const lesson=replayLesson(fen,pv,1,{punishment:true});
 assert.match(lesson.heading,/Opponent/);assert.match(lesson.reason,/checkmate/);assert.ok(lesson.marks.some(m=>m.square==='e1'&&m.role==='threat'));assert.ok(lesson.lines.some(l=>l.from==='h4'&&l.to==='e1'));
 assert.equal(g.fen(),fen);assert.equal(JSON.stringify(pv),saved);
 const svg=miniLineMarkup(fen,pv,false,{highlights:lesson});assert.match(svg,/replay-coaching-highlights/);assert.match(svg,/<title>Check/);
});
test('captures explain the piece lost and track the material gained since the mistake',()=>{
 const fen='4k3/8/8/8/8/8/q7/R3K3 b Q - 0 1';
 const lesson=replayLesson(fen,['a2a1'],1,{punishment:true});assert.match(lesson.reason,/rook on a1/);assert.match(lesson.impact,/Black is up 5/);assert.ok(lesson.marks.some(m=>m.square==='a1'&&m.role==='threat'));
});
test('a possible next capture uses a conditional arrow and changes with the selected step',()=>{
 const g=new Chess();g.move('e4');g.move('d5');const pv=['e4d5','d8d5'];
 const first=replayLesson(g.fen(),pv,1),second=replayLesson(g.fen(),pv,2);
 assert.match(first.watch,/Black can take the pawn on d5/);assert.ok(first.lines.some(l=>l.conditional&&l.from==='d8'&&l.to==='d5'));
 assert.match(second.reason,/takes back the pawn on d5/);assert.notEqual(first.heading,second.heading);assert.equal(second.lines.some(l=>l.conditional),false);
});
test('initial and invalid replay positions never invent a story',()=>{
 assert.match(replayLesson(new Chess().fen(),['e2e4'],0,{punishment:true}).reason,/checks, captures/);
 assert.equal(replayLesson(new Chess().fen(),['e2e5'],1),null);
});
test('pins highlight the pinned piece and king on the step that creates the pin',()=>{
 const g=new Chess();for(const move of ['d4','Nf6','c4','e6','Nc3'])g.move(move);
 const lesson=replayLesson(g.fen(),['f8b4'],1,{punishment:true});
 assert.match(lesson.reason,/knight on c3 is pinned/);assert.ok(lesson.marks.some(m=>m.square==='c3'&&m.role==='pin'));assert.ok(lesson.lines.some(l=>l.from==='b4'&&l.to==='e1'&&l.role==='pin'));
});
test('White can punish Black and castling highlights both moving pieces',()=>{
 const g=new Chess();for(const m of ['e4','f6','d4','g5'])g.move(m);
 const mate=replayLesson(g.fen(),['d1h5'],1,{punishment:true});assert.match(mate.heading,/Opponent/);assert.match(mate.reason,/White gives checkmate/);assert.ok(mate.marks.some(m=>m.square==='e8'&&m.role==='threat'));
 const castle=replayLesson('r3k2r/ppp2ppp/2n5/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1',['e1g1'],1);for(const sq of ['e1','g1','h1','f1'])assert.ok(castle.marks.some(m=>m.square===sq));
});
