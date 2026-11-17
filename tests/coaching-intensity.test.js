import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { coachingIntensity, feedbackPolicy } from '../src/coaching-intensity.js';
import { editedSession } from '../src/position-editor.js';
import { forkSession } from '../src/timeline.js';
test('old coaching on/off saves keep their meaning; invalid intensity safely falls back',()=>{
  assert.equal(coachingIntensity({coach:true}),'coached');
  assert.equal(coachingIntensity({coach:false}),'silent');
  assert.equal(coachingIntensity({coachingIntensity:'other',coach:false}),'silent');
  assert.equal(coachingIntensity({coachingIntensity:'gentle',coach:true}),'coached');
});
test('Silent hides every automatic live feedback surface but restores complete review',()=>{
  const record={coachingIntensity:'silent'};
  for(const key of ['grades','guidance','alternatives','evaluation']){
    assert.equal(feedbackPolicy(record)[key],false,key);
    assert.equal(feedbackPolicy(record,true)[key],true,key);
  }
});
test('Legacy Gentle and Honest migrate to complete Coached feedback',()=>{
  const gentle=feedbackPolicy({coachingIntensity:'gentle'});
  assert.equal(gentle.guidance,true);assert.equal(gentle.alternatives,true);assert.equal(gentle.grades,true);
  assert.equal(feedbackPolicy({coachingIntensity:'coached'}).grades,true);
});
test('coaching intensity survives reload, historical branches and position editing',()=>{
  const g=new Chess();g.move('e4');g.move('e5');
  const record={id:'source',color:'w',mode:'free',coach:true,coachingIntensity:'gentle',moves:['e2e4','e7e5'],attempts:[]};
  const restored=JSON.parse(JSON.stringify(record));
  assert.equal(coachingIntensity(restored),'coached');
  assert.equal(coachingIntensity(forkSession(restored,1,'branch')),'coached');
  assert.equal(coachingIntensity(editedSession(restored,g.fen(),'w','edited')),'coached');
});
test('the two-mode menu migrates both previous coached modes',()=>{
  for(const coachingIntensityValue of ['honest','gentle','coached'])assert.equal(coachingIntensity({coachingIntensity:coachingIntensityValue}),'coached');
});
