import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { reviewModel } from '../src/game-review.js';
function gameRecord(){const g=new Chess(),record={moves:[],attempts:[]};for(const san of ['e4','e5','Nf3']){const before=g.fen(),m=g.move(san);record.moves.push(m.lan);record.attempts.push({ply:record.moves.length-1,before,uci:m.lan,actual:{cp:30,pv:[m.lan]},lines:[{cp:30,pv:[m.lan]}],grade:{label:'Best move',severity:0}});}return record;}
test('review counts both players and converts every score to White’s perspective',()=>{const m=reviewModel(gameRecord());assert.equal(m.analysed,3);assert.equal(m.sides.w.best,2);assert.equal(m.sides.b.best,1);assert.deepEqual(m.points,[.3,-.3,.3]);});
test('missing and stale analysis is not presented as a rated move',()=>{const r=gameRecord();r.attempts[1].before=new Chess().fen();r.attempts[2].grade.label='Unrated';const m=reviewModel(r);assert.equal(m.analysed,1);assert.deepEqual(m.points,[.3,null,null]);assert.equal(m.sides.b.analysed,0);});
test('post-game analysis replaces saved grades without altering original attempts',()=>{const r=gameRecord(),saved=JSON.stringify(r.attempts);r.reviewAttempts=[{...r.attempts[1],actual:{mate:-2,pv:['e7e5']},grade:{label:'Blunder',severity:3}}];const m=reviewModel(r);assert.deepEqual(m.keyPlies,[1]);assert.equal(m.sides.b.blunder,1);assert.equal(m.points[1],10);assert.equal(JSON.stringify(r.attempts),saved);});
