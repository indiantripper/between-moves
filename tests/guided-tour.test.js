import test from 'node:test';
import assert from 'node:assert/strict';
import {nextGuideStep} from '../src/guided-tour.js';
test('onboarding follows available events and offers one step at a time',()=>{
 assert.equal(nextGuideStep({hasGame:false,hasGames:false}).id,'start');
 const playing={hasGame:true,hasGames:true};assert.equal(nextGuideStep(playing,{start:true}).id,'best');
 const seen={start:true,best:true};assert.equal(nextGuideStep(playing,seen),null);
 const afterMove={...playing,feedback:true,alternatives:true};assert.equal(nextGuideStep(afterMove,seen).id,'feedback');seen.feedback=true;assert.equal(nextGuideStep(afterMove,seen).id,'alternatives');
 seen.alternatives=true;assert.equal(nextGuideStep(afterMove,seen),null);
 const reply={...afterMove,opponent:true,next:true};assert.equal(nextGuideStep(reply,seen).id,'opponent');seen.opponent=true;assert.equal(nextGuideStep(reply,seen).id,'next');seen.next=true;
 assert.equal(nextGuideStep({...reply,bad:false},seen),null);assert.equal(nextGuideStep({...reply,bad:true},seen).id,'punishment');
});
test('seen and skipped tour preferences persist without suppressing a later mistake tip',()=>{
 const seen=JSON.parse(JSON.stringify({start:true,best:true,feedback:true,alternatives:true,opponent:true,next:true}));
 assert.equal(nextGuideStep({hasGame:true,bad:true},seen).id,'punishment');
 assert.equal(nextGuideStep({hasGame:true,bad:true},{...seen,skipped:true}),null);
});
test('the best move prompt waits until the icon can be used',()=>{
 assert.equal(nextGuideStep({hasGame:true,ready:false}),null);assert.equal(nextGuideStep({hasGame:true,ready:true}).id,'best');
});
test('the move badge is introduced only when it appears, before the feedback section',()=>{
 const seen={start:true,best:true};
 assert.equal(nextGuideStep({hasGame:true,badge:false},seen),null);
 assert.equal(nextGuideStep({hasGame:true,badge:true,feedback:true},seen).id,'badge');
 assert.equal(nextGuideStep({hasGame:true,badge:true,feedback:true},{...seen,badge:true}).id,'feedback');
});
