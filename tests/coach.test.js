import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { gradeMove, displayScore, sanLine, explainMove, explainCandidate, learningSummary } from '../src/coach.js';
import { parseInfo } from '../src/engine.js';
import { validateBooks, bookOptions, OPENINGS } from '../src/openings.js';
import { validateBackup } from '../src/storage.js';

test('every opening line is legal and variation matching stops on deviation',()=>{
  assert.equal(validateBooks(),true);
  assert.deepEqual(bookOptions(OPENINGS[1],['e4','e5','Nf3','Nc6','Bc4']),['Bc5','Nf6']);
  assert.deepEqual(bookOptions(OPENINGS[1],['d4']),[]);
});
test('engine parsing preserves mate scores, depth, and multiple variations',()=>{
  assert.deepEqual(parseInfo('info depth 14 seldepth 20 multipv 2 score cp -35 nodes 100 pv e2e4 e7e5'),{index:2,depth:14,cp:-35,pv:['e2e4','e7e5']});
  assert.equal(parseInfo('info depth 10 score cp 35 lowerbound pv e2e4'),null);
  assert.equal(parseInfo('info depth 14 multipv 1 score mate -2 pv e1f1').mate,-2);
});
test('scores display from White perspective while grading uses mover perspective',()=>{
  assert.equal(displayScore({cp:125},'b'),'-1.25');
  assert.equal(displayScore({mate:3},'b'),'−M3');
  assert.equal(gradeMove({cp:30},{cp:20}).label,'Good move');
  assert.equal(gradeMove({cp:50},{cp:-500}).label,'Blunder');
  assert.equal(gradeMove({mate:3},{cp:500}).label,'Missed mate');
  assert.equal(gradeMove({cp:0},{mate:-3}).label,'Blunder');
  assert.equal(gradeMove({cp:-1800},{cp:-2000}).label,'Good move');
});
test('continuations are legal and checkmate explanations are factual',()=>{
  assert.deepEqual(sanLine(new Chess().fen(),['e2e4','e7e5','g1f3','a1a8']),['e4','e5','Nf3']);
  const g=new Chess();['f3','e5','g4'].forEach(m=>g.move(m));
  assert.match(explainCandidate(g.fen(),{pv:['d8h4'],mate:1}),/Checkmate/);
});
test('leaving book is distinct from making a mistake',()=>{
  const g=new Chess(),before=g.fen(),move=g.move('d4');
  const result=explainMove(before,move,{cp:25,pv:['e2e4']},{cp:20,pv:['d2d4','d7d5']},{label:'Good move',severity:0},1350,['e4']);
  assert.match(result.facts[0],/That alone is not a mistake/);
  assert.equal(result.tags.length,0);
});
test('memory excludes retries and distinguishes assisted decisions',()=>{
  const attempt={grade:{loss:50,severity:1,label:'Inaccuracy'},explanation:{tags:['calculation']}};
  const summary=learningSummary([{attempts:[{...attempt,assisted:false},{...attempt,assisted:true},{...attempt,retry:true}]}]);
  assert.equal(summary.originals,2);assert.equal(summary.unassisted,1);assert.equal(summary.patterns[0].count,2);assert.equal(summary.ready,false);
});
test('backup validation rejects malformed move records',()=>{
  assert.throws(()=>validateBackup({version:1,games:[{id:'x',moves:['bad'],attempts:[]}],settings:{}}));
  assert.equal(validateBackup({version:1,games:[],settings:{}}).version,1);
});
