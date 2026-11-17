import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { resetPractice } from '../src/reset-practice.js';
import { positionAt } from '../src/timeline.js';
test('reset clears a custom root and all variation, assistance and review history',()=>{
  const source={id:'old',startFen:'4k3/8/8/8/8/8/P7/4K3 b - - 0 7',color:'b',opening:'custom',level:1350,opponent:1600,mode:'opponent',coachingIntensity:'honest',coach:true,parentId:'source',editedPosition:true,moves:['e8d7'],attempts:[{ply:0}],hints:[{ply:0}],pending:{uci:'e8d7'},finished:true,result:'Ended',retrying:true};
  const saved=JSON.stringify(source),fresh=resetPractice(source,'fresh',{opening:'italian'});
  assert.equal(positionAt(fresh,0).fen(),new Chess().fen());assert.deepEqual(fresh.moves,[]);assert.deepEqual(fresh.attempts,[]);
  for(const key of ['startFen','parentId','editedPosition','hints','pending','result','retrying'])assert.equal(key in fresh,false,key);
  assert.equal(fresh.finished,false);assert.equal(fresh.color,'b');assert.equal(fresh.opponent,1600);assert.equal(fresh.opening,'italian');assert.equal(fresh.coachingIntensity,'honest');assert.equal(JSON.stringify(source),saved);
});
test('free play reset keeps both-side control and the chosen coaching intensity',()=>{
  const fresh=resetPractice({color:'w',opening:'caro',mode:'free',coach:false,coachingIntensity:'silent',moves:['e2e4'],attempts:[]},'fresh');
  assert.equal(fresh.mode,'free');assert.equal(fresh.coach,false);assert.equal(fresh.coachingIntensity,'silent');assert.equal(positionAt(fresh,0).turn(),'w');assert.equal(positionAt(fresh,0).board().flat().filter(Boolean).length,32);
});
