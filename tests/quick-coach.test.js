import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { moveBadge, playableChoices } from '../src/quick-coach.js';
test('quality badges distinguish strong, OK, medium, mistake, blunder and unrated moves without color alone',()=>{
  const cases=[['Best move',0,'excellent','✓✓'],['Good move',0,'good','✓'],['Playable',0,'ok','✓'],['Inaccuracy',1,'medium','?!'],['Mistake',2,'mistake','!'],['Blunder',3,'blunder','!!'],['Missed mate',2,'mistake','!'],['Unrated',0,'neutral','·']];
  for(const [label,severity,tone,symbol] of cases){const result=moveBadge({label,severity});assert.equal(result.tone,tone);assert.equal(result.symbol,symbol);assert.ok(result.label);}
  assert.equal(moveBadge(null).label,'Not rated');
});
test('only similarly strong legal alternatives accompany the best suggestion',()=>{
  const lines=[{cp:35,pv:['e2e4','e7e5']},{cp:20,pv:['d2d4','d7d5']},{cp:-250,pv:['f2f3']},{cp:30,pv:['e2e4']},{cp:25,pv:['e2e5']}];
  const choices=playableChoices(new Chess().fen(),lines);
  assert.deepEqual(choices.map(c=>c.suggestion.san),['e4','d4']);assert.equal(choices[0].best,true);assert.equal(choices[1].best,false);
  assert.equal(choices.every(c=>c.grade.severity===0),true);
});
test('losing a forced mate is not offered as an OK alternative',()=>{
  const choices=playableChoices(new Chess().fen(),[{mate:4,pv:['e2e4']},{cp:100,pv:['d2d4']}]);
  assert.equal(choices.length,1);assert.equal(choices[0].suggestion.san,'e4');
  assert.deepEqual(playableChoices(new Chess().fen(),[]),[]);
});
test('Black suggestions preserve mover-perspective scores and do not mutate engine lines',()=>{
  const game=new Chess();game.move('e4');const lines=[{cp:15,pv:['e7e5']},{cp:5,pv:['c7c5']},{cp:-400,pv:['g7g5']}],before=structuredClone(lines);
  assert.deepEqual(playableChoices(game.fen(),lines).map(c=>c.suggestion.san),['e5','c5']);assert.deepEqual(lines,before);
});
